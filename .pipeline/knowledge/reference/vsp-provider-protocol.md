# VSP Provider Protocol

Status: C2 planning baseline. This file must be updated during each Codex
adapter Milestone and finalized before C2 acceptance.

## Purpose

Define the provider-independent protocol that VSP-Coder exposes to browsers and
future adapters. Browser clients must not depend on raw Codex, OpenCode, or
Claude Code wire formats.

## Core Concepts

### Project

Represents a local working directory surfaced by provider metadata or user
selection. For Codex, projects are primarily discovered by aggregating thread
`cwd` values.

M03 rule: provider-discovered projects are runtime data. They may contain
absolute paths from the local machine because the provider reports real cwd
metadata, but those paths must not be committed as source-code defaults.

### Session

Represents a provider thread/conversation plus VSP runtime metadata.

Required fields:

- provider
- project id
- provider thread id
- canonical title
- cwd
- status
- model and reasoning effort
- approval/sandbox profile
- current turn id when active
- timestamps
- metrics

Codex thread title is canonical for Codex sessions. VSP-Coder may store local UI
metadata, but it must not override provider canonical names.

M03 rule: for Codex-discovered sessions, the VSP session id is the Codex thread
id and the session title is derived from Codex `name` or preview. Discovery is
read-only until later Milestones explicitly add start/resume/mutation paths.

M04 rule: selecting a provider-discovered session may lazily hydrate message
history from the provider. The list view can remain light, but the active
session should merge detailed messages into the VSP state once loaded.

### Message

Normalized content shown in the conversation stream. Messages may include text,
structured tokens, attachments, tool output summaries, and provider item refs.

M04 baseline mapping loads historical Codex `ThreadItem` objects into text-first
VSP messages. Rich command/file artifacts remain deferred to M07, and streaming
message deltas remain deferred to M05.

M05 rule: streaming updates are exposed as provider-neutral `live_session_patch`
payloads over VSP SSE events. Assistant and tool deltas append to normalized
`Message` text blocks by VSP message id/provider item ref. Final
`item/completed` notifications replace or append finalized VSP messages so the
streaming draft converges to canonical history.

### Event

Append-only runtime signal for status changes, queue updates, warnings, errors,
usage, file changes, command output, and lifecycle transitions.

### RequestCard

Interactive provider request routed through the VSP UI. Initial C2 request kinds:

- command execution approval
- file change approval
- permission request
- tool user input
- MCP elicitation
- interrupt/danger confirmation

M06 rule: provider approval and input callbacks are represented as VSP
`RequestCard`s with provider-neutral browser fields. The server keeps the raw
provider request id and params in its pending-request table; the browser receives
only card text, actions, status, and session id.

Request card statuses:

- `open`: waiting for user/front-end resolution.
- `resolved`: approved or successfully answered.
- `denied`: rejected by the user.
- `failed`: the server could not write the provider response.
- `expired`: cancelled/timed out from the VSP side.

### Artifact

Previewable or inspectable provider output, such as changed files, diffs,
command summaries, and rendered/unsupported preview targets.

M07 artifact fields:

- `kind`: `command`, `file`, `diff`, or `preview`.
- `status`: provider-neutral execution/change state such as `running`,
  `completed`, `failed`, `declined`, or `changed`.
- `body`: inline preview text for command output and diffs when available.
- `path`: optional provider/project-relative path for file previews.
- `previewStatus`: `renderable`, `placeholder`, or `unsupported`.

Preview reads are session-scoped. A file artifact may be read only if its
resolved path stays under the selected session `cwd`. Inline command output and
diff bodies preview without touching the filesystem.

### Metric

Usage and runtime measurements, including token usage, rate-limit information,
duration, and optional cost estimate.

M05 metric fields:

- `inputTokens`
- `outputTokens`
- `durationMs`
- `contextWindow`
- `rateLimits.limitName`
- `rateLimits.primaryUsedPercent`
- `rateLimits.secondaryUsedPercent`
- `rateLimits.resetsAt`
- `rateLimits.creditsBalance`

Rate-limit updates may be global account events instead of session-scoped
events.

## Streaming And Event Contract

M05 maps Codex app-server notifications into VSP events:

| Codex Notification | VSP Mapping |
|---|---|
| `item/agentMessage/delta` | transient `message_added` with assistant delta |
| `item/commandExecution/outputDelta` | transient `message_added` with tool delta |
| `item/fileChange/outputDelta` | transient `message_added` with tool delta |
| `item/completed` | finalized VSP message replacement/append |
| `rawResponseItem/completed` | lightweight message event and optional refresh |
| `turn/started` | `running` session status and `currentTurnId` |
| `turn/completed` | `idle`/`interrupted`/`error` status, duration metric, refresh |
| `thread/status/changed` | session status event |
| `thread/tokenUsage/updated` | `metric_updated` event |
| `account/rateLimits/updated` | `rate_limit_updated` event |
| `warning`/`guardianWarning`/`configWarning` | `warning` event |
| `error` | `error` event |

Transient streaming events are sent to subscribers but are not persisted into
Activity history for every token/delta.

M09 refresh rule: browser clients should prefer incremental updates over full
state reloads. Live session patches update the active session in place; ordinary
events can be appended to Activity without forcing `/api/state`. Heartbeat
refreshes are coarse reconciliation, while running-session detail polling is
silent and scoped to the active session. Session list sorting should use a
stable "last settled" timestamp and update it only when a busy session becomes
settled, not on every provider refresh.

M09 polling refinement: the currently selected Codex session is silently polled
even when the turn was started outside VSP-Coder. This keeps externally updated
Codex threads visible without returning to full global refresh on every event.

## Request-Card Contract

M06 maps Codex server-to-client JSON-RPC requests into VSP cards:

| Provider Request | VSP Kind | Primary Actions |
|---|---|---|
| `item/commandExecution/requestApproval` | `approval` | allow once, allow session, reject, cancel |
| `execCommandApproval` | `approval` | allow once, allow session, reject, cancel |
| `item/fileChange/requestApproval` | `approval` | allow once, allow session, reject, cancel |
| `applyPatchApproval` | `approval` | allow once, allow session, reject, cancel |
| `item/permissions/requestApproval` | `approval` | allow turn, allow session, reject |
| `item/tool/requestUserInput` | `user_input` | select option or submit default answer |
| `mcpServer/elicitation/request` | `user_input` | accept, decline, cancel |

Resolution events use VSP `card_resolved` or `error` events. The provider raw
response shape remains backend-only and is documented in the Codex adapter
mapping.

## Queue Contract

Frontend input is intent, not direct provider IO. The server owns a single-driver
queue per provider thread and decides whether to start a turn, steer an active
turn, or keep the message pending.

Different provider threads may run independently. A single provider thread must
not have multiple conflicting drivers.

### M08 Queue And Interrupt Semantics

- `interrupt` means interrupt the active provider turn. For Codex this maps to
  `turn/interrupt` with `{ threadId, turnId }`; it must not terminate the
  VSP-Coder HTTP server or the Codex app-server process.
- `clear_queue` clears only VSP-owned queue items whose state is `pending`.
  Queue items already marked `sent` and the provider active turn remain intact.
- When a Codex session is `running`, `waiting_approval`, `queued`, or has
  `currentTurnId`, new frontend messages are appended to VSP pending queue
  instead of starting a second active turn.
- After a `turn/completed` notification leaves the session idle, the server
  drains the next pending queue item by marking it `sent` and starting a new
  Codex turn. This keeps one driver per thread.
- Queue and interrupt state changes are published through the normal VSP event
  stream so multiple browser windows converge on the same state.

### M08 Recovery Semantics

- If Codex app-server reports `crashed`, `unavailable`, or `stopped`, cached
  active Codex sessions become `error`, `currentTurnId` is cleared, and open
  request cards are marked failed. Pending queue items are preserved.
- If Codex app-server reports `ready`, discovery cache is invalidated and cached
  active/error sessions are refreshed from Codex canonical state.
- `thread/read includeTurns` should restore `currentTurnId` from an
  `inProgress` turn when available, so interrupt remains available after a
  browser refresh or session detail reload.

## Rename Contract

Session rename is a provider mutation, not a local display preference.

### M09 Rename Semantics

- Browser clients send a provider-neutral `rename_session` action with the
  desired title.
- The backend adapter must translate that action into the provider's canonical
  rename operation. For Codex this is `thread/name/set`.
- The backend must refresh the session from the provider after rename and return
  the refreshed session. Provider canonical title wins over optimistic UI state
  or VSP-local metadata.
- Rename events may also arrive as live patches. Those patches update visible
  session title, but a canonical provider refresh remains the source of truth.
- Dev/test providers may implement local rename behavior for UI QA, but real
  provider adapters must document whether the provider persists rename across
  browser refresh and server restart.

## Configuration Contract

VSP automation profile maps to provider-specific approval, sandbox, and reviewer
settings. The frontend setting, backend stored config, and provider request
parameters must stay consistent.

### M01 Configuration Baseline

M01 introduced the first real VSP instance configuration contract.

- Local instance config path: `.vsp-coder/config.json`.
- The file is generated per checkout/deployment and is ignored by git through
  the existing `.vsp-coder/` ignore rule.
- `deploymentMode` values: `local`, `release`.
- `dataMode` values: `codex`, `dev-test`.
- `automationProfile` values: `full_auto`, `workspace_auto`, `manual`.
- `dataMode=codex` is the normal mode and hides C1 mock fixtures.
- `dataMode=dev-test` exposes C1 mock fixtures for development and QA only.
- The frontend settings panel, backend config API, and shared protocol all use
  the same profile identifiers.

The VSP state snapshot now includes `config`, and Codex-ready sessions may carry
the selected `automationProfile`, `approvalPolicy`, and `sandbox` metadata. This
metadata is VSP runtime state; Codex canonical thread metadata remains owned by
Codex once the adapter is connected.

M06 profile behavior:

- `full_auto`: Codex `approvalPolicy=never`, `sandbox=danger-full-access`.
  If an approval request still arrives, the server auto-resolves approval cards
  and records a `card_resolved` event. User-input and MCP elicitation cards are
  never silently answered.
- `workspace_auto`: Codex `approvalPolicy=on-failure`,
  `sandbox=workspace-write`; request cards appear only when Codex asks.
- `manual`: Codex `approvalPolicy=untrusted`, `sandbox=workspace-write`;
  command, file, and permission requests are routed to frontend cards.

M06 post-QA rule: `manual` intentionally uses Codex `untrusted` rather than
`on-request`, because `on-request` may run sandbox-safe commands without a
frontend approval card.

M09 local-QA rule: `deploymentMode=local` normalizes to `full_auto` on the
backend. This keeps local Codex work on `approvalPolicy=never` and
`sandbox=danger-full-access`, avoiding fragile frontend approval-card clicks
during C2 rename/persistence QA. `deploymentMode=release` still preserves the
selected automation profile for packaged deployments.

For `thread/start`, Codex receives `approvalPolicy`, `approvalsReviewer`, and
legacy `sandbox`. For `turn/start`, Codex receives `approvalPolicy`,
`approvalsReviewer`, and `sandboxPolicy`.

## Artifact And Preview Contract

M07 maps Codex output and file-change signals into artifacts:

| Codex Signal | VSP Artifact |
|---|---|
| `commandExecution` item | `command` artifact with command, status, exit code, duration, and output |
| `item/commandExecution/outputDelta` | live append to command artifact body |
| `fileChange` item | one `diff` artifact per changed file |
| `item/fileChange/patchUpdated` | one `diff` artifact per changed file |
| `turn/diff/updated` | aggregated turn `diff` artifact |

Preview endpoint:

- `GET /api/sessions/:sessionId/artifacts/:artifactId/preview`
- Inline artifact body is returned directly.
- File previews must remain under the selected session cwd.
- Large, binary, missing, or unsupported targets return an unsupported preview
  state or an error instead of leaking data.

## Safety Contract

- No raw provider protocol as the browser-facing public API.
- No committed user-specific path defaults.
- Provider credentials never go to the browser.
- VSP preview/file APIs remain project-root confined.
- Tmp QA fixtures are explicit dev/test artifacts.
- C2 disposable tmp QA fixtures are generated on demand through
  `POST /api/qa/tmp-fixture`; they are not production defaults and their paths
  are not committed.
- Provider adapters should document any self-protection boundary needed when
  the provider is asked to operate on the VSP-Coder checkout that hosts the
  server.

M01 added an automated production-source scan that fails if core app/protocol
source files contain the known local user path literal. This is a focused guard;
future Milestones should broaden it if new source roots are added.

## Provider Health Contract

M02 added a provider-health shape for Codex app-server availability. Provider
health is operational metadata, not provider session data.

Codex health statuses:

- `stopped`: no child process is currently connected.
- `starting`: VSP-Coder has spawned app-server and is waiting for initialize.
- `ready`: initialize succeeded and the JSON-RPC client is usable.
- `unavailable`: startup or initialize failed.
- `crashed`: the child exited unexpectedly.

The browser sees this only through VSP-Coder APIs and UI state. It never receives
the raw app-server transport.

## Final C2 Limitations And Handoff Notes

- Codex app-server is still an experimental integration surface; schema changes
  should update generated knowledge artifacts and adapter tests first.
- Pending outbound queue is in-memory and does not survive VSP-Coder server
  restart. It is explicit in the UI, but not a durable job queue.
- Mobile soft-keyboard behavior remains browser/OS sensitive. M09 improved
  `visualViewport` handling, but further polish should be a frontend-only
  follow-up, not a provider protocol blocker.
- Full automation is forced only for local deployments. Release deployments must
  expose automation choices in Settings.
- OpenCode and Claude adapter planning should reuse this provider protocol:
  Project, Session, Message, Event, RequestCard, Artifact, Metric, Queue, Rename,
  Configuration, and Health. Their raw provider protocols should stay backend
  only, just like Codex.

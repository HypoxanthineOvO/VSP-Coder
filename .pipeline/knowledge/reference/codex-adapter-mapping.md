# Codex Adapter Mapping

Status: C2 planning baseline. Update this file after each Codex integration
Milestone with observed behavior and test evidence.

## Integration Surface

Preferred Codex integration path:

- `codex app-server`
- Internal `stdio://` transport
- Generated TypeScript bindings and JSON Schema under
  `.pipeline/knowledge/generated/codex-app-server/`

Do not scrape Codex TUI output for C2.

## M02 App-Server Client Baseline

M02 implemented the first Codex app-server foundation:

- VSP-Coder server starts `codex app-server --listen stdio://` as a child
  process on demand.
- The app-server wire format is newline-delimited JSON-RPC, not
  `Content-Length` framing.
- Startup handshake sends `initialize` with VSP-Coder client info and
  `experimentalApi=true`, then sends the `initialized` notification after a
  successful response.
- Health states exposed to the VSP frontend: `stopped`, `starting`, `ready`,
  `unavailable`, `crashed`.
- Health fields include transport, pid, user agent, Codex home, platform family,
  platform OS, initialized timestamp, last stderr warning/error, and last exit.
- Request timeout default: 8 seconds.
- Browser clients access only VSP-Coder APIs:
  - `GET /api/providers/codex/health`
  - `POST /api/providers/codex/start`
  - `POST /api/providers/codex/stop`

Observed startup behavior on Codex CLI `0.128.0`:

- `initialize` succeeds over stdio.
- stderr may include non-fatal sqlite migration or plugin sync warnings.
- A plugin sync warning can occur when ChatGPT authentication is required for
  remote plugin sync while API-key auth is in use. M02 records this as
  `lastError`/warning but does not treat it as a failed app-server connection.

## Core Method Mapping

| Codex Method/Event | VSP-Coder Responsibility |
|---|---|
| `thread/list` | Discover sessions and aggregate projects from `cwd`. |
| `thread/read` | Load canonical thread metadata and turns. |
| `thread/resume` | Resume a thread under VSP server ownership. |
| `thread/start` | Create a new Codex thread for a selected cwd/profile. |
| `turn/start` | Start a new turn from queued frontend input. |
| `turn/steer` | Send steering input to an active turn when supported. |
| `turn/interrupt` | Implement frontend interrupt for active Codex turn. |
| `thread/name/set` | Persist canonical thread rename. |
| `skills/list` | Populate Codex skills autocomplete where available. |
| `model/list` | Populate Codex model options for the active Codex session. |
| `account/rateLimits/read` | Initialize or refresh rate-limit state. |

## M03 Thread And Project Discovery

M03 connected read-only Codex discovery to the normal `dataMode=codex` state
path.

`thread/list` parameters used:

- `limit: 50`
- `sortKey: updated_at`
- `sortDirection: desc`
- `archived: false`

Mapping rules:

- Each returned Codex thread with a non-empty `cwd` maps to one VSP `Session`.
- VSP `Session.id` is the Codex thread id.
- VSP `Session.title` uses Codex `name`, then first preview line, then a short
  thread-id fallback.
- Projects are aggregated from unique `cwd` values.
- VSP `Project.id` is a stable hash of `cwd`, prefixed with `codex-`.
- VSP `Project.name` is the basename of `cwd`.
- VSP `Project.path` is the runtime `cwd` reported by Codex.

Safety behavior:

- M03 uses only read/list discovery and does not rename, archive, start turns,
  or mutate existing Codex threads.
- Runtime paths such as user home paths may appear in API responses because they
  are Codex metadata, not committed source-code defaults.
- C1 mock sessions remain hidden in `dataMode=codex`; `dataMode=dev-test`
  continues to expose them for development.

## M04 Thread Read, Start, And Turn Start Baseline

M04 added the first real thread content and send paths:

- Existing sessions load details through `thread/read` with
  `includeTurns: true`.
- Codex turn items map into VSP messages:
  - `userMessage` -> VSP user message.
  - `agentMessage` and `plan` -> VSP assistant message.
  - `reasoning` -> VSP assistant message for now.
  - `commandExecution` -> VSP tool message.
  - `fileChange` -> VSP tool message placeholder.
- The frontend fetches `/api/sessions/:id` when a real Codex session is selected
  and merges the detailed messages into state.
- New session creation in `dataMode=codex` calls `thread/start` for the selected
  discovered project cwd.
- Sending a message to an existing Codex session first calls `thread/resume`,
  then calls `turn/start` with a text `UserInput` and the current VSP approval
  profile. This is required because `thread/list`/`thread/read` can find
  persisted history that is not loaded into the active app-server runtime; direct
  `turn/start` on such a thread returns `thread not found`.

Queue/steer status:

- M08 implements the VSP-owned pending queue for busy Codex sessions. Busy means
  the session is `running`, `waiting_approval`, `queued`, or has
  `currentTurnId`.
- Sending while busy appends a pending VSP `QueueItem`; it does not call
  `turn/start` immediately and does not create a second driver for the thread.
- On `turn/completed`, the server marks the next pending queue item `sent` and
  starts a fresh `turn/start` with that text.
- `turn/steer` remains reserved for a later, explicit same-turn steering feature
  because Codex can reject steering for turns such as `/review` or manual
  compact operations.
- The pending queue is currently in-memory server state, not a durable outbound
  queue across VSP-Coder server restarts.

Interrupt/control mapping:

- Frontend Interrupt -> Codex `turn/interrupt` with the cached or refreshed
  `currentTurnId`.
- Frontend Clear Queue -> mark pending VSP queue items `cleared`; active Codex
  turn and `sent` queue items are unchanged.
- `thread/read includeTurns` maps an `inProgress` turn id into
  `session.currentTurnId`, which keeps Interrupt usable after a session reload.

Recovery mapping:

- Codex health `crashed`/`unavailable`/`stopped` marks cached active sessions
  `error`, clears `currentTurnId`, and fails open request cards.
- Pending queue items survive app-server loss so the UI can make their state
  explicit. They are not auto-replayed until Codex is ready and the session is
  reconciled.
- Codex health `ready` invalidates `thread/list` discovery cache and refreshes
  cached active/error sessions.

## Notification Mapping

| Codex Notification | VSP Mapping |
|---|---|
| `item/agentMessage/delta` | transient SSE `live_session_patch` that appends assistant text |
| `item/commandExecution/outputDelta` | transient SSE `live_session_patch` that appends tool text |
| `item/fileChange/outputDelta` | transient SSE `live_session_patch` that appends tool text |
| `item/completed` | finalized normalized VSP message replacement/append |
| `rawResponseItem/completed` | lightweight message event and optional refresh |
| `turn/started` | running status, `currentTurnId`, start metric |
| `turn/completed` | idle/interrupted/error status, duration metric, detail refresh |
| `thread/status/changed` | session status event |
| `thread/tokenUsage/updated` | `metric_updated` event with token totals/context window |
| `account/rateLimits/updated` | `rate_limit_updated` event with account rate-limit snapshot |
| diff/file change notifications | artifact and preview update |
| warning/error | VSP warning/error event |

M05 implementation note: high-frequency streaming deltas are transient SSE
events and are not persisted into the Activity log for every chunk. Browser
clients apply the provider-neutral patch locally and must not depend on raw
Codex notification payloads.

## Artifact Mapping

M07 maps Codex command and file-change data into VSP artifacts:

| Codex Data | Artifact Mapping |
|---|---|
| `commandExecution` thread item | `kind=command`, status, command, cwd, exit code, duration, aggregated output |
| `item/commandExecution/outputDelta` | live append into the command artifact body |
| `fileChange` thread item | one `kind=diff` artifact per `FileUpdateChange` |
| `item/fileChange/patchUpdated` | one live `kind=diff` artifact per `FileUpdateChange` |
| `turn/diff/updated` | one aggregate turn diff artifact |

Artifacts are merged into live session patches and preserved across post-turn
`thread/read` refreshes. Older Codex sessions may not expose raw command/file
items after the fact; artifact fidelity is best for new live turns and for
threads whose `thread/read` returns structured `commandExecution`/`fileChange`
items.

Preview endpoint:

- `GET /api/sessions/:sessionId/artifacts/:artifactId/preview`
- Inline command/diff bodies preview without filesystem reads.
- File path previews are resolved relative to the selected session cwd and must
  remain under that cwd.
- Large or unsupported files return unsupported preview state.

## Request Mapping

| Codex Request | VSP RequestCard |
|---|---|
| command execution approval | command approval card |
| file change approval | file change approval card |
| permissions request approval | permission request card |
| tool request user input | user input card |
| MCP elicitation request | user input or form card |
| legacy exec/apply-patch approval | compatibility approval card |

M06 implementation details:

- JSON-RPC messages with both `id` and `method` are server-to-client requests,
  not responses to VSP requests. They are emitted as Codex request events.
- VSP stores pending request metadata server-side by card id
  `codex-request-<providerRequestId>`.
- Browser clients receive only provider-neutral `RequestCard` data.
- Frontend `card_action` calls are converted back to Codex JSON-RPC responses.

### M06 Response Payloads

| Codex Request | VSP Action | Codex Response |
|---|---|---|
| `item/commandExecution/requestApproval` | `accept` | `{ "decision": "accept" }` |
| `item/commandExecution/requestApproval` | `accept_session` | `{ "decision": "acceptForSession" }` |
| `item/commandExecution/requestApproval` | `decline` | `{ "decision": "decline" }` |
| `item/commandExecution/requestApproval` | `cancel` | `{ "decision": "cancel" }` |
| `item/fileChange/requestApproval` | `accept` | `{ "decision": "accept" }` |
| `item/fileChange/requestApproval` | `accept_session` | `{ "decision": "acceptForSession" }` |
| `item/fileChange/requestApproval` | `decline` | `{ "decision": "decline" }` |
| `item/fileChange/requestApproval` | `cancel` | `{ "decision": "cancel" }` |
| `execCommandApproval` / `applyPatchApproval` | `accept` | `{ "decision": "approved" }` |
| `execCommandApproval` / `applyPatchApproval` | `accept_session` | `{ "decision": "approved_for_session" }` |
| `execCommandApproval` / `applyPatchApproval` | `decline` | `{ "decision": "denied" }` |
| `execCommandApproval` / `applyPatchApproval` | `cancel` | `{ "decision": "abort" }` |
| `item/permissions/requestApproval` | `grant_turn` | requested permissions with `scope: "turn"` |
| `item/permissions/requestApproval` | `grant_session` | requested permissions with `scope: "session"` |
| `item/permissions/requestApproval` | `deny` | empty permissions, `scope: "turn"`, `strictAutoReview: true` |
| `item/tool/requestUserInput` | `answer:<value>` | `{ "answers": { "<questionId>": { "answers": ["<value>"] } } }` |
| `mcpServer/elicitation/request` | `accept` | `{ "action": "accept", "content": {}, "_meta": null }` |
| `mcpServer/elicitation/request` | `decline` | `{ "action": "decline", "content": null, "_meta": null }` |
| `mcpServer/elicitation/request` | `cancel` | `{ "action": "cancel", "content": null, "_meta": null }` |

Permission denial note: the generated Codex schema for
`PermissionsRequestApprovalResponse` has no explicit denial enum. VSP returns a
valid empty permission grant for the current turn and enables strict review.

## Automation Profile Mapping

M01 implemented the first frontend/backend/shared-protocol profile mapping, and
M06 made it affect Codex thread/turn request routing:

| VSP Profile | Codex Approval Policy | Sandbox |
|---|---|---|
| full_auto | `never` | `danger-full-access` |
| workspace_auto | `on-failure` | `workspace-write` |
| manual | `untrusted` | `workspace-write` |

All three currently use `approvalsReviewer=user`.

M06 post-QA note: `on-request` is not strict enough for the manual profile
because sandbox-safe commands such as `pwd` can execute without a frontend
approval callback. VSP manual mode therefore uses Codex `untrusted`, while
`workspace_auto` keeps `on-failure`.

Command approval trigger note: `pwd` is not a reliable manual-QA trigger because
Codex may execute sandbox-safe read-only commands directly. A non-mutating
sandbox escape probe such as `cat /root/definitely-not-readable-vsp-coder-m06`
triggers `item/commandExecution/requestApproval` after the sandboxed attempt
fails and Codex asks whether to retry without sandbox.

`thread/start` receives Codex legacy `sandbox` mode. `turn/start` receives
Codex v2 `sandboxPolicy`:

- `danger-full-access` -> `{ "type": "dangerFullAccess" }`
- `read-only` -> `{ "type": "readOnly", "networkAccess": true }`
- `workspace-write` -> `{ "type": "workspaceWrite", "writableRoots": [cwd],
  "networkAccess": true, "excludeTmpdirEnvVar": false,
  "excludeSlashTmp": false }`

`full_auto` does not block normal local use on frontend cards. If Codex still
emits an approval request under `full_auto`, VSP auto-resolves approval cards
server-side. It does not auto-answer tool user-input or MCP elicitation requests.

Local deployment is forced to `full_auto` during C2 local QA. Even if an older
ignored config file or frontend setting tries to select `manual`, backend config
normalization returns `full_auto` for `deploymentMode=local`. Release deployment
can still choose the automation profile through settings.

If a Codex approval request is already open when the config becomes
`full_auto`, the server auto-resolves approval cards using the same
`accept_session`/grant-session response shape used by normal full-auto request
handling. User-input and MCP elicitation requests remain explicit because they
require semantic input rather than permission.

The generated VSP config stores only the chosen profile id and mode values; the
canonical profile definitions come from shared/backend code so frontend and
backend stay consistent.

## Model Mapping

M09 connected the Codex model picker to `model/list`:

- VSP calls `model/list` with `{ includeHidden: false }`.
- Returned Codex models map to provider-neutral `ModelOption` entries with
  `provider=codex`, `model=<model id>`, `label=<displayName or id>`, and
  reasoning choices from `supportedReasoningEfforts`.
- The frontend model dropdown filters options by the current session provider.
  OpenCode/Claude options must not appear inside a Codex session selector.
- Reasoning options must come from `model/list`. If a legacy session still says
  `codex-default` and does not match a returned model id, the UI should use the
  first real Codex option for choices instead of falling back to a local static
  list. If no model options exist at all, the UI may preserve only the current
  session's reasoning value.
- If `model/list` is temporarily unavailable, the fallback Codex pool is
  `gpt-5.5`, `gpt-5.4`, `gpt-5.3-codex`, `gpt-5.2`, and `gpt-5.4-mini`.
  This fallback is operational resilience, not a replacement for app-server
  discovery.

## Self-Protection

When a Codex session cwd is the VSP-Coder server root itself, C2 applies a
self-protection boundary:

- `deploymentMode=local` still uses `full_auto`, but the effective sandbox for
  that cwd is downgraded from `danger-full-access` to `workspace-write`.
- The server injects runtime-derived developer instructions into
  `thread/start` and `thread/resume` telling Codex not to stop, kill, restart,
  or replace the hosting VSP-Coder HTTP server process.
- The guard is derived from the runtime `projectRoot` and HTTP `port`; it does
  not hardcode a user path.
- Other user project cwd values keep the normal selected profile behavior.

## M01 Data-Mode Boundary

`dataMode=codex` hides C1 mock fixtures and leaves the product ready for M03
Codex thread discovery. `dataMode=dev-test` restores the C1 mock sessions for
development and manual UI testing. This keeps mock state available without
shipping fixed demo projects as normal production data.

## Rename Requirement

Rename is valid only if VSP-Coder calls Codex canonical rename and reads the new
name back from Codex after refresh and server restart. A local VSP title cache is
not sufficient.

M09 implementation details:

- Frontend rename uses the provider-neutral session action
  `{ "type": "rename_session", "value": "<new title>" }`.
- Codex backend mapping calls `thread/name/set` with
  `{ "threadId": "<codex thread id>", "name": "<trimmed title>" }`.
- Empty titles are rejected before calling Codex.
- After Codex accepts the rename, VSP invalidates discovery cache, clears the
  session read in-flight guard, and forces `thread/read` with
  `includeTurns: true`.
- The refreshed Codex `thread.name` is mapped back to `Session.title`; this
  canonical provider title wins over any optimistic or local UI title.
- `thread/name/updated` notifications map to a `live_session_patch` with
  `patch.title` and request a session refresh.
- `dataMode=dev-test` may rename local mock sessions for UI development, but
  `dataMode=codex` never treats VSP-local title metadata as canonical.

Persistence evidence required before M09 acceptance:

- Rename only a disposable tmp QA thread.
- Refresh the browser and confirm the new title still comes from Codex.
- Restart the VSP-Coder server and confirm discovery/detail loading still shows
  the same title from Codex canonical state.

Pitfalls:

- Do not rename existing non-tmp Codex history during QA.
- Do not cache a local title override for Codex sessions.
- Do not consider a rename successful until the post-rename `thread/read`
  returns the canonical title.

## Tmp QA Rule

Before C2 acceptance, mutations must be confined to the disposable tmp QA thread.
Existing non-tmp Codex history may be listed or read, but must not be renamed,
archived, or written by the acceptance flow.

M10 tmp fixture behavior:

- `POST /api/qa/tmp-fixture` creates a new directory under `os.tmpdir()` with a
  `vsp-coder-c2-` prefix.
- The generated fixture contains only disposable README/notes/gitignore files
  and returns a final smoke prompt.
- The generated path is runtime output, not a source-code default. Production
  discovery still comes from Codex `cwd` metadata and user selection.

## Known Risks And Handoff Notes

- app-server protocol is experimental and schema may change with Codex CLI
  versions.
- Some events may arrive as raw item completions and require incremental mapping
  refinement.
- Queue state is currently process memory; a VSP server restart preserves Codex
  canonical history but not unsent VSP pending queue items.
- Mobile keyboard behavior may need continued CSS/viewport iteration.
- OpenCode/Claude adapters should implement the same provider-neutral VSP
  contracts and keep their raw protocol mapping in adapter-specific knowledge.

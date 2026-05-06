# Architecture Baseline - VSP-Coder C2

## Project Overview

VSP-Coder is a web-first remote conversation workspace for AI coding backends.
C1 delivered the accepted mock runtime and provider-independent interaction
protocol. C2 replaces the mock default path with a real Codex adapter while
preserving the same browser-facing VSP protocol.

The central principle remains backend ownership. Browser windows observe and
submit intent to the VSP-Coder server. The server is the only component that
starts Codex app-server, queues user messages, routes approvals, interrupts
turns, and maps provider events into stable VSP events.

## Tech Stack

- Language: TypeScript.
- Frontend: React + Vite SPA.
- Backend: Node.js service.
- Realtime to browser: existing VSP SSE event stream.
- Provider transport: Codex `app-server`, preferably internal `stdio://` or
  `unix://`.
- Local VSP metadata: ignored per-instance files under `.vsp-coder/`.
- Codex canonical state: current OS user's Codex storage and app-server APIs.
- Test profile: web app, TDD.

## Runtime Components

- Web app shell: project/session navigation, message workspace, composer,
  right-sidebar workflow/preview/activity surfaces, settings/profile controls.
- VSP API server: stable HTTP/SSE API for browser clients.
- Instance config service: reads/writes ignored deployment config and automation
  profile state.
- Provider registry: selects mock/dev or Codex provider based on runtime mode.
- Codex process manager: starts, supervises, and restarts local
  `codex app-server`.
- Codex JSON-RPC client: typed request/response/notification layer over the
  generated app-server schema.
- Codex adapter: maps Codex threads, turns, items, requests, metrics, diffs,
  errors, and rename operations into the VSP protocol.
- Queue manager: single-driver queue per provider thread; different threads may
  run independently.
- Local metadata store: VSP-only UI selection, QA records, adapter cache, and
  tmp fixture metadata. It must not override Codex canonical thread names.
- Knowledge ledger: durable protocol and mapping notes under
  `.pipeline/knowledge/reference/`.

## Data Flow

1. Browser loads VSP-Coder state from the VSP API.
2. Backend reads ignored instance config and determines deployment mode,
   provider defaults, automation profile, and dev/test visibility.
3. Backend starts or connects to Codex app-server when Codex data is needed.
4. Backend calls `thread/list` and related Codex APIs to discover sessions and
   aggregate projects from `cwd`.
5. User selects or creates a session. Frontend sends intent to VSP API.
6. VSP server starts/resumes a Codex thread with the selected cwd, model,
   approval policy, sandbox, and reviewer profile.
7. User messages enter the VSP queue. The queue manager sends `turn/start` or
   `turn/steer` only when the thread state permits.
8. Codex notifications and server requests are translated into VSP messages,
   events, cards, artifacts, and metrics.
9. Browser windows receive VSP SSE events and refresh shared backend-owned
   state.
10. Rename writes through Codex `thread/name/set`; VSP refreshes canonical
    thread data from Codex.

## Provider-Independent Protocol Boundary

The browser-facing API must not expose raw Codex JSON-RPC as a public contract.
Provider adapters map into VSP concepts:

- `Project`: discovered from provider thread cwd plus local UI metadata.
- `Session`: provider, project, cwd, canonical title, status, model, reasoning,
  approval/sandbox profile, current turn, timestamps, metrics.
- `Message`: normalized user, assistant, system, and tool content blocks with
  provider item references.
- `Event`: status, warnings, errors, usage, file changes, diffs, command output,
  queue changes, and lifecycle notifications.
- `RequestCard`: command approval, file approval, permission request, tool user
  input, MCP elicitation, danger confirmation, and interrupt confirmation.
- `Artifact`: changed files, diffs, preview targets, command summaries, and
  render support level.
- `Metric`: token usage, rate-limit status, duration, and optional cost estimate.

## Configuration Model

C2 introduces a real configuration path:

- Generated local instance config is ignored by git.
- Default local deployment may use full automation and `danger-full-access`.
- Published/deployed instances expose settings for automation level.
- Frontend settings write VSP config; backend applies it to Codex thread start
  and resume paths.
- No user-specific path defaults may be committed.

Initial profile mapping:

| VSP Profile | Codex Approval Policy | Codex Sandbox | Reviewer |
|---|---|---|---|
| full_auto | `never` | `danger-full-access` | user or default |
| workspace_auto | on-failure or granular | `workspace-write` | user or auto_review |
| manual | on-request or granular manual | workspace-write or read-only | user |

Exact mappings may be refined during M01/M06 based on observed app-server
behavior, and any refinement must be recorded in knowledge.

## Security And Safety Boundaries

- Do not hardcode any user-specific home path in production code.
- Use Codex `cwd` metadata and runtime path selection for project discovery.
- Confine VSP file preview/read APIs to the selected project root.
- Tmp QA fixtures are disposable and must be clearly marked dev/test-only.
- Before C2 acceptance, only tmp QA threads may be mutated.
- Browser clients never receive Codex credentials or raw auth state.
- Mock state and production Codex adapter state remain logically separate.

## C2 Milestone Map

1. Configuration, Automation Profiles, And No-Hardcode Baseline.
2. Codex App-Server Client Foundation.
3. Codex Thread And Project Discovery.
4. Thread Start, Resume, Queue, And Steer.
5. Streaming, Event, And Metric Mapping.
6. Approval And Automation Strategy.
7. File Changes, Command Output, And Preview.
8. Interrupt, Queue Controls, And Error Recovery.
9. Rename And Persistence Verification.
10. Tmp QA Harness, Knowledge Finalization, And Acceptance Gate.

## Deferred Work

- Multi-user remote runners and OS-user isolation.
- Browser login/account switching.
- OpenCode and Claude Code adapters.
- Policy-engine audit automation beyond Codex profiles.
- Rich diff editor and terminal emulator.
- Electron and VSCode shells.

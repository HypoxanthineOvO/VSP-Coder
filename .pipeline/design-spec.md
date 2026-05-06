# Design Spec - VSP-Coder C2

## Goal

Build the full Codex adapter for VSP-Coder. C2 connects the C1 backend-owned
message manager and UI contract to real Codex sessions through the official
Codex app-server protocol, while refining the provider-independent VSP protocol
for future OpenCode and Claude Code adapters.

C2 is complete only when a real Codex thread can be discovered, started,
resumed, streamed, interrupted, renamed, and tested end to end from the
VSP-Coder frontend. The final acceptance path uses a disposable tmp project and
manual user acceptance.

## Project Shape

- Project type: TypeScript web app plus Node.js backend daemon.
- Primary deliverable: local web app and backend service with a real Codex
  session adapter.
- Target platform: desktop browser and mobile browser viewport.
- Expected users: developer/operator managing local Codex coding sessions across
  projects.

## Hard Constraints

- Browser clients never speak to Codex directly. They use VSP-Coder HTTP/SSE
  APIs only.
- VSP-Coder server is the single driver for each Codex thread. It owns queue,
  steer, interrupt, approval responses, and session state fan-out.
- Use `codex app-server` as the preferred official integration surface. Do not
  scrape Codex TUI output.
- Prefer internal `stdio://` or `unix://` app-server transport. Do not expose a
  raw Codex WebSocket endpoint to browsers.
- Do not implement browser Codex login, token management, or account switching
  in C2. Reuse the current OS user's working Codex CLI environment.
- Production code must not hardcode user paths. Apart from
  disposable tmp QA fixtures, paths must come from Codex metadata, user
  selection, instance config, environment variables, or runtime discovery.
- Mock and tmp QA data are dev/test-only after C2 acceptance.
- VSP-Coder local metadata must be generated per user/deployment under ignored
  local state, such as `.vsp-coder/`.
- Codex thread names are canonical in Codex storage. VSP-Coder may cache UI
  metadata, but rename must call Codex and read back the stored name.

## Functional Requirements

### Instance Configuration And Automation Profiles

- Add gitignored local instance config for deployment mode and defaults.
- Support at least three automation profiles:
  - Full automation: `approvalPolicy=never`, `sandbox=danger-full-access`.
  - Workspace automation: less permissive approvals, `sandbox=workspace-write`.
  - Manual confirmation: approval/user-input requests route to frontend cards.
- Local deployment defaults to full automation with `danger-full-access`.
- Published/deployed builds expose real settings for automation level. The
  frontend and backend must agree on the selected profile.
- Session header or settings surfaces must show the active approval/sandbox
  profile.

### Codex Process And Protocol Client

- VSP-Coder server starts and supervises a local `codex app-server` child
  process on demand.
- Implement a typed JSON-RPC client around generated app-server TypeScript/schema
  artifacts.
- Surface app-server health, startup failure, disconnect, reconnect/restart, and
  protocol errors to the VSP event stream.

### Project And Session Discovery

- Use Codex `thread/list`, `thread/read`, and `thread/resume` metadata, especially
  `cwd`, to discover real projects and sessions.
- The default homepage after C2 acceptance shows Codex-derived projects and
  sessions, not mock project fixtures.
- If no Codex history exists, show an empty state that can open a local directory
  and create a new Codex thread with that `cwd`.
- Before final C2 acceptance, only tmp QA threads may be mutated. Existing user
  Codex history may be listed/read but must not be renamed, archived, or written
  by the acceptance flow.

### Real Thread And Turn Flow

- Start new Codex threads with selected `cwd`, model/reasoning, approval policy,
  sandbox, and reviewer profile.
- Resume existing Codex threads and load turns/messages through the backend.
- All frontend messages enter the VSP-Coder server queue. The server chooses
  `turn/start`, `turn/steer`, or pending queue behavior based on Codex thread
  state.
- Only one active turn may drive a single Codex thread at a time. Different
  threads may run independently.
- Stream assistant deltas, completed items, status changes, warnings, errors,
  token usage, and rate-limit updates into the VSP protocol.

### Requests, Approvals, And User Input

- Map Codex command execution approvals, file change approvals, permission
  requests, tool user-input requests, MCP elicitations, and compatibility
  approval requests into VSP `RequestCard` objects.
- Manual profile shows frontend approval cards and routes responses back to Codex.
- Full automation profile should not block normal local operation on frontend
  approval cards.
- Keep an audit/event trail for request cards, decisions, and provider errors.

### Files, Commands, Diffs, And Preview

- Show command execution status and output summaries.
- Show file change cards and changed file/diff preview entries.
- Preserve safe project-root confinement for VSP preview/file APIs.
- C2 does not need a full terminal emulator or rich diff editor.

### Rename And Persistence

- Implement real Codex rename through the app-server thread name API.
- The frontend rename flow must refresh canonical data from Codex.
- Rename acceptance must prove the new name persists across frontend refresh and
  VSP-Coder server restart, equivalent to Codex CLI `/rename`.

### Knowledge Capture

- Update knowledge during each Milestone with provider protocol decisions,
  method/event mappings, request-card mappings, rename behavior, tmp QA limits,
  and known pitfalls.
- Final C2 must include:
  - `.pipeline/knowledge/reference/vsp-provider-protocol.md`
  - `.pipeline/knowledge/reference/codex-adapter-mapping.md`

## Testing Expectations

### Automated

- Typecheck/build/test across workspaces.
- Unit tests for instance config, profile mapping, and path hardcode prevention.
- JSON-RPC client tests for request/response/notification plumbing.
- Adapter mapping tests from Codex fixtures to VSP messages/events/cards.
- Backend API tests for discovery, queue behavior, rename request routing, and
  tmp fixture generation.

### Manual

- Each Milestone includes a focused manual check.
- Final acceptance uses a disposable tmp fixture project.
- The user manually follows the QA script from the frontend:
  - set automation profile;
  - inspect real Codex project/session discovery;
  - create a tmp Codex thread;
  - send a small coding prompt;
  - exercise command approval and file change approval;
  - inspect streaming output, changed file preview, token/rate status;
  - interrupt and verify queue behavior;
  - rename the thread and verify persistence across refresh/restart;
  - input `accept`.

## Milestone Strategy

- Proposed milestone count: 10.
- Expected preset: `tdd`.
- Split rationale: first remove C1 demo assumptions and make deployment/profile
  state real, then build the Codex transport, then layer discovery, turns,
  events, approvals, files, controls, rename, and final QA.

## C2 Milestones

1. Configuration, Automation Profiles, And No-Hardcode Baseline
2. Codex App-Server Client Foundation
3. Codex Thread And Project Discovery
4. Thread Start, Resume, Queue, And Steer
5. Streaming, Event, And Metric Mapping
6. Approval And Automation Strategy
7. File Changes, Command Output, And Preview
8. Interrupt, Queue Controls, And Error Recovery
9. Rename And Persistence Verification
10. Tmp QA Harness, Knowledge Finalization, And Acceptance Gate

## Non-Goals

- Multi-user remote runner orchestration.
- Browser-based Codex login or account/token management.
- OpenCode or Claude Code adapters.
- Full policy engine.
- Electron or VSCode shell.
- Rich diff editor.
- Full terminal emulator.

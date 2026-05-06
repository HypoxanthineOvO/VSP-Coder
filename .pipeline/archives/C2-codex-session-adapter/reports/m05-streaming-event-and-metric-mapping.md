# M05 Report - Streaming, Event, And Metric Mapping

- Result: ready for manual QA
- Cycle: C2 Codex Session Adapter
- Milestone: M05

## Delivered

- Added provider-neutral live session patch protocol for streaming updates.
- Added Codex notification mapper for:
  - `item/agentMessage/delta`
  - `item/commandExecution/outputDelta`
  - `item/fileChange/outputDelta`
  - `item/completed`
  - `rawResponseItem/completed`
  - `turn/started`
  - `turn/completed`
  - `thread/status/changed`
  - `thread/tokenUsage/updated`
  - `account/rateLimits/updated`
  - warning and error notifications.
- Wired Codex app-server notifications into the server runtime.
- Added session-cache live patch application for assistant/tool deltas,
  finalized messages, status, active turn id, and metrics.
- Added transient SSE publishing so streaming deltas do not pollute persisted
  Activity history.
- Updated the frontend SSE handler to apply live session patches locally instead
  of refreshing `/api/state` for every delta.
- Extended protocol metric/event types for duration, context window, rate-limit,
  warning, and metric/rate-limit events.
- Ensured Codex item-derived messages carry `providerItemRef`.
- Added fixture tests for deltas, completions, lifecycle, token usage,
  rate limits, warnings, and errors.
- Added `pretest` protocol build for the server package so direct server tests
  pick up protocol type changes.
- Post-QA fix: new Codex sessions are inserted into frontend state immediately
  after `thread/start`, avoiding discovery-cache lag that made the New button
  appear ineffective.
- Post-QA fix: create/send failures now surface as inline UI errors instead of
  being silently swallowed.
- Post-QA fix: `thread not found` send errors invalidate Codex discovery/session
  caches so stale thread ids do not keep poisoning the UI.
- Post-QA fix: frontend state merge now preserves local newly-created Codex
  sessions across discovery refreshes, preventing the active session from
  jumping back while the user types.
- Post-QA fix: New and Send buttons now expose busy/disabled states, and the New
  button has a stable no-wrap width.
- Post-QA fix: Codex model/reasoning selection now uses real Codex session cache
  state instead of mock actions, and selected reasoning is preserved across
  post-send `thread/read` refreshes.
- Post-QA fix: Send/New button coloring now follows the enabled/disabled
  interaction rule: executable actions are bright, inactive or busy actions are
  muted.

## Validation

- `npm run typecheck`: pass
- `npm run build`: pass
- `npm test`: pass
- `npm test -w @vsp-coder/server`: pass
- Post-QA smoke:
  - `POST /api/sessions`: pass
  - `POST /api/sessions/<new-id>`: pass
  - Session detail after completion: 2 messages, status `idle`
- `npm run typecheck -w @vsp-coder/web`: pass after active-session/UI feedback
  fix
- `npm run build -w @vsp-coder/web`: pass after active-session/UI feedback fix
- `npm run typecheck`: pass after reasoning/action fix
- `npm run build`: pass after reasoning/action fix
- `npm test -w @vsp-coder/server`: pass after reasoning/action fix
- Reasoning persistence smoke: switch to `medium`, send message, response still
  reports `medium`.
- Post-QA fix: `/api/state` discovery-list merge now also preserves cached
  Codex `model` and `reasoning`; frontend state merge has the same guard.
- Reasoning state-list persistence smoke: switch to `medium`, send message,
  call `/api/state` immediately and after completion; both keep `medium`.
- Runtime check on `http://localhost:<port>`:
  - Codex provider status: `ready`
  - `GET /api/state` returned `dataMode=codex`, 11 projects, 50 sessions.

## Manual QA Required

M05 still needs a real tmp-thread streaming check before it should be marked
complete. The implementation is deployed on port `4180`; the manual check
should send a small prompt in a disposable thread and confirm streamed assistant
text, final state, token/rate-limit/status updates, and clear error/warning
display where applicable.

## Deferred To M06+

- Approval/user-input request cards are handled in M06.
- Rich command/file rendering and preview artifacts remain in M07.
- Durable active-turn queue and `turn/steer` recovery remain in M08.

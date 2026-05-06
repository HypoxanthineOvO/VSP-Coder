# M04 Report - Thread Start, Resume, Queue, And Steer

- Result: complete
- Cycle: C2 Codex Session Adapter
- Milestone: M04

## Delivered

- Added `thread/read` with `includeTurns: true` for active Codex session detail
  loading.
- Mapped historical Codex thread items into VSP messages.
- Added frontend lazy hydration for selected real Codex sessions through
  `/api/sessions/:id`.
- Added Codex-mode `thread/start` creation path for selected discovered project
  cwd.
- Added Codex-mode send path through `turn/start` with text `UserInput`.
- Preserved mock send/create behavior in `dataMode=dev-test`.
- Added message mapping tests for user, assistant, and command/tool items.
- Post-review fix: selected sessions now scroll to the bottom after full history
  hydration, matching chat-reader expectations.
- Post-review fix: Codex navigation now keeps project and session lists expanded by
  default and adds a global recent-session list so sessions from every discovered
  project remain reachable.
- Post-review fix: mobile layout is constrained to the viewport and long
  terminal/tool text wraps instead of forcing horizontal overflow.
- Post-review fix: mobile session dock now keeps status, model, and reasoning
  on one compact row; the session drawer scrolls through all discovered
  sessions with bottom safe-area padding.
- Post-review fix: Codex session detail loading now uses backend cache,
  in-flight request deduplication, stale-while-revalidate, and top-recent
  prefetch to reduce slow `thread/read` waits.
- Post-review fix: the frontend now shows explicit loading/failure states for
  session hydration and reloads the active session detail when a matching VSP
  SSE update arrives.

## Validation

- `npm run typecheck`: pass
- `npm test`: pass
- `npm run build`: pass
- `npm run typecheck -w @vsp-coder/web`: pass after post-review fix
- `npm run build -w @vsp-coder/web`: pass after post-review fix
- `npm run typecheck -w @vsp-coder/web`: pass after navigation/mobile fix
- `npm run build -w @vsp-coder/web`: pass after navigation/mobile fix
- `npm run typecheck -w @vsp-coder/web`: pass after mobile dock/session drawer
  fix
- `npm run build -w @vsp-coder/web`: pass after mobile dock/session drawer fix
- `npm run typecheck`: pass after session latency fix
- `npm run build`: pass after session latency fix
- `npm test -w @vsp-coder/server`: pass after session latency fix
- Chromium mobile screenshot at 390x844 generated successfully after mobile fix.
- Runtime check on `http://localhost:<port>`:
  - Codex app-server status: `ready`
  - `GET /api/sessions/<recent-thread>` returned 353 mapped messages.
  - Server refreshed safely on port `4180`; Codex provider status restored to
    `ready`.
  - After cache/prefetch fix: `/api/state` cached request measured at 7ms;
    recent prefetched session reads measured mostly at 28-76ms; one deeper
    1706-message session measured 908ms cold and 127ms cached.

## Safety Notes

During implementation validation, existing Codex history was read only. No
manual `turn/start` was sent to a non-tmp thread. The product send path now
exists, but final acceptance should still exercise mutation against a disposable
tmp thread.

## Deferred To M05+

- Streaming assistant deltas and live event updates.
- Codex notification subscription or active-thread polling for sufficiently
  realtime refresh of running turns.
- Durable queue state and active-turn `turn/steer` precondition handling.
- Rich command/file artifact rendering.
- Final tmp fixture creation and manual QA script.

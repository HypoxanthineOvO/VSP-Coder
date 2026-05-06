# M02 Report - Codex App-Server Client Foundation

- Result: complete
- Cycle: C2 Codex Session Adapter
- Milestone: M02

## Delivered

- Added shared `CodexProviderHealth` and provider health status types.
- Added backend `LineJsonRpcClient` for newline-delimited JSON-RPC over stdio.
- Added Codex app-server process manager that starts
  `codex app-server --listen stdio://` on demand.
- Implemented initialize handshake and `initialized` notification.
- Added lifecycle health states: `stopped`, `starting`, `ready`,
  `unavailable`, `crashed`.
- Added backend endpoints:
  - `GET /api/providers/codex/health`
  - `POST /api/providers/codex/start`
  - `POST /api/providers/codex/stop`
- Added provider health events into VSP activity.
- Added frontend Settings provider health card with start action.
- Added JSON-RPC tests for request framing, response matching, notification
  dispatch, JSON-RPC errors, and timeout behavior.
- Updated knowledge with transport, handshake, timeout, and observed startup
  behavior.

## Validation

- `npm run typecheck`: pass
- `npm test`: pass
- `npm run build`: pass
- `GET /api/providers/codex/health`: returned `stopped` before start.
- `POST /api/providers/codex/start`: returned `ready`.

## Observed Runtime

On local Codex CLI `0.128.0`, app-server initialize succeeded over stdio and
returned user agent, Codex home, and platform metadata.

stderr produced a non-fatal plugin sync warning about ChatGPT authentication
being required for remote plugin sync. M02 records this as health `lastError`
for visibility but does not fail the connection when initialize succeeds.

## Deferred To M03+

- Real thread list/read/resume calls.
- Project/session discovery from Codex `cwd`.
- Mapping provider threads into VSP sessions.
- Using app-server client for mutating Codex operations.

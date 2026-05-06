# Debug Report - Codex Session Read Latency

- Time: 2026-05-05 21:38:56 +0800
- Cycle: C2 Codex Session Adapter
- Milestone: M04
- Symptom: selected Codex sessions sometimes took several seconds to load, and
  failed reads were silent in the UI.

## Findings

1. `thread/read` latency is real. Runtime measurements before the fix showed
   selected session reads around 1.5-2.8s for larger threads.
2. The backend did not cache `thread/list` or `thread/read`, so repeated UI
   refreshes and session switches replayed expensive Codex app-server calls.
3. Concurrent reads for the same session were not deduplicated.
4. The frontend swallowed session detail load errors, which made failures look
   like stale empty UI.
5. Current M04 SSE refresh only covers VSP server events; it does not yet stream
   Codex assistant deltas or turn progress.

## Fix Applied

- Added backend discovery cache for `thread/list`.
- Added backend session detail cache for `thread/read` with in-flight
  deduplication and stale-while-revalidate behavior.
- Prefetches the top 3 recent sessions after discovery.
- Extended `thread/read` timeout to 20s for large sessions.
- Frontend now shows session detail loading and failure states.
- Frontend reloads active session detail when a matching VSP session update
  arrives over SSE.

## Validation

- `npm run typecheck`: pass
- `npm run build`: pass
- `npm test -w @vsp-coder/server`: pass
- Runtime after fix:
  - `GET /api/state`: 167ms first measured request, 7ms cached request.
  - Recent prefetched session reads: mostly 28-76ms.
  - Deeper session cold read: 908ms for 1706 messages.
  - Same deeper session cached read: 127ms.

## Realtime Boundary

This fix improves perceived responsiveness and reliability for M04, but it is
not full realtime streaming. M05 should implement Codex live updates using
Codex app-server notifications if available, with active-thread polling as a
fallback.

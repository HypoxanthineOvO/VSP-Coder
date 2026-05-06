# M08 Interrupt, Queue Controls, And Error Recovery

## Objective

Connect real Codex interrupt, pending queue controls, app-server crash/reconnect
behavior, and multi-window state synchronization.

## Context

C1 defined `Kill` as interrupting the active runner/session and `Clear Queue` as
clearing only pending outbound messages. C2 must preserve those semantics for
real Codex sessions.

## Implementation Tasks

- Map frontend interrupt to Codex `turn/interrupt`.
- Preserve confirmation UX for interrupt where appropriate.
- Ensure clear queue only affects pending VSP queue items.
- Add backend recovery handling for app-server crash/disconnect/restart.
- Reconcile session status after reconnect.
- Fan out interrupt, queue, and recovery events to all browser windows.
- Add tests for interrupt/queue semantics and recovery state transitions.

## Guardrails

- Do not terminate the whole app-server when only a turn interrupt is requested.
- Do not clear active Codex turns with clear-queue.
- Avoid destructive process handling in tests; use fakes where possible.

## Automated Validation

- `npm run typecheck`
- `npm test`
- Backend tests for interrupt versus clear queue semantics.
- Recovery tests using fake/disconnected client.

## Manual Validation

- Start a tmp turn, interrupt it from the frontend, and confirm status changes.
- Queue multiple messages and clear pending queue without killing the active
  turn.
- Open two windows and confirm both see the same state.
- Simulate app-server restart if practical and confirm understandable recovery.

## Knowledge Update

Document:

- interrupt semantics;
- queue state machine;
- reconnect/restart behavior;
- any Codex limitations discovered.

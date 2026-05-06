# M04 Thread Start, Resume, Queue, And Steer

## Objective

Start and resume real Codex threads and route all frontend input through the
VSP-Coder server queue into Codex `turn/start` or `turn/steer`.

## Context

The frontend never sends messages directly to Codex. VSP-Coder server is the
single driver for a Codex thread. Same-thread input is serialized by the server;
different threads may run independently.

## Implementation Tasks

- Implement new Codex thread creation for a selected `cwd`.
- Apply selected model/reasoning/profile values to `thread/start`.
- Implement thread resume/read path for existing Codex sessions.
- Map loaded Codex turns into VSP messages.
- Replace mock send path with provider-aware send dispatch.
- Implement per-thread queue state for pending outbound messages.
- Implement `turn/start` for idle/resumed threads.
- Implement `turn/steer` or pending queue behavior for active turns based on
  Codex capabilities.
- Fan out queue/session updates to all subscribed browser windows.

## Guardrails

- Only tmp QA thread creation is allowed for mutation during manual acceptance.
- Do not bypass the backend queue from the frontend.
- Clear queue must only affect pending VSP messages, not active Codex turns.

## Automated Validation

- `npm run typecheck`
- `npm test`
- Backend queue tests for one active turn per thread.
- Adapter tests for start/resume response mapping.
- Multi-window state fan-out tests where practical.

## Manual Validation

- Create a tmp project thread from the frontend.
- Send one simple prompt and confirm the message is queued/sent by VSP server.
- Open a second browser window and confirm shared session/queue state.
- Resume the tmp thread and confirm messages reload from Codex.

## Knowledge Update

Document:

- thread/start parameters;
- resume/read strategy;
- turn/start versus turn/steer rules;
- queue state transitions.

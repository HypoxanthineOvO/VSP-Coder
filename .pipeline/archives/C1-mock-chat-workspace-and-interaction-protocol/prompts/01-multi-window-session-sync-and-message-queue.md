# M02 - Multi-Window Session Sync And Message Queue

## Objective

Implement backend-owned mock session state, real-time event synchronization, message sending, queued outbound messages, and clear-queue semantics across multiple browser clients.

## 需求

- Store mock sessions, messages, connection state, and outbound queue state in the backend mock runtime.
- Add WebSocket or SSE event fan-out so multiple browser windows observe the same session.
- Implement composer send flow from frontend to backend while preserving message metadata.
- Show queue length/status in the UI.
- Add `Clear Queue` behavior that clears pending outbound messages only and does not interrupt active work.
- Ensure a phone-sized viewport can participate in the same session.

## Boundaries

- In scope: sync/event API, message list rendering, composer send, queue reducer/store, connection status UI.
- Use the shared VSP protocol types from M01.
- Keep queue semantics provider-independent.

## Non-Goals

- No real provider queue draining.
- No true cross-user Linux runner ownership.
- No approval cards yet except simple placeholders if needed for state shape.

## 预期测试

- Two desktop browser windows on the same session stay synchronized.
- Sending a message from one window appears in the other without reload.
- Queued messages are visible.
- `Clear Queue` removes queued outbound messages and leaves the current session running.
- Mobile viewport can send and receive messages in the same session.
- Backend tests cover queue operations and event fan-out where practical.

## Validation Commands

- Run backend tests for session/queue/event APIs.
- Run frontend build/typecheck/tests.
- Start the app and manually verify two-window sync plus mobile viewport behavior.

## Evidence

- Record automated test output.
- Record manual two-window and mobile sync observations.
- Note whether WebSocket or SSE was chosen and why.

## Human QA

- User should open two windows and see state update in both.
- User should send from one window and confirm the other updates.
- User should clear queued messages and confirm active session state is not interrupted.

## 预期产出

- Real-time sync/event API.
- Queue state and UI.
- Message send/render flow.
- Tests for queue and event behavior.

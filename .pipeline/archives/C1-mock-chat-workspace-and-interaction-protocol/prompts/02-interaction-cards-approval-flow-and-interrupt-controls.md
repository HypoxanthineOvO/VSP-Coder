# M03 - Interaction Cards, Approval Flow, And Interrupt Controls

## Objective

Add mock approval/request cards, contextual card display, composer action menu, Kill/Interrupt confirmation, event logging, and the `开始测试` scripted interaction flow.

## 需求

- Render approval/request cards only when needed.
- Support mock card actions such as approve, deny, ask/provide input, and dismiss where appropriate.
- Add composer action menu items:
  - upload image mock
  - upload file mock
  - switch model mock
  - clear queue
  - Kill/Interrupt with confirmation
- Define `Kill` as interrupting the current mock runner/session and requiring confirmation.
- Log all card and action outcomes as session events.
- Implement a `开始测试` trigger that emits the planned C1 interaction script.
- Every clicked card/action should produce a visible mock confirmation message.

## Boundaries

- In scope: frontend card components, action menu, backend mock script/events, event log model.
- Keep all actions mock-only but preserve future provider adapter event shapes.
- Approval cards are contextual, not a permanently reserved layout band.

## Non-Goals

- No real file upload persistence.
- No real provider approval execution.
- No auto-approve policy engine.
- No production permission model.

## 预期测试

- Sending `开始测试` emits all required mock cards/actions.
- Approval cards appear only when relevant.
- Clicking approve/deny/ask-style controls writes visible confirmation messages.
- Kill opens confirmation before emitting interrupt event.
- Clear Queue still behaves according to M02 semantics.
- Event log records card/action results.

## Validation Commands

- Run automated tests for card/action reducers and backend mock script if available.
- Run frontend build/typecheck/tests.
- Start app and manually execute the `开始测试` flow.

## Evidence

- Record automated test output.
- Record the manual checklist result for each mock card/action.
- Mention any interaction that was deferred.

## Human QA

- User manually clicks through every card/action produced by `开始测试`.
- User confirms Kill requires explicit confirmation.
- User confirms approval cards do not occupy permanent empty space.

## 预期产出

- Interaction card component set.
- Composer action menu.
- Mock interaction script.
- Event log model and UI.
- Manual QA checklist seed.

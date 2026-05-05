# M06 - C1 Manual QA Harness And Acceptance Polish

## Objective

Package C1 into a usable acceptance flow with the scripted interaction test, desktop/mobile polish, persistent mock QA results, and a clear pass/fail report.

## 需求

- Build a manual QA checklist UI for the `开始测试` interaction flow.
- Persist mock QA run records in the isolated mock storage namespace.
- Add desktop responsive polish and mobile safe-area handling.
- Add empty/loading/error states for major panels.
- Ensure app run/test instructions are available.
- Produce a C1 acceptance report summarizing evidence and deferred work.

## Boundaries

- In scope: QA harness, saved QA records, responsiveness polish, docs/runbook updates, final C1 report.
- Preserve the mock/prod storage separation.
- Use the already implemented mock runtime and UI surfaces.

## Non-Goals

- No Codex adapter.
- No real provider costs.
- No production login.
- No auto-approve policy engine.

## 预期测试

- User can start a QA run.
- User can click through all scripted interactions.
- User can mark each item pass/fail.
- QA results are saved and visible after refresh/reopen.
- Desktop and mobile viewports have no incoherent overlap.
- App can be started by documented commands.

## Validation Commands

- Run full automated test suite.
- Run build/typecheck/lint.
- Start app and complete a manual QA run.

## Evidence

- Record automated command output.
- Save a QA run record.
- Produce a C1 acceptance report with pass/fail details and known deferred work.

## Human QA

- User manually completes the QA checklist and reports whether C1 is acceptable.
- User checks both desktop and mobile viewport behavior.

## 预期产出

- QA harness UI.
- Saved mock QA records.
- README/runbook updates.
- C1 acceptance report.

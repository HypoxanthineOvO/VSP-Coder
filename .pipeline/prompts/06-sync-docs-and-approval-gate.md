# M07 - Sync, Docs, And Approval Gate

## Objective

Run Hypo-Workflow sync and docs flows after C1 implementation, refresh project documentation, then stop at a user approval gate before closing C1.

## 需求

- Run `/hw:sync` or the local equivalent needed to refresh derived workflow context and health metadata.
- Run `/hw:docs` or the local equivalent needed to generate/check/repair documentation.
- Refresh README/runbook and architecture notes where documentation automation indicates drift.
- Produce a final C1 summary that references implementation evidence, QA result, sync/docs output, and deferred work.
- Stop and explicitly ask the user to approve or reject C1.

## Boundaries

- In scope: workflow sync, docs check/repair, final summary, approval gate status.
- This milestone should not change product behavior unless documentation or derived metadata requires tiny repair edits.
- Keep generated docs aligned with the actual implemented commands and app shape.

## Non-Goals

- Do not start C2 automatically.
- Do not add real provider adapters.
- Do not hide failing sync/docs checks; report actionable repair guidance.

## 预期测试

- Sync completes or reports actionable repair guidance.
- Docs completes or reports actionable documentation gaps.
- Documentation names how to run, test, and manually QA C1.
- Final state clearly asks the user to approve or reject C1.

## Validation Commands

- Run the project's full automated test suite.
- Run `/hw:sync` or its local equivalent.
- Run `/hw:docs` or its local equivalent.
- Re-run any docs/tests affected by documentation changes.

## Evidence

- Record sync output.
- Record docs output.
- Record final test/build output.
- Write final C1 summary and approval request.

## Human QA

- User reviews final docs and C1 summary.
- User explicitly accepts or rejects C1.

## 预期产出

- Sync/doc command evidence.
- Refreshed documentation.
- Final C1 summary.
- Approval gate status.

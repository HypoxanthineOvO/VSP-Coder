# M05 - Hypo-Workflow Sidebar And Project File API

## Objective

Add the right-sidebar Hypo-Workflow tab backed by safe local project file reads for `.pipeline/` and `.plan-state/`, showing plan progress, config, architecture, and knowledge references.

## 需求

- Implement a backend project file API confined to the active `projectRoot`.
- Reject path traversal and attempts to read outside the project root.
- Add a right-sidebar `Workflow` tab.
- For the current VSP-Coder project, show:
  - `.pipeline/config.yaml`
  - `.pipeline/state.yaml`
  - `.pipeline/cycle.yaml`
  - `.pipeline/design-spec.md`
  - `.pipeline/architecture.md`
  - `.plan-state/discover.yaml`
  - `.plan-state/decompose.yaml`
  - `.pipeline/knowledge/reference/provider-interface-notes.md`
- Show readable empty/error states when files are missing.
- Add project/session switching entry points wired to active project context.
- Mobile should be able to open switching from the top bar.

## Boundaries

- In scope: safe file API, Workflow sidebar tab, project/session switch UI, path confinement tests.
- The sidebar can summarize file content rather than fully render every format.
- Keep API project-root confined and provider-independent.

## Non-Goals

- No full Markdown/PDF/HTML renderer.
- No cross-user project access.
- No production auth.
- No arbitrary filesystem browser outside project roots.

## 预期测试

- Workflow tab displays real planning/progress data from this repository.
- File read errors are understandable.
- Attempts to read outside project root are rejected by tests.
- Mobile top bar can open project/session switching UI.
- Current project context updates the Workflow tab.

## Validation Commands

- Run backend tests for path confinement and file reads.
- Run frontend build/typecheck/tests.
- Start app and manually inspect the Workflow tab for this repository.

## Evidence

- Record path confinement test output.
- Record files shown in Workflow tab.
- Note mobile switching verification.

## Human QA

- User should inspect Workflow tab and confirm it reflects current `.pipeline`/`.plan-state`.
- User should try mobile switching entry.

## 预期产出

- Safe project file API.
- Workflow sidebar tab.
- Project/session switch UI.
- Path confinement tests.

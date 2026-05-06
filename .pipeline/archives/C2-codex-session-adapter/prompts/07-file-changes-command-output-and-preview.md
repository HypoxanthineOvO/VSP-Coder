# M07 File Changes, Command Output, And Preview

## Objective

Surface real Codex command output summaries, file changes, diffs, and preview
targets in the existing VSP-Coder UI.

## Context

C2 does not need a full terminal emulator or rich diff editor. It must provide
enough visibility for a user to understand what Codex ran and what files changed
inside the selected project root.

## Implementation Tasks

- Map command execution item/status/output into VSP events or artifacts.
- Show command running/completed/failed status and output summary.
- Map Codex file change/diff notifications into VSP artifacts.
- Add changed file/diff preview entries in the right sidebar.
- Reuse or strengthen project-root confinement for preview reads.
- Add clear unsupported/large preview states.
- Add tests for path confinement and artifact mapping.

## Guardrails

- Do not allow preview reads outside the selected project root.
- Do not build a full terminal emulator in C2.
- Do not build a rich diff editor in C2.
- Avoid hardcoded fixture paths outside tmp QA generation.

## Automated Validation

- `npm run typecheck`
- `npm test`
- Artifact mapping tests for command output and file changes.
- Path confinement tests for preview APIs.

## Manual Validation

- Use tmp prompt that causes a safe command and small file edit.
- Confirm command status/output summary appears.
- Confirm changed file and diff/preview surface appears.
- Confirm outside-root preview attempts fail.

## Knowledge Update

Document:

- command output shape;
- file change artifact shape;
- preview safety rules;
- limitations deferred after C2.

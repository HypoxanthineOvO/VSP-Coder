# M10 Tmp QA Harness, Knowledge Finalization, And Acceptance Gate

## Objective

Package the disposable tmp QA project, final manual walkthrough, complete
knowledge protocol docs, and stop at the explicit user acceptance gate.

## Context

C2 acceptance is manual. The user will operate the frontend against a disposable
tmp project, verify the full Codex path, then input `accept` or reject with
feedback.

## Implementation Tasks

- Add a disposable tmp fixture generator for final QA.
- Make tmp fixture clearly marked and isolated from real projects.
- Produce a final manual QA script in the app or docs/report.
- Ensure the script covers:
  - automation profile selection;
  - real Codex project/session discovery;
  - tmp project thread creation;
  - real prompt send and streaming response;
  - command approval and file-change approval;
  - command output and changed file preview;
  - token/rate/status;
  - interrupt and pending queue behavior;
  - real rename persistence across refresh/restart.
- Finalize provider protocol and Codex mapping knowledge docs.
- Produce final C2 report with tests, manual QA evidence, deferred work, and
  explicit accept/reject prompt.

## Guardrails

- Do not mutate non-tmp Codex threads as part of final QA.
- Do not leave tmp fixture paths hardcoded in production defaults.
- Do not mark C2 complete without explicit user acceptance.

## Automated Validation

- `npm run typecheck`
- `npm test`
- `npm run build`
- Tmp fixture generation tests.
- Final no-hardcoded-user-path check.

## Manual Validation

The user follows the final QA script in the frontend and enters `accept` only
after the complete flow passes.

## Knowledge Update

Finalize:

- `.pipeline/knowledge/reference/vsp-provider-protocol.md`
- `.pipeline/knowledge/reference/codex-adapter-mapping.md`

Include final known limitations and handoff notes for OpenCode/Claude adapter
planning.

# M06 Approval And Automation Strategy

## Objective

Map Codex approval/user-input requests into VSP request cards and ensure
automation profiles materially affect Codex request routing.

## Context

C2 must cover both local full automation and release-style manual settings.
Manual profile needs real frontend cards. Full automation should be usable
locally without repeated approvals.

## Implementation Tasks

- Map command execution approval requests to VSP command approval cards.
- Map file change approval requests to VSP file-change approval cards.
- Map permission requests, tool user-input requests, and MCP elicitations.
- Route frontend card decisions back to Codex with the correct response shape.
- Ensure automation profile selection affects thread start/resume behavior.
- Record request decisions in VSP events/activity.
- Add UI states for pending, resolved, denied, failed, and expired requests.
- Add tests for request mapping and response mapping.

## Guardrails

- Do not silently auto-approve in manual profile.
- Do not block normal local full-auto usage on frontend cards.
- Do not mutate non-tmp Codex threads in manual QA before acceptance.

## Automated Validation

- `npm run typecheck`
- `npm test`
- Request-card mapping fixture tests.
- Profile behavior tests for manual and full-auto modes.
- Backend tests for card resolution and event logging.

## Manual Validation

- In manual profile, use tmp prompt to trigger a safe command approval.
- Approve/deny from frontend and confirm Codex receives the response.
- Trigger a file-change approval and confirm card content is understandable.
- Switch to full-auto profile and confirm normal local operation does not wait
  on frontend approval cards.

## Knowledge Update

Document:

- exact Codex request to VSP card mapping;
- response payloads;
- profile effects;
- known approval edge cases.

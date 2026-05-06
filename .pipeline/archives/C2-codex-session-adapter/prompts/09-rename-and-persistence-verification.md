# M09 Rename And Persistence Verification

## Objective

Implement real Codex thread rename and prove that the new name persists in Codex
canonical storage across refresh and VSP-Coder server restart.

## Context

Rename must be equivalent to Codex CLI `/rename`. A local VSP title override is
not sufficient. The frontend should display the canonical name read back from
Codex.

## Implementation Tasks

- Add frontend rename action for Codex sessions.
- Route rename through backend provider API.
- Call Codex `thread/name/set`.
- Refresh the thread/session from Codex after rename.
- Remove or demote any VSP local title cache for Codex canonical names.
- Add restart/refresh verification support for tmp QA.
- Add tests for rename request routing and canonical refresh.

## Guardrails

- Before acceptance, only rename the disposable tmp QA thread.
- Do not rename existing user Codex history in tests or QA.
- Do not treat local VSP metadata as canonical title.

## Automated Validation

- `npm run typecheck`
- `npm test`
- Backend tests for rename routing with a fake Codex client.
- Mapping tests proving canonical title refresh wins over local UI metadata.

## Manual Validation

- Rename the tmp Codex thread from the frontend.
- Refresh the browser and confirm the new name remains.
- Restart VSP-Coder server and confirm the thread list/read still shows the new
  name from Codex.
- Optionally compare behavior with Codex CLI `/rename` expectations.

## Knowledge Update

Document:

- exact rename method and params;
- canonical title refresh rules;
- persistence evidence;
- pitfalls around local cache.

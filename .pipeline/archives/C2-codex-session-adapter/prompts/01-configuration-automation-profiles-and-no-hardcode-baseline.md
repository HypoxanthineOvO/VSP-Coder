# M01 Configuration, Automation Profiles, And No-Hardcode Baseline

## Objective

Create the real VSP-Coder instance configuration path, make automation profiles
usable end to end, remove production hardcoded user paths, and move C1 mock/tmp
fixtures behind dev/test mode.

## Context

C2 must not ship with user-specific paths. After C2
acceptance, normal mode should default to real Codex-derived projects and
sessions. Mock sessions and tmp QA fixtures remain available only for
development/testing.

Local deployment may default to full automation with `danger-full-access`.
Published/deployed instances must expose real automation choices.

## Implementation Tasks

- Add ignored local instance config under `.vsp-coder/`.
- Add a typed config model to the shared/backend protocol as needed.
- Support at least:
  - `deploymentMode`: local or release.
  - `automationProfile`: full_auto, workspace_auto, manual.
  - Codex approval/sandbox/reviewer mapping inputs.
- Add backend APIs to read/update the config.
- Add frontend settings UI for profile selection.
- Show active profile/sandbox state in the session header or settings surface.
- Remove production hardcoded local paths and fixed demo project lists.
- Keep mock provider/session data available only under dev/test mode.
- Add a no-hardcoded-user-path check for production source paths.
- Update knowledge with final M01 profile mapping decisions.

## Guardrails

- Do not edit protected workflow state files unless explicitly requested.
- Do not hardcode the current user's home path.
- Do not remove mock code entirely; isolate it behind dev/test mode.
- VSP local config is VSP metadata only. It must not replace Codex canonical
  thread data.

## Automated Validation

- `npm run typecheck`
- `npm test`
- Focused tests for config load/save defaults.
- Focused tests for automation profile mapping.
- Focused scan/test proving production code has no user-home hardcode.

## Manual Validation

- Start the app in local mode and confirm the default profile is full automation
  with `danger-full-access`.
- Switch to manual profile in the frontend and confirm backend state changes.
- Confirm mock/tmp entries are hidden in normal mode and visible in dev/test
  mode.
- Confirm no fixed demo project paths appear in normal project navigation.

## Knowledge Update

Update:

- `.pipeline/knowledge/reference/vsp-provider-protocol.md`
- `.pipeline/knowledge/reference/codex-adapter-mapping.md`

Record exact profile names, config file path, default behavior, and any
remaining follow-up risks.

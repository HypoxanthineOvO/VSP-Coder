# M01 Report - Configuration, Automation Profiles, And No-Hardcode Baseline

- Result: complete
- Cycle: C2 Codex Session Adapter
- Milestone: M01

## Delivered

- Added shared protocol types for deployment mode, data mode, automation
  profiles, Codex approval policy, sandbox mode, reviewer, and app config.
- Added ignored local VSP config at `.vsp-coder/config.json`.
- Added backend config read/update support through `/api/config`.
- Implemented three stable automation profiles:
  - `full_auto`: `approvalPolicy=never`, `sandbox=danger-full-access`.
  - `workspace_auto`: `approvalPolicy=on-failure`, `sandbox=workspace-write`.
  - `manual`: initially `approvalPolicy=on-request`, later tightened in M06 to
    `approvalPolicy=untrusted`, `sandbox=workspace-write`.
- Added frontend Settings tab with deployment mode, data mode, and automation
  profile controls.
- Added session status display for active profile and sandbox.
- Removed production hardcoded demo project paths.
- Replaced hardcoded skill paths with a relative/default skill root that can be
  overridden by `VSP_SKILL_ROOT`.
- Hid C1 mock sessions in normal `dataMode=codex`; restored them only in
  `dataMode=dev-test` or `VSP_DEV_FIXTURES=1`.
- Added tests for config defaults, profile stability, dev-test visibility, and
  production source no-hardcoded-user-path scanning.
- Updated provider protocol and Codex mapping knowledge.

## Validation

- `npm run typecheck`: pass
- `npm test`: pass
- `npm run build`: pass
- `rg -n "<user-home>" apps packages`: no production source matches

## Manual Check Notes

M01 can be manually checked by opening the Settings tab:

- default local config should show `full_auto`;
- full-auto profile should show `never` and `danger-full-access`;
- switching data mode to `dev-test` should show C1 mock sessions;
- switching data mode back to `codex` should hide mock sessions.

## Deferred To M02+

- Real Codex app-server health and availability.
- Applying the selected profile to real `thread/start`.
- Real Codex session discovery from `cwd`.

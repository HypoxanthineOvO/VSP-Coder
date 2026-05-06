# M03 Report - Codex Thread And Project Discovery

- Result: complete
- Cycle: C2 Codex Session Adapter
- Milestone: M03

## Delivered

- Added read-only Codex discovery through `thread/list`.
- Added mapping from Codex thread metadata to VSP sessions.
- Added aggregation from Codex thread `cwd` metadata to VSP projects.
- Added stable project ids derived from cwd hashes instead of fixed project
  fixtures.
- Connected normal `dataMode=codex` `/api/state` and `/api/projects` to real
  Codex discovery.
- Kept C1 mock sessions hidden outside `dataMode=dev-test`.
- Adjusted frontend project selection when discovered projects replace the old
  default id.
- Allowed Workflow panel lookups to use discovered project paths.
- Added mapping tests for cwd aggregation and empty-cwd filtering.

## Validation

- `npm run typecheck`: pass
- `npm test`: pass
- `npm run build`: pass
- Runtime check on `http://localhost:<port>/api/state`:
  - Codex app-server status: `ready`
  - project count: 11
  - session count: 50

## Safety Notes

M03 does not mutate existing Codex history. It uses read-only discovery only.
Runtime API responses may contain absolute paths from the local machine because
they are Codex `cwd` metadata, not committed source defaults.

## Deferred To M04+

- Starting a new Codex thread.
- Resuming and reading full turn content.
- Opening a new local directory without existing Codex history.
- Queueing frontend input into `turn/start` or `turn/steer`.

# M03 Codex Thread And Project Discovery

## Objective

Use real Codex thread metadata to discover sessions and aggregate projects from
`cwd`, replacing mock-default project/session navigation.

## Context

Codex generated schema exposes `thread/list`, `thread/read`, `thread/resume`,
and conversation summaries with `cwd`. Existing non-tmp Codex threads may be
listed and read before acceptance, but must not be mutated by the C2 QA flow.

## Implementation Tasks

- Add Codex thread list/read calls through the provider client.
- Map Codex thread summaries into VSP `Session` objects.
- Aggregate `Project` objects from unique Codex `cwd` values.
- Add pagination/search/filter handling as needed for first usable discovery.
- Add an empty state for users with no Codex history.
- Add "open local directory/create new thread" entry point for new projects,
  without hardcoded paths.
- Keep mock project/session navigation hidden outside dev/test mode.
- Preserve active VSP UI selection in ignored local metadata only.

## Guardrails

- Do not rename, archive, start turns, or otherwise mutate non-tmp Codex threads.
- Do not infer projects from fixed local paths.
- Do not expose Codex raw thread JSON directly to browser components.

## Automated Validation

- `npm run typecheck`
- `npm test`
- Adapter mapping tests from Codex thread fixtures to VSP projects/sessions.
- Backend tests for cwd aggregation and empty state behavior.

## Manual Validation

- Open the app and confirm real Codex sessions/projects appear from current
  Codex history.
- Confirm project paths match Codex `cwd` metadata.
- Confirm no C1 fixed demo projects appear in normal mode.
- Confirm selecting a session does not mutate it.

## Knowledge Update

Document:

- thread/list parameters used;
- cwd aggregation rules;
- read-only pre-acceptance rule;
- any missing metadata or fallback behavior.

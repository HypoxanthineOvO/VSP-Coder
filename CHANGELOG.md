# Changelog

## v0.2.0 - 2026-05-06

### Features

- Connected VSP-Coder to real Codex sessions through the Codex app-server adapter.
- Added Codex project/session discovery, thread hydration, new thread creation, queued message sending, and interrupt handling.
- Added real Codex rename persistence through the provider adapter.
- Added live assistant/tool event mapping, approval handling, command/file-change artifacts, and Subagent trace visibility.
- Added Markdown, math, safe HTML, command collapse, simple/detail display modes, and mobile/desktop interaction polish.
- Added a provider-neutral backend protocol document for future adapters.

### Deployment

- Added `npm run deploy:local`, which builds the app, selects an available local port, starts the server, waits for health, and writes runtime metadata under `.vsp-coder/`.
- Made host and port configurable with `HOST`, `PORT`, and `VSP_CODER_PORT`.
- Removed release-facing user-specific paths and fixed-port deployment assumptions.

### Validation

- Passed typecheck, tests, build, hardcode scan, local deployment smoke, docs checks, and Hypo-Workflow sync check for the C2 release candidate.

## v0.1.0 - 2026-05-05

### Features

- Added the C1 VSP-Coder mock workbench with desktop and mobile layouts.
- Added project/session navigation, recent activity, mock conversation state, and composer interactions.
- Added approval cards, QA pass/fail state, interrupt confirmation, refresh, new-session, and upload-menu mock actions.
- Added Hypo-Workflow sidebar rendering for progress, compact Markdown, config, architecture, and knowledge entries.
- Added provider/model/reasoning switching UI with Codex, OpenCode, and Claude Code mock mappings.
- Added desktop column resizing and mobile approval sheet behavior.

### Documentation

- Added README, user guide, developer guide, API reference, and release changelog.

### Known Deferred Work

- Real OpenCode and Claude Code backend adapters are not implemented yet.
- File upload, resource opening, session rename, and persistent project discovery remain mock or placeholder flows.

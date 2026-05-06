# User Guide

VSP-Coder opens directly into the Codex workbench. There is no landing page; the first screen is the working UI.

## Desktop

- Use the left rail to switch recent Sessions, recent Projects, and inspect Activity.
- Use the Session rail to browse sessions in the current project or create a new Codex thread.
- Drag the vertical handles between columns to adjust panel widths.
- Use the top status bar to switch Codex model, reasoning strength, and simple/detailed tool display.
- Use the right rail tabs for Workflow, Artifacts, Skill/Command preview, and Settings.

## Mobile

- Tap the top-left menu to open Project, Session, and Activity navigation.
- Recent Sessions are shortened by default so Activity remains reachable.
- Model, reasoning, and simple/detailed controls live in the compact dock below the mobile title bar.
- Pending approvals open as a bottom sheet so conversation context remains readable.

## Codex Sessions

In Codex mode, VSP-Coder discovers Codex threads from Codex app-server metadata.

Supported C2 actions:

- open existing Codex sessions and hydrate full message history;
- create new Codex sessions in discovered project directories;
- send messages to existing sessions;
- queue outbound messages while a turn is busy;
- interrupt an active turn;
- rename Codex sessions using Codex canonical thread naming;
- preview command and file-change artifacts.

## Display Modes

Simple mode hides tool and file-change details while keeping the active thinking/working indicator.

Detailed mode shows tool traces, file-change notices, command-output collapsers, and subagent trace rows when Codex exposes them.

## Workflow Panel

When a project has `.pipeline/` files, the Workflow tab shows:

- milestone progress;
- compact current-plan Markdown;
- editable config items with clear user-facing behavior;
- read-only Architecture and Knowledge entry points.

When no Hypo-Workflow files are present, the panel falls back to general project status.

## Deployment

For normal local use:

```bash
npm install
npm run build
npm start
```

For an automatically selected free port:

```bash
npm run deploy:local
```

The deployment helper prints local and LAN URLs and writes runtime details under `.vsp-coder/`.

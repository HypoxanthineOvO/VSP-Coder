# User Guide

VSP-Coder opens directly into the workbench. There is no landing page; the first screen is the working UI.

## Desktop

- Use the left rail to switch recent Projects and inspect Activity.
- Use the Session rail to switch recent Sessions or create a new one.
- Drag the vertical handles between columns to adjust panel widths.
- Use the top status bar in the conversation to switch provider/model and reasoning strength.
- Use the right rail tabs for Workflow, Skill/Command preview, and Activity.

## Mobile

- Tap the top-left menu to open Project, Session, and Activity navigation.
- Recent Sessions are shortened by default so Activity remains visible sooner.
- The model and reasoning controls live in the compact dock below the mobile title bar.
- Pending approvals open as a bottom sheet so the conversation context remains readable.

## Workflow Panel

When a project has `.pipeline/` files, the Workflow tab shows:

- milestone progress;
- compact current-plan Markdown;
- editable config items that have clear user-facing behavior;
- read-only Architecture and Knowledge entry points.

When no Hypo-Workflow files are present, the panel falls back to general project status.

## Provider Switching

The model selector sends `provider`, `model`, and `reasoning` to the mock backend through `switch_model`.

Current provider entries:

- Codex
- OpenCode
- Claude Code

OpenCode and Claude Code are mock mappings in v0.1.0. The UI contract is present, but real backend runner switching is deferred.

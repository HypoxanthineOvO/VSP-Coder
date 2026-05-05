# M04 - Skill, Command, File Mentions, And Preview Surface

## Objective

Implement composer autocomplete and message rendering for Skill, Command, and file structured tokens, plus a right-sidebar preview/detail surface.

## 需求

- Autocomplete skills, slash commands, and local project files while typing.
- Insert selected autocomplete items as structured chips/tokens in the message draft.
- Preserve token metadata when sending and receiving messages.
- Render Skill/Command/file mentions as clickable chips in the message stream.
- Clicking a chip opens a preview/detail surface in the right sidebar.
- The preview surface should show type, name, path/source, metadata, and placeholder preview body for complex formats.
- C1 must not execute a command just because the user clicks a chip.

## Boundaries

- In scope: autocomplete UI, token schema, token serialization, message chip rendering, preview/detail panel.
- Local file inventory may be mock or safe API-backed, as long as C1 demonstrates the final interaction shape.
- Preserve compatibility with future Codex `skills/list` and project file APIs.

## Non-Goals

- No full PDF/HTML rendering.
- No real command execution.
- No Codex `skills/list` adapter integration.
- No destructive file operations.

## 预期测试

- Typing trigger text opens autocomplete.
- Selecting an item inserts a chip/token into the composer draft.
- Sending preserves token metadata.
- Message history renders tokens as chips.
- Clicking a chip opens the preview/detail panel.
- Token click does not execute the command.

## Validation Commands

- Run token serialization tests.
- Run frontend build/typecheck/tests.
- Start app and manually compose a message with Skill/Command/file mentions.

## Evidence

- Record automated test output.
- Record manual evidence that token metadata survived send/receive.
- Record preview panel behavior.

## Human QA

- User should try at least one Skill mention, one slash command, and one file mention.
- User should confirm click opens preview/detail rather than execution.

## 预期产出

- Autocomplete UI.
- Structured message token schema.
- Message chip renderer.
- Preview/detail panel.
- Token serialization tests.

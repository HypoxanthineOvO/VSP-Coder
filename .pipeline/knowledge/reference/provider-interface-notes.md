# Provider Interface Notes

Updated: 2026-05-04 22:55 +08:00

This note is the local first-read reference for VSP-Coder provider integration planning. Prefer this file and generated local schemas before searching online again.

## Local Generated Artifacts

- Codex CLI version checked locally: `codex-cli 0.128.0`
- Codex app-server TypeScript bindings: `.pipeline/knowledge/generated/codex-app-server/ts/`
- Codex app-server JSON Schemas: `.pipeline/knowledge/generated/codex-app-server/json-schema/`
- Regenerate with:

```bash
codex app-server generate-ts --out .pipeline/knowledge/generated/codex-app-server/ts
codex app-server generate-json-schema --out .pipeline/knowledge/generated/codex-app-server/json-schema
```

## Codex

Official entry points:

- Codex docs: `https://developers.openai.com/codex/`
- Codex SDK: `https://developers.openai.com/codex/sdk/`
- Codex GitHub: `https://github.com/openai/codex`

Local CLI integration surfaces:

- `codex app-server`: experimental app server with `stdio://`, `unix://`, and `ws://IP:PORT` listeners.
- `codex exec-server`: standalone websocket exec server.
- `codex mcp-server`: stdio MCP server.
- CLI auth, config, history, and session state are user-scoped under the executing user's `~/.codex`.

Important app-server request methods from generated schema:

- Thread/session: `thread/start`, `thread/resume`, `thread/fork`, `thread/list`, `thread/read`, `thread/turns/list`, `thread/name/set`, `thread/archive`, `thread/unarchive`.
- Turn control: `turn/start`, `turn/steer`, `turn/interrupt`.
- Skills/plugins: `skills/list`, `skills/config/write`, `plugin/list`, `plugin/read`, `plugin/install`, `plugin/uninstall`, marketplace operations.
- Filesystem: `fs/readFile`, `fs/writeFile`, `fs/readDirectory`, `fs/watch`, `fs/unwatch`, `fs/remove`, `fs/copy`.
- Terminal/exec: `command/exec`, `command/exec/write`, `command/exec/terminate`, `command/exec/resize`.
- Models/config/account: `model/list`, `modelProvider/capabilities/read`, `config/read`, `config/value/write`, `account/read`, `account/rateLimits/read`.

Important app-server notifications/events:

- Messages and output: `item/agentMessage/delta`, `rawResponseItem/completed`, `item/completed`, `turn/started`, `turn/completed`.
- Status and errors: `thread/status/changed`, `error`, `warning`, `guardianWarning`, `configWarning`, `model/rerouted`, `model/verification`.
- Files and diffs: `turn/diff/updated`, `item/fileChange/patchUpdated`, `fs/changed`.
- Usage/cost basis: `thread/tokenUsage/updated`, `account/rateLimits/updated`.
- Skills: `skills/changed`.
- Approvals and user input are server-to-client requests, not ordinary notifications.

Approval/user-input requests to map into VSP-Coder cards:

- `item/commandExecution/requestApproval`
- `item/fileChange/requestApproval`
- `item/permissions/requestApproval`
- `item/tool/requestUserInput`
- `mcpServer/elicitation/request`
- Legacy/compat: `applyPatchApproval`, `execCommandApproval`

Codex implications for VSP-Coder:

- C2 should prefer Codex `app-server` or generated protocol bindings over scraping TUI text.
- VSP-Coder `Kill` maps to `turn/interrupt` when a thread turn is active; standalone terminal command kill maps to `command/exec/terminate`.
- Session rename is supported through `thread/name/set`.
- Resume without stealing interaction may use read/list/metadata APIs first; mutating turns should go through the VSP-Coder single-driver queue.
- Skills autocomplete can use `skills/list` plus project/user roots.
- Token/rate-limit UI can use `thread/tokenUsage/updated` and account/rate-limit methods.

## Claude Code

Official entry points:

- Claude Code overview: `https://docs.claude.com/en/docs/claude-code/overview`
- Claude Agent SDK overview: `https://docs.claude.com/en/docs/claude-code/sdk/sdk-overview`
- Claude Agent SDK TypeScript: `https://code.claude.com/docs/en/agent-sdk/typescript`

Important interface facts to preserve:

- Claude Agent SDK supports TypeScript and Python.
- The TypeScript SDK packages/uses the Claude Code native binary and provides programmatic agent interactions.
- Adapter planning must account for streaming messages, hooks, tool/user input, permission approval flows, model selection, and stop/timeout diagnostics.

Claude implications for VSP-Coder:

- Do not assume the latest model only; adapter settings must expose explicit model selection where supported.
- Treat unexpected stops as first-class session status events with reason, timestamp, and retry/reconnect affordance.
- Permission/user input prompts should map to the same VSP-Coder approval/request card protocol used by Codex and OpenCode.

## OpenCode

Official entry points:

- OpenCode docs: `https://opencode.ai/docs/`
- OpenCode server docs: `https://opencode.ai/docs/server/`
- OpenCode SDK docs: `https://opencode.ai/docs/sdk/`

Important interface facts to preserve:

- OpenCode has a headless server mode exposed over HTTP/OpenAPI.
- OpenCode SDKs include JavaScript/TypeScript entry points.
- OpenCode exposes event streams suitable for UI synchronization.
- Permission approvals and Ask Tool / user prompts must be modeled as resumable remote events, not terminal-only interactions.

OpenCode implications for VSP-Coder:

- Future adapter should connect to OpenCode server/SDK when possible instead of driving an interactive terminal.
- The Ask Tool interrupt problem should be treated as a single-driver/remote-request routing bug: VSP-Coder should own the active prompt and show it in all subscribed clients.
- Large approval volume requires a policy engine with audit logs: auto-approve is policy-bound, not a blind global switch.
- Subagent visibility should map into session events and right-sidebar panels.

## Unified VSP-Coder Protocol Notes

The app should not expose provider-specific raw protocols directly to the browser. Instead, adapters map provider events into a stable VSP protocol:

- `Session`: provider, projectRoot, runnerOwner, status, currentTurn, model, cwd, timestamps.
- `Message`: role, content blocks, provider item refs, structured mentions, attachments.
- `Event`: status changes, token/rate updates, errors, warnings, diffs, file changes, command output.
- `RequestCard`: approval, tool input, MCP elicitation, permission request, interrupt confirmation.
- `Artifact`: file path, diff, preview target, MIME/type hint, render support level.
- `Metric`: token usage, duration, rate-limit, cost estimate when available.

C1 should implement this unified protocol with a mock runtime. C2 should bind Codex to the same protocol.

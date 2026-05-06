# API Reference

VSP-Coder exposes a local HTTP API used by the web workbench. C2 replaces the
old mock session contract with a real Codex-backed provider while keeping a
small adapter boundary for future providers.

All endpoints are local-first. The default server port is configurable with
`PORT` or `VSP_CODER_PORT`.

## Health

`GET /api/health`

Returns server readiness.

```json
{ "ok": true }
```

## State

`GET /api/state`

Returns the complete UI snapshot:

- provider runtime status and automation policy
- discovered Codex projects and sessions
- recent sessions
- selected session transcript
- queue items
- model and reasoning selection
- artifacts, command events, file edits, approvals, and diagnostics

The UI treats this response as a cacheable snapshot and updates it from SSE
refresh signals.

## Events

`GET /api/events`

Opens a Server-Sent Events stream. Events are emitted as `vsp` events and carry
small refresh hints rather than full session payloads.

Consumers should refresh the affected state from `GET /api/state` and preserve
local scroll/input state when possible.

## Models

`GET /api/models`

Returns the model and reasoning options available for the active provider.
For Codex, the list is derived from the provider capability surface rather than
from a fixed frontend enum.

Each item includes:

- `provider`
- `model`
- `label`
- `reasoning`
- `status`
- `note`

## Provider Actions

`POST /api/provider/start`

Starts the configured provider runner when it is not already running.

`POST /api/provider/stop`

Stops the provider runner owned by this server.

`POST /api/provider/restart`

Restarts only the provider runner owned by this server.

## Sessions

`POST /api/sessions`

Creates a new session for a discovered or explicitly selected project.

Request body:

```json
{
  "projectId": "project-id",
  "message": "optional first message",
  "model": "gpt-5.5",
  "reasoning": "xhigh"
}
```

`POST /api/sessions/:id`

Queues a user message for an existing session. The server appends the item to
its local queue and steers the real Codex runner.

Request body:

```json
{
  "message": "Please run npm test",
  "model": "gpt-5.5",
  "reasoning": "high"
}
```

`POST /api/sessions/:id/actions`

Runs a session-level action. Supported C2 actions include:

- `switch_model`
- `rename`
- `refresh_state`
- `interrupt`
- `clear_queue`
- `approve`
- `decline`
- `card_action`
- `workflow_check`
- `workflow_sync`
- `config_update`

Rename is persisted through the Codex session storage path exposed by the
provider adapter, matching the durable behavior users see after refresh.

## Workflow

`GET /api/workflow?projectId=<id>`

Returns Hypo-Workflow project information when the selected project contains a
`.pipeline/` workspace:

- milestone progress
- compact plan text
- config items
- architecture references
- knowledge root
- `hasWorkflow`

## Preview

`GET /api/preview/:id`

Returns sanitized preview content for supported skills, commands, and files.
The preview surface is intentionally bounded and should not be treated as a
general filesystem read endpoint.

## Temporary QA

`POST /api/qa/tmp-session`

Development-only helper used by the C2 acceptance flow. It creates a temporary
Codex-style session under the operating system temporary directory and returns
its generated project/session metadata.

This endpoint must not hardcode a user path and must not be required for normal
deployment.

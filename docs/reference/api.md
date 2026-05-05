# API Reference

The API is a mock contract for the v0.1.0 workbench.

## State

`GET /api/state`

Returns the full workbench state: projects, sessions, events, and QA runs.

## Models

`GET /api/models`

Returns model/provider options. Each option includes:

- `provider`
- `model`
- `label`
- `reasoning`
- `status`
- `note`

`status: "mock"` means the selector updates session state but does not launch a real provider runner.

## Workflow

`GET /api/workflow?projectId=<id>`

Returns Hypo-Workflow project information, including milestone progress, compact plan text, config items, architecture refs, knowledge root, and `hasWorkflow`.

## Sessions

`POST /api/sessions`

Creates a mock session for a project.

`POST /api/sessions/:id`

Appends a user message or structured tokens to a session.

`POST /api/sessions/:id/actions`

Runs a mock session action. Important action types include:

- `switch_model`
- `refresh_state`
- `interrupt`
- `clear_queue`
- `card_action`
- `qa_item_update`
- `qa_complete`
- `workflow_check`
- `workflow_sync`
- `config_update`

## Events

`GET /api/events`

Opens an SSE stream. Events are sent as `vsp` events and prompt the web UI to refresh.

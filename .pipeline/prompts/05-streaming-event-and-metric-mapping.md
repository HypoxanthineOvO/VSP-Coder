# M05 Streaming, Event, And Metric Mapping

## Objective

Map Codex streaming notifications, item completions, status changes, warnings,
errors, token usage, and rate-limit updates into the VSP message/event/metric
protocol.

## Context

C1 validated VSP message/event surfaces with mock data. C2 must make these
surfaces real while preserving a provider-independent browser contract.

## Implementation Tasks

- Map assistant message deltas into incremental VSP assistant messages.
- Map item completed notifications into finalized messages, tool summaries, or
  artifacts.
- Map turn started/completed and thread status changes into VSP session status.
- Map warnings/errors into VSP events with useful user-facing text.
- Map token usage and rate-limit updates into VSP metrics.
- Update frontend rendering for real streaming state without layout overlap.
- Add fixture tests for each mapped notification class.
- Update protocol types if C1 fields are insufficient.

## Guardrails

- Do not leak raw Codex JSON-RPC shapes to frontend components as the public
  state contract.
- Preserve existing mock/dev testability.
- Keep UI text concise and operational.

## Automated Validation

- `npm run typecheck`
- `npm test`
- Mapping fixture tests for deltas, completions, status, errors, token usage,
  and rate-limit updates.
- Frontend tests for streaming message rendering where practical.

## Manual Validation

- In tmp thread, send a prompt and confirm assistant output streams.
- Confirm final message state is stable after turn completion.
- Confirm token/rate-limit/status surfaces update.
- Trigger or simulate an error and confirm the UI reports it clearly.

## Knowledge Update

Update protocol docs with:

- final message block shape;
- status enum mapping;
- metric shape;
- unresolved provider-specific edge cases.

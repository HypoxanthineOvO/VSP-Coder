# M02 Codex App-Server Client Foundation

## Objective

Add the Codex app-server process manager and typed JSON-RPC client that future
Milestones will use for real Codex operations.

## Context

C2 uses `codex app-server` as the preferred official integration surface.
Browser clients must not connect to raw Codex transports. VSP-Coder server owns
the provider connection and maps Codex protocol messages into VSP protocol
state.

## Implementation Tasks

- Create a Codex provider module in the backend.
- Start `codex app-server` on demand using internal transport, preferably
  `stdio://` first.
- Implement process lifecycle tracking: starting, ready, unavailable, crashed,
  restarting.
- Implement JSON-RPC request id management, response matching, notification
  dispatch, and timeout/error handling.
- Use generated local TypeScript/schema artifacts as the protocol reference.
- Add a provider health endpoint or include Codex health in existing state.
- Surface startup and protocol errors through VSP events.
- Add graceful shutdown cleanup for the child process.

## Guardrails

- Do not expose raw Codex WebSocket to the browser.
- Do not require browser login or token handling.
- Do not mutate existing Codex threads in this Milestone.
- Keep mock provider code separate from Codex provider code.

## Automated Validation

- `npm run typecheck`
- `npm test`
- Unit tests for JSON-RPC framing, request/response matching, notification
  handling, and timeout behavior.
- Backend tests for provider health states using a fake app-server process.

## Manual Validation

- Start VSP-Coder and confirm Codex provider health appears.
- Stop or break the child process and confirm UI/backend show an understandable
  unavailable/restarting state.
- Confirm normal browser traffic still uses VSP-Coder APIs only.

## Knowledge Update

Update Codex adapter mapping with:

- chosen transport;
- process lifecycle behavior;
- request timeout policy;
- observed app-server startup behavior.

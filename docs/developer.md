# Developer Guide

VSP-Coder is a TypeScript npm workspace.

## Workspace Layout

| Path | Role |
|---|---|
| `packages/protocol` | Shared provider-neutral protocol types and helpers. |
| `apps/server` | Node HTTP server, Codex app-server client, SSE event stream, local store, and static web serving. |
| `apps/web` | React/Vite workbench UI. |
| `scripts` | Local deployment helpers. |
| `.pipeline` | Hypo-Workflow planning, progress, reports, and knowledge files. |

## Runtime Contract

The server exposes a local API:

- `/api/state` returns workbench state.
- `/api/models` returns Codex model options from Codex `model/list` when available.
- `/api/workflow` returns Hypo-Workflow project status.
- `/api/sessions` creates Codex threads in discovered project directories.
- `/api/sessions/:id` hydrates or sends messages to Codex sessions.
- `/api/sessions/:id/actions` handles rename, interrupt, queue, settings, and workflow actions.
- `/api/events` streams provider-neutral live patches and lifecycle events.

Local runtime files live under `.vsp-coder/` and are ignored by git.

## Deployment Helper

`npm run deploy:local` builds the workspace, finds an available port, starts the built server, waits for `/api/health`, then writes `.vsp-coder/deployment.json`.

The helper accepts:

- `--start-port=<port>`
- `--port=<port>`
- `--host=<host>`
- `--no-build`

## Port Configuration

The built server reads port and host in this order:

1. `PORT`
2. `VSP_CODER_PORT`
3. default `4180`

Host is read from `HOST`, then `VSP_CODER_HOST`, then `0.0.0.0`.

The Vite dev proxy reads `VITE_API_TARGET`, then falls back to the same port variables.

## Verification

Run the full local gate before release:

```bash
npm run typecheck
npm test
npm run build
git diff --check
```

## Provider Notes

C2 ships a real Codex adapter. OpenCode and Claude Code are not active adapters in this release; their future integrations should use the provider protocol documented under `.pipeline/knowledge/reference/`.

## Safety Notes

- Do not hardcode user paths or machine-specific LAN URLs.
- Do not kill by port alone when restarting local services.
- Before stopping a local deployment, verify PID, command, and working directory.

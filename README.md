# VSP-Coder

VSP-Coder is a local Codex workbench for supervising real Codex coding sessions across projects, session history, pending queues, approvals, model choices, artifacts, and Hypo-Workflow project state.

The C2 release connects the frontend to the Codex app-server while keeping a provider-neutral backend protocol for future OpenCode and Claude adapters.

## Features

- Real Codex project and session discovery from Codex thread metadata.
- Existing Codex thread hydration with full message history.
- New Codex thread creation, message sending, queued outbound messages, and interrupt.
- Streaming assistant/tool updates through SSE live patches.
- Markdown, tables, code blocks, sanitized HTML, and math rendering.
- Command output and file-change artifacts with previews.
- Real Codex session rename through Codex canonical thread naming.
- Local automation profiles for full-auto, workspace-auto, and manual confirmation.
- Codex model and reasoning selectors backed by the Codex app-server model list.
- Subagent trace visibility when the provider emits subagent-like events, plus a not-observed marker when a requested subagent is not exposed by Codex.
- Desktop and mobile workbench layouts with recent sessions, recent projects, queue dock, and Hypo-Workflow status.

## Requirements

- Node.js 20 or newer.
- npm.
- A working local Codex installation. VSP-Coder uses the Codex app-server through stdio and reads Codex state from the current user's Codex home.

## Quick Start

```bash
npm install
npm run build
npm start
```

By default the built server binds to `0.0.0.0` and uses `${PORT}` or `${VSP_CODER_PORT}` when set. If neither variable is set, it uses `4180`.

```bash
PORT=4300 npm start
```

The server prints local and LAN URLs at startup.

## Local Deployment

Use the deployment helper when you want VSP-Coder to pick an available port automatically:

```bash
npm run deploy:local
```

Useful options:

```bash
npm run deploy:local -- --start-port=4300
npm run deploy:local -- --port=4301
npm run deploy:local -- --host=127.0.0.1
npm run deploy:local -- --no-build
```

The helper writes runtime files under `.vsp-coder/`, which is ignored by git:

- `.vsp-coder/deployment.json`
- `.vsp-coder/server.pid`
- `.vsp-coder/deploy-<port>.log`

To stop a deployed instance safely, read the PID from `.vsp-coder/server.pid` and verify that the process command is `node apps/server/dist/index.js` and its working directory is this repository before killing it.

## Development

```bash
npm run dev
```

The Vite dev server proxies `/api` to `VITE_API_TARGET` when set. Otherwise it uses `PORT` or `VSP_CODER_PORT`, falling back to `4180`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run typecheck` | Type-check all workspaces. |
| `npm test` | Run protocol, server, and web tests. |
| `npm run build` | Build protocol, server, and web assets. |
| `npm start` | Start the built server. |
| `npm run deploy:local` | Build and deploy on an available local port. |
| `npm run qa` | Run tests and build together. |

## Configuration

Runtime configuration is stored in `.vsp-coder/config.json` and is intentionally ignored by git. Local deployments default to Codex data mode with full automation. Release deployments can use the Settings panel to choose automation level.

Important environment variables:

| Variable | Purpose |
|---|---|
| `PORT` | Server port. |
| `VSP_CODER_PORT` | Server port fallback when `PORT` is unset. |
| `HOST` | Server bind host. |
| `VSP_CODER_HOST` | Server bind host fallback when `HOST` is unset. |
| `CODEX_HOME` | Optional Codex home override. |
| `VITE_API_TARGET` | Vite dev proxy target. |

## Release Status

v0.2.0 is the accepted C2 Codex Session Adapter release. OpenCode and Claude Code remain future provider adapters; the shared protocol and knowledge records are prepared for those integrations.

## License

License has not been declared yet.

# VSP-Coder

VSP-Coder is a local workbench prototype for supervising AI coding sessions across projects, sessions, pending approval cards, model/provider choices, and Hypo-Workflow project state.

The current release is a mock vertical slice. It is designed to validate the interaction model before wiring real Codex, OpenCode, and Claude Code runners.

## Features

- Desktop workbench with Project, Session, Conversation, and Workflow panels.
- Resizable desktop columns for the global rail, session rail, and right workflow rail.
- Mobile layout with a compact session drawer, model/reasoning dock, and approval sheet.
- Mock session lifecycle actions for new session, refresh, interrupt, upload menu, approvals, QA pass/fail, and model switching.
- Hypo-Workflow sidebar that renders progress, compact plan Markdown, editable config cards, and read-only architecture/knowledge entries.
- LAN-friendly server binding through `0.0.0.0`, so phones on the same network can test the UI.

## Quick Start

```bash
npm install
npm run build
npm start
```

The server defaults to `0.0.0.0:4180`. On this machine the current LAN URL is:

```text
http://10.15.88.94:4180
```

For development:

```bash
npm run dev
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run typecheck` | Type-check all workspaces. |
| `npm test` | Run protocol, server, and web tests. |
| `npm run build` | Build protocol, server, and web assets. |
| `npm start` | Start the built mock server. |
| `npm run qa` | Run tests and build together. |

## Release Status

v0.1.0 is the accepted C1 mock release. OpenCode and Claude Code entries are visible in the model selector, but they are still mock provider mappings until real runner adapters are implemented.

## License

License has not been declared yet.

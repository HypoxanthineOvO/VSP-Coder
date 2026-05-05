# Developer Guide

VSP-Coder is a TypeScript npm workspace.

## Workspace Layout

| Path | Role |
|---|---|
| `packages/protocol` | Shared protocol types and helpers. |
| `apps/server` | Node HTTP mock server, SSE event stream, mock store, and static web serving. |
| `apps/web` | React/Vite workbench UI. |
| `.pipeline` | Hypo-Workflow planning, progress, reports, and knowledge files. |

## Runtime Contract

The server exposes a local mock API:

- project/session state is served by `/api/state`;
- model options are served by `/api/models`;
- workflow state is served by `/api/workflow`;
- session messages and actions mutate the mock store;
- server-sent events notify the web UI to refresh.

The mock store is intentionally local. It validates UI flows without taking ownership of real runner execution.

## UI Notes

- The app shell uses four desktop columns: global rail, session rail, workspace, and right rail.
- Desktop rail widths are controlled by CSS variables and React pointer drag state.
- Mobile switches to a drawer, compact status dock, and approval sheet below `1100px`.
- The composer action menu closes on outside click and Escape.

## Verification

Run the full local gate before release:

```bash
npm run typecheck
npm test
npm run build
```

## Deferred Backend Work

- Real provider adapters for OpenCode and Claude Code.
- Persistent project/session discovery beyond the mock store.
- Real file upload and resource-opening behavior.
- Session rename/context menu actions.

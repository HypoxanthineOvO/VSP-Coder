# Architecture Baseline - VSP-Coder C1

## Project Overview

VSP-Coder is planned as a web-first remote conversation workspace for AI coding backends. C1 delivers the mock runtime and interaction protocol only. Real Codex, Claude Code, and OpenCode adapters are deferred to later Cycles.

The core principle is that browser clients talk to a VSP-Coder backend message manager. The backend owns session state and later provider runners. Multiple windows observe and submit messages through the backend rather than directly attaching to provider CLIs.

## Planned Tech Stack

- Language: TypeScript
- Frontend: React + Vite or equivalent lightweight SPA stack
- Backend: Node.js service
- Realtime: WebSocket or SSE, selected during implementation
- Storage: SQLite or local file-backed store with isolated mock namespace
- Test profile: web app

## Planned Directory Shape

```text
.
├── apps/
│   ├── web/
│   └── server/
├── packages/
│   └── protocol/
├── .pipeline/
│   ├── prompts/
│   ├── reports/
│   ├── knowledge/
│   ├── architecture.md
│   ├── config.yaml
│   ├── cycle.yaml
│   └── design-spec.md
└── .plan-state/
    ├── discover.yaml
    ├── decompose.yaml
    └── generate.yaml
```

Actual directory names may be adjusted in M01 if the chosen toolchain strongly prefers another convention, but the conceptual boundaries should remain.

## Main Components

- Web app shell: desktop and mobile layouts based on `WebReference.png` and `MobileReference.png`.
- Message workspace: central conversation stream, composer, structured token rendering, and contextual cards.
- Backend message manager: mock sessions, messages, queue state, event fan-out, and mock runtime scripts.
- Protocol package: provider-independent `Session`, `Message`, `Event`, `RequestCard`, `Artifact`, and `Metric` types.
- Project file API: safe project-root-confined reads for `.pipeline/`, `.plan-state/`, and preview/detail targets.
- Hypo-Workflow sidebar: right-sidebar tab for plan/progress/config/architecture/knowledge context.
- QA harness: scripted `开始测试` interaction flow plus saved manual QA records.

## Data Flow

1. User opens the Web App and selects a project/session.
2. Frontend loads session/project state from backend APIs.
3. Backend reads/writes isolated mock runtime data.
4. Backend publishes session events to every subscribed browser window.
5. Composer sends message content and structured mention metadata to backend.
6. Mock runtime emits message, request-card, status, token, and artifact events.
7. Right sidebar reads project workflow files through the safe file API.
8. Manual QA records are persisted separately from future production adapter state.

## Provider Adapter Boundary

C1 must not call real Codex, Claude Code, or OpenCode. It should preserve a stable provider-independent protocol so later adapters can map provider APIs into VSP-Coder events.

Local integration references are stored in:

- `.pipeline/knowledge/reference/provider-interface-notes.md`
- `.pipeline/knowledge/generated/codex-app-server/`

## Security And Safety Boundaries

- Project file reads must be confined to configured project roots.
- `Kill` is an interrupt request and must require confirmation.
- `Clear Queue` only removes pending outbound queued messages and must not affect an active runner.
- Mock data must not share storage tables/files with future production provider state.
- Browser-facing APIs should not expose provider tokens or raw credentials.

## C1 Milestone Map

1. App shell, layout, and mock runtime contract.
2. Multi-window session sync and message queue.
3. Interaction cards, approval flow, and interrupt controls.
4. Skill, command, file mentions, and preview surface.
5. Hypo-Workflow sidebar and project file API.
6. Manual QA harness and acceptance polish.
7. Sync, docs, and approval gate.

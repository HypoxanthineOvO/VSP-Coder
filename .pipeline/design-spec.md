# Design Spec - VSP-Coder C1

## Goal

Build the first usable vertical slice of VSP-Coder: a web-first remote AI coding conversation workspace with a backend-owned mock session runtime, multi-window synchronization, structured message tokens, interaction cards, and a Hypo-Workflow sidebar.

C1 intentionally does not connect to real Codex, Claude Code, or OpenCode. It proves the UI, protocol, message manager, mock persistence, and manual QA loop before provider adapters are added.

## Project Shape

- Project type: TypeScript Web App plus Node.js backend daemon.
- Primary deliverable: local web app and backend service for mock sessions.
- Target platform: desktop browser and mobile browser viewport.
- Expected users: developer/operator managing AI coding sessions across projects.

## Constraints

- Use a TypeScript-first stack so future Codex, Claude Code, and OpenCode adapters can reuse official TS/HTTP integration surfaces.
- Use a backend message manager as the only session owner; browser windows never talk directly to provider CLIs.
- Keep mock runtime data isolated from future production adapter data while sharing the same public API contract.
- Keep C1 greenfield and runnable; defer real provider adapters, production auth, true multi-user Linux runner orchestration, and Electron/VSCode shells.
- Enforce project-root confinement for local file reads.

## Existing Context

- Existing repo detected: greenfield project with `.pipeline/` planning artifacts and two UI reference images.
- Existing `.pipeline/` detected: yes.
- Local Knowledge contains provider interface notes and generated Codex app-server schema.
- UI references:
  - `WebReference.png`
  - `MobileReference.png`

## Functional Requirements

- Desktop layout:
  - global sidebar for backend/model/project/recent navigation
  - project/session sidebar
  - central message workspace and composer
  - right sidebar with Workflow and preview/detail surfaces
- Mobile layout:
  - top bar with current session identity and switch entry
  - primary message stream
  - fixed composer with safe-area handling
- Backend mock runtime:
  - session/message/queue state
  - real-time event fan-out across windows
  - isolated mock persistence
- Interaction model:
  - approval/request cards appear only when needed
  - composer action menu for mock attachments, model switching, clear queue, and Kill/Interrupt
  - `Kill` means interrupt current runner/session; `Clear Queue` only clears pending outbound messages
- Skill/Command/file mentions:
  - autocomplete in composer
  - structured token insertion
  - message chip rendering
  - right-sidebar detail/preview
- Hypo-Workflow sidebar:
  - read local `.pipeline/` and `.plan-state/` through safe backend APIs
  - show current planning/progress, architecture, config, and knowledge links
- Manual QA:
  - `开始测试` triggers a scripted mock interaction sequence
  - user can click through all cards/actions and save pass/fail results

## Testing Expectations

- Automated:
  - protocol serialization tests
  - backend API tests for sessions, queue, events, safe file reads, and QA records
  - frontend state/component tests where practical
  - typecheck/build/lint
- Manual:
  - desktop two-window sync
  - mobile viewport switching and composer
  - `开始测试` scripted card/action flow
  - Hypo-Workflow sidebar reading this repository's real planning files

## Milestone Strategy

- Proposed milestone count: 7
- Expected preset: `tdd`
- Split rationale: each milestone delivers one runnable behavior and preserves the future adapter boundary.

## C1 Milestones

1. App Shell, Layout, And Mock Runtime Contract
2. Multi-Window Session Sync And Message Queue
3. Interaction Cards, Approval Flow, And Interrupt Controls
4. Skill, Command, File Mentions, And Preview Surface
5. Hypo-Workflow Sidebar And Project File API
6. C1 Manual QA Harness And Acceptance Polish
7. Sync, Docs, And Approval Gate

## Future Cycles

- C2: Codex adapter using app-server/generated protocol when possible.
- C3: Codex product hardening, history, rename, timeout/rate-limit/cost visibility, and richer artifacts.
- C4: permission policy engine and audit-backed auto-approval.
- C5: OpenCode adapter.
- C6: Claude Code adapter.
- C7: multi-user/system service with per-OS-user runners.
- C8: Electron and VSCode shells over the same API.

## Open Questions

- Exact package manager and test runner can be chosen by M01 based on current ecosystem fit.
- Whether WebSocket or SSE is better for C1 event fan-out can be decided in M02, but the API must preserve provider-independent event semantics.
- Full PDF/HTML preview remains deferred; C1 only needs a clear preview/detail surface.

## Notes

- Provider docs and generated Codex schema are stored under `.pipeline/knowledge/`.
- Do not let provider-specific raw protocols leak into browser-facing VSP-Coder APIs.

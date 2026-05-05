# M01 - App Shell, Layout, And Mock Runtime Contract

## Objective

Deliver the first runnable VSP-Coder shell: TypeScript app foundation, desktop/mobile layout regions, backend mock runtime contract, isolated mock storage scaffolding, and one visible mock session workspace.

## 需求

- Set up a TypeScript Web App plus Node backend structure suitable for later Codex/OpenCode/Claude adapters.
- Implement the desktop layout regions from `WebReference.png`: global sidebar, project/session sidebar, message workspace, composer, and right sidebar.
- Implement the mobile baseline from `MobileReference.png`: top bar, current session area, message stream, and fixed composer.
- Create shared provider-independent protocol types for `Session`, `Message`, `Event`, `RequestCard`, `Artifact`, and `Metric`.
- Expose backend health and mock session list endpoints.
- Add isolated mock storage scaffolding that cannot be confused with future production adapter state.

## Boundaries

- In scope: app/server/package setup, frontend shell, backend server skeleton, shared protocol package, seed mock data, smoke validation.
- Use TypeScript throughout.
- Keep architecture provider-independent.
- Preserve future `userId`, `homeRoot`, `projectRoot`, and `runnerOwner` fields in API shapes where useful.

## Non-Goals

- No real Codex, Claude Code, or OpenCode integration.
- No full Skill/Command autocomplete yet.
- No production login or multi-user OS runner orchestration.
- No full PDF/HTML renderer.

## 预期测试

- App starts locally with documented command(s).
- Desktop viewport shows all planned layout regions without incoherent overlap.
- Mobile viewport shows top bar, message stream, and composer with safe spacing.
- Backend health endpoint responds.
- Backend mock session list returns seeded sessions.
- Shared protocol types compile and are imported by app/server code.

## Validation Commands

- Install dependencies with the chosen package manager.
- Run typecheck/build/test commands introduced by this milestone.
- Start backend/frontend locally and verify the app loads.
- Use a desktop browser viewport and a mobile viewport screenshot or manual check.

## Evidence

- Record the exact commands run and their pass/fail output in the milestone report.
- Include a short note describing desktop and mobile layout verification.
- Mention any chosen toolchain decisions and why.

## Human QA

- User should be able to open the app and identify the desktop layout regions.
- User should be able to open a mobile-sized viewport and see the current-session layout.

## 预期产出

- Workspace/package configuration.
- Web app shell.
- Backend server skeleton.
- Shared protocol types.
- Seed mock project/session data.
- Initial tests or smoke script.

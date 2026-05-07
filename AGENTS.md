# Hypo-Workflow managed OpenCode instructions

This file is Hypo-Workflow managed. Edit the source Hypo-Workflow rules/config when possible, then regenerate adapters with `hypo-workflow sync --platform opencode`.

## Runtime contract

- Hypo-Workflow is not a runner.
- The OpenCode Agent performs the actual work.
- `.pipeline/` remains the source of truth for state, Cycle, Patch, rules, PROGRESS, logs, prompts, and reports.
- Use `question` for required user decisions.
- Use `todowrite` for visible plan discipline, especially in `/hw-plan*` commands.

## Protected files

Treat `.pipeline/state.yaml`, `.pipeline/cycle.yaml`, and `.pipeline/rules.yaml` as protected. Unexpected writes should be blocked or require explicit user confirmation.

## Analysis boundary

When `execution.steps.preset=analysis`, read `.opencode/hypo-workflow.json.analysis` before acting.

- `manual`: deny code changes.
- `hybrid`: propose code changes and confirm before editing.
- `auto`: code changes are allowed inside the configured boundaries.
- Service restarts require confirmation.
- System-level dependency installation requires an explicit ask.
- Network, remote-resource, destructive, and external side-effect boundaries must be honored exactly as configured.

## Active Rules/Habits

Structured Rules/Habits are authority; Markdown habits and platform instructions are derived views.

- conflict-check (builtin/warn/guard): Detect incompatible local agent plugins or hook systems at session start.
- docs-chinese-language (project/error/style): README 等面向用户、发布和项目说明的文档必须使用中文。
- plan-tool-required (builtin/warn/workflow): Complex planning and execution work must maintain a visible plan/todo state.
- progress-timezone (builtin/warn/style): Keep PROGRESS timestamps aligned with output.timezone.
- report-language (builtin/warn/style): Keep reports and generated summaries aligned with output.language.
- safe-service-restart (project/error/guard): 重启本项目本地服务时，禁止通过端口批量杀进程，例如禁止使用 `lsof -ti tcp:<port> | xargs kill` 或等价写法。

只能停止能证明属于 VSP-Coder 当前仓库服务的进程。优先使用项目本地 ignored PID 文件；如果 PID 文件已经失准、但端口仍被旧服务占用，可以检查监听端口的进程。停止前必须同时校验：

- PID 来自项目本地 ignored 状态文件，例如 `.vsp-coder/server.pid`，或来自 `ss -ltnp "sport = :${PORT:-4180}"` 的监听进程；
- 进程仍然存在；
- 进程命令必须是 `node apps/server/dist/index.js`，工作目录必须是当前仓库根目录；
- 不得杀 VS Code Remote、端口转发、shell、npm 父进程或其他共享基础设施进程。

如果无法安全证明目标进程归属，就不要杀进程；改用空闲端口启动新实例，或先向用户报告阻塞原因。
- session-start-context-load (builtin/error/hook): Preserve SessionStart context loading as a rule-level gate.

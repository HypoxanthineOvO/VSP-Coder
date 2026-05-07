# Hypo-Workflow Habits

This file is generated from structured Rules/Habits authority. Edit structured rule records, then regenerate derived views.

## Active Rules

- **auto-continue-threshold** [builtin/warn/workflow]
  - Govern automatic continuation decisions after evaluation.
  - hooks: on-evaluate
- **config-valid** [builtin/warn/guard]
  - Validate project configuration before milestone execution.
  - hooks: pre-milestone
- **conflict-check** [builtin/warn/guard]
  - Detect incompatible local agent plugins or hook systems at session start.
  - hooks: on-session-start
- **cycle-closed** [builtin/warn/guard]
  - Check that the previous explicit Cycle was closed before starting a new delivery lane.
  - hooks: pre-milestone
- **git-clean-check** [builtin/warn/guard]
  - Check whether the Git working tree has uncommitted changes before milestone execution.
  - hooks: pre-milestone
- **knowledge-ledger-self-check** [builtin/warn/hook]
  - Require a Knowledge Ledger self-check after work that changes reusable project knowledge.
  - hooks: post-step, post-milestone
- **plan-tool-required** [builtin/warn/workflow]
  - Complex planning and execution work must maintain a visible plan/todo state.
  - hooks: always, pre-milestone
- **progress-timezone** [builtin/warn/style]
  - Keep PROGRESS timestamps aligned with output.timezone.
  - hooks: always
- **readme-freshness** [builtin/warn/release]
  - Ensure README managed content matches version, command count, platform matrix, features, and release policy before publishing.
  - hooks: pre-commit, pre-release
- **report-language** [builtin/warn/style]
  - Keep reports and generated summaries aligned with output.language.
  - hooks: always
- **review-strictness** [builtin/warn/workflow]
  - Apply the configured review strictness during evaluation.
  - hooks: on-evaluate
- **safe-service-restart** [project/error/guard]
  - 重启本项目本地服务时，禁止通过端口批量杀进程，例如禁止使用 `lsof -ti tcp:<port> | xargs kill` 或等价写法。

只能停止能证明属于 VSP-Coder 当前仓库服务的进程。优先使用项目本地 ignored PID 文件；如果 PID 文件已经失准、但端口仍被旧服务占用，可以检查监听端口的进程。停止前必须同时校验：

- PID 来自项目本地 ignored 状态文件，例如 `.vsp-coder/server.pid`，或来自 `ss -ltnp "sport = :${PORT:-4180}"` 的监听进程；
- 进程仍然存在；
- 进程命令必须是 `node apps/server/dist/index.js`，工作目录必须是当前仓库根目录；
- 不得杀 VS Code Remote、端口转发、shell、npm 父进程或其他共享基础设施进程。

如果无法安全证明目标进程归属，就不要杀进程；改用空闲端口启动新实例，或先向用户报告阻塞原因。
  - hooks: always
  - source: .pipeline/rules/custom/safe-service-restart.md
- **session-start-context-load** [builtin/error/hook]
  - Preserve SessionStart context loading as a rule-level gate.
  - hooks: on-session-start
- **skill-quality** [builtin/warn/quality]
  - Validate Skill frontmatter, canonical output-language heading, reference paths, command map traceability, and internal Skill exceptions.
  - hooks: pre-milestone, pre-release
- **stop-hook-self-check** [builtin/error/hook]
  - Preserve the Stop Hook self-check as a rule-level gate.
  - hooks: post-step

## Conflicts

No structured rule conflicts.

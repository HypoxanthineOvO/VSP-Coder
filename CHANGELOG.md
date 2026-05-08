# 变更日志

## v0.3.0 - 2026-05-08

### 功能与体验

- 修复刷新、轮询和 SSE live patch 交错时吞掉已发送消息的问题，消息合并改为 identity-first。
- 默认恢复上次选中的项目和会话，并在目标失效时做可解释 fallback。
- 为模型和 reasoning 切换增加 pending、失败回滚、capability 校验和错误重试入口。
- 新增底部错误卡与重试卡，覆盖 502、429、SSE 断开、发送失败、refresh 失败和 provider 错误。
- 优化窄屏桌面和移动端导航，右侧栏可收拢为 rail，移动端 drawer、软键盘跟随和长输入 composer 可用。
- 统一前端 motion token、按钮色调、交互提示、发送状态、错误卡动画和 reduced-motion 降级。
- Subagent trace 升级为协议级结构化 block，简单模式保留入口，详情面板展示状态、原始 trace 和 provider 交互能力。

### 验证

- 新增 Chromium Playwright 与截图基线，覆盖消息生命周期、错误卡、响应式布局、移动端 drawer、长输入 composer、reduced-motion 和 Subagent trace。
- 发布前执行 typecheck、unit tests、Chromium E2E、screenshot smoke、build、diff check、本地部署 smoke、Hypo-Workflow sync/docs 检查。

## v0.2.1 - 2026-05-07

### 文档

- 添加 GNU Affero General Public License v3.0 or later，并在 package metadata 和 README 中标明 `AGPL-3.0-or-later`。
- 美化 README，补充版本徽章、许可证徽章、适用场景、亮点表格、文档导航和发布状态。
- 将 README、用户指南、开发者指南、API 参考和项目摘要中文化。
- 新增项目级与用户级规则，要求 README 等面向用户、发布和项目说明的文档使用中文。
- 重新同步 Hypo-Workflow OpenCode 适配器和派生规则视图。

### 验证

- 发布前通过 Hypo-Workflow sync check、typecheck、tests、build 和 diff check。

## v0.2.0 - 2026-05-06

### 功能

- 将 VSP-Coder 连接到真实 Codex sessions，并通过 Codex app-server adapter 工作。
- 添加 Codex project/session discovery、thread hydration、新 thread 创建、消息队列发送和 interrupt handling。
- 添加真实 Codex rename persistence，并通过 provider adapter 持久化。
- 添加 live assistant/tool event mapping、approval handling、command/file-change artifacts 和 Subagent trace visibility。
- 添加 Markdown、数学公式、安全 HTML、命令折叠、简单/详细展示模式，以及移动端和桌面端交互打磨。
- 添加 provider-neutral 后端协议文档，为未来 adapter 预留边界。

### 部署

- 添加 `npm run deploy:local`，它会构建应用、选择可用本地端口、启动服务、等待 health，并把运行时元数据写入 `.vsp-coder/`。
- 支持通过 `HOST`、`PORT` 和 `VSP_CODER_PORT` 配置 host 与 port。
- 移除发布面向用户路径中的本机专属路径和固定端口部署假设。

### 验证

- C2 release candidate 已通过 typecheck、tests、build、hardcode scan、本地部署 smoke、docs check 和 Hypo-Workflow sync check。

## v0.1.0 - 2026-05-05

### 功能

- 添加 C1 VSP-Coder mock workbench，包含桌面和移动端布局。
- 添加 project/session navigation、recent activity、mock conversation state 和 composer interactions。
- 添加 approval cards、QA pass/fail state、interrupt confirmation、refresh、new-session 和 upload-menu mock actions。
- 添加 Hypo-Workflow sidebar，渲染 progress、compact Markdown、config、architecture 和 knowledge entries。
- 添加 provider/model/reasoning switching UI，并提供 Codex、OpenCode 和 Claude Code mock mappings。
- 添加桌面列宽拖拽和移动端 approval sheet 行为。

### 文档

- 添加 README、用户指南、开发者指南、API 参考和 release changelog。

### 已知延期项

- 尚未实现真实 OpenCode 和 Claude Code backend adapters。
- File upload、resource opening、session rename 和 persistent project discovery 仍为 mock 或 placeholder flows。

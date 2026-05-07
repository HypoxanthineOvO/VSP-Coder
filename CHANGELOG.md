# 变更日志

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

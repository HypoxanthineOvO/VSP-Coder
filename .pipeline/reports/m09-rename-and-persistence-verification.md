# M09 Rename And Persistence Verification

状态: manual_validation  
时间: 2026-05-06 13:21 Asia/Shanghai

## 完成内容

- 新增 provider-neutral `rename_session` session action。
- Codex backend 将 rename 路由到 `thread/name/set`，参数为 `{ threadId, name }`。
- rename title 会 trim，并拒绝空标题，避免把无效名称写入 Codex。
- Codex rename 成功后会 invalidate discovery cache、清理 session in-flight guard，并强制 `thread/read includeTurns: true` 刷新。
- 刷新后的 Codex canonical `thread.name` 会覆盖本地/乐观标题并返回给前端。
- `thread/name/updated` notification 映射为 `live_session_patch.patch.title`，并触发 detail refresh。
- 前端新增桌面端和移动端 rename 入口；只对当前 Codex session 启用。
- `dataMode=dev-test` 保留本地 mock rename fallback，方便 UI 开发测试，但 Codex 模式不把本地 title cache 当作 canonical。
- knowledge 已记录 rename 方法、参数、canonical refresh 规则和持久化验收注意事项。
- M09 前置 bugfix：local deployment 强制使用 `full_auto`，防止卡在前端审批按钮不稳定路径；release deployment 仍保留可配置自动化档位。
- M09 前置 bugfix：session refresh/detail merge 现在允许当前 provider profile 覆盖旧 session 上残留的 `manual`/`untrusted` 元数据。
- M09 前置 bugfix：切换到 `full_auto` 时，后端会自动处理已打开的 approval request，不再依赖前端点击审批按钮。
- M09 前置 bugfix：移动端输入框使用 `visualViewport` 高度适配软键盘，并在 focus 时滚到输入区域。
- M09 前置 bugfix：移动端模型、reasoning、简易/详细按钮重新分配宽度，避免 `xhigh` 被截断。
- M09 前置 bugfix：前端刷新从“每个事件全量 `/api/state`”改为 live patch + Activity append + 静默 detail polling，降低对话流闪烁。
- M09 前置 bugfix：左侧 session 排序只在首次出现或 busy -> settled 时更新时间，不再每次 state refresh 归零重排。
- M09 前置 bugfix：刷新按钮改为显式刷新 state、当前 session detail 和 Codex model list，不再走无意义的 `refresh_state` session action。
- M09 前置 bugfix：`/api/models` 优先调用 Codex `model/list`，前端模型下拉只显示当前 provider 的模型；OpenCode/Claude 不再混入 Codex 模型选择。
- M09 前置 bugfix：移动端工作中/编辑文件浮标改为消息区下方的底部占位，不再 fixed 覆盖最新消息。
- M09 前置 bugfix：删除前端 reasoning 静态三项 fallback；当前模型未匹配时使用同 provider 的真实 `model/list` 结果，完全无模型数据时只保留当前 session 的 reasoning 值。
- M09 前置 bugfix：移动端输入 focus 时立即同步 `visualViewport`，并加入 `interactive-widget=resizes-content`，减少输入法跟随延迟。
- M09 前置 bugfix：当前 Codex session 无论是否由 VSP-Coder 发起，都会进行 scoped silent detail polling；外部/CLI 更新也能更快触发消息刷新和“思考中”状态。
- M09 前置 bugfix：VSP-Coder server root 会启用 self-protection，local `full_auto` 在该 cwd 下自动使用 `workspace-write` sandbox，并注入运行时生成的 developer instruction，避免在 VSP-Coder 内部 turn 中 kill/restart 承载自己的 4180 server。

## 修改文件

- `packages/protocol/src/index.ts`
- `apps/server/src/codexRename.ts`
- `apps/server/src/codexRename.test.ts`
- `apps/server/src/codexSessionMerge.ts`
- `apps/server/src/codexSessionMerge.test.ts`
- `apps/server/src/codexEvents.ts`
- `apps/server/src/codexEvents.test.ts`
- `apps/server/src/codexModels.ts`
- `apps/server/src/codexModels.test.ts`
- `apps/server/src/selfProtection.ts`
- `apps/server/src/selfProtection.test.ts`
- `apps/server/src/index.ts`
- `apps/server/src/store.ts`
- `apps/server/src/store.test.ts`
- `apps/web/src/main.tsx`
- `apps/web/src/styles.css`
- `.pipeline/knowledge/reference/codex-adapter-mapping.md`
- `.pipeline/knowledge/reference/vsp-provider-protocol.md`

## 自动验证

- `npm run typecheck` 通过。
- `npm test` 通过，包含 rename routing、canonical refresh merge、`thread/name/updated` event mapping、local full-auto enforcement、Codex `model/list` mapping、VSP self-protection 测试。
- `npm run build` 通过。
- `git diff --check` 通过。
- 4180 已重启到新构建，`/api/config` 返回 `deploymentMode=local`、`dataMode=codex`、`automationProfile=full_auto`。
- Codex app-server 已启动，provider health 为 `ready`。
- `/api/models` 当前返回 Codex `model/list` 的 5 个模型：`gpt-5.5`、`gpt-5.4`、`gpt-5.4-mini`、`gpt-5.3-codex`、`gpt-5.2`；每个模型 reasoning 都来自 API，当前为 `low`、`medium`、`high`、`xhigh`。

## 手工验证清单

1. 打开页面后确认顶部 profile 显示为全自动，发送命令/文件操作时不再出现需要手点的 approval card。
2. 观察运行中的会话刷新，确认左侧 session 排序不再每次刷新归零跳动，主消息区不再反复闪烁。
3. 点击刷新按钮，确认当前 session detail、state 和模型列表会更新。
4. 打开模型下拉，确认只看到 Codex 模型池，不混入 OpenCode/Claude。
5. 移动端点输入框，确认输入区能及时悬浮在输入法上方，不被键盘遮住。
6. 移动端确认模型、reasoning、简易/详细三个控件同一行显示，reasoning 包含 `low/medium/high/xhigh`。
7. 移动端运行时确认“思考中/编辑了...”浮标在底部占位，不覆盖最新消息。
8. 从 Codex CLI 或其他入口更新当前 thread，确认 VSP-Coder 当前会话能在 scoped polling 下跟进，而不是只响应 VSP 自己发送的消息。
9. 在 VSP-Coder 仓库自身 session 中不要让 Codex 执行重启 4180；如误触发，应由 self-protection 阻止直接 kill 自己并要求给出安全步骤。
10. 只选择 disposable tmp QA Codex thread，不要重命名正常历史 session。
11. 在当前 session 顶栏点击 rename 图标。
12. 输入一个明确测试名，例如 `M09 rename smoke 2026-05-06`。
13. 确认左侧 session 列表和当前会话标题变成新名称。
14. 刷新浏览器页面，确认同一个 thread 仍显示新名称。
15. 重启 VSP-Coder server 后再次打开页面，确认 discovery 列表和 session detail 仍显示新名称。

## 注意事项

- M09 是否 complete 取决于第 5、6 步手工持久化验证；当前只标记为 `manual_validation`。
- 当前运行中的 4180 已安全重启到新构建；重启前已确认监听 PID 和 cwd/cmdline 均属于当前 repo root 的 `node apps/server/dist/index.js`。
- 如果 Codex app-server 版本变更导致 `thread/name/set` 参数或事件名变化，需要优先更新 Codex adapter mapping 和对应测试。

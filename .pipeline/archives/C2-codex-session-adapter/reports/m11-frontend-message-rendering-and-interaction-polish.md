# M11 Frontend Message Rendering And Interaction Polish

状态: manual_validation  
时间: 2026-05-06 00:28 Asia/Shanghai

## 完成内容

- 引入统一 Markdown 渲染组件，聊天消息和 Workflow/Project Status 摘要共用同一路径。
- 支持 GFM 列表、嵌套列表、表格、任务列表、引用、链接、行内代码和 fenced code block。
- 支持 `remark-math` + KaTeX 的行内公式和块公式渲染。
- 支持 raw HTML 的安全子集，经过 `rehype-sanitize` 过滤后再渲染。
- 新增 command output 解析 helper；tool 消息中 `$ /bin/zsh -lc ...` 形式的命令默认折叠。
- 命令折叠态显示具体摘要，例如 `已运行 npm test`；展开后显示完整命令和 output。
- 顶部 session statusbar 改为 sticky，滚到底部时仍保持在消息区顶部可见。
- 提升暗色主题亮度，增强 primary/send/pending 按钮亮度。
- 为按钮、项目/session 行、资源入口等交互元素加入 hover、press、focus-visible 动效。
- 移动端对 Markdown 表格、代码块、命令输出增加内部滚动约束，避免页面超宽。
- Markdown 依赖拆成 `markdown` vendor chunk，主 bundle 保持轻量。
- 验收修正：命令折叠 marker 降为背景融合的小字 chip，File change tool notice 同样降噪。
- 验收修正：展开命令行加入 shell prompt/string/flag 轻量高亮。
- 验收修正：hover glow 更明显。
- 验收修正：移动端移除独立 session dock，将状态、runner、profile 合并到顶栏副信息。
- 验收修正：running/waiting/queued Codex session 增加 1s 轻量刷新，并让后端 busy session 绕过 stale cache，以补强 SSE live patch 之外的实时可见性。
- 二次验收修正：恢复移动端模型/强度切换入口，将其作为顶栏下方的紧凑控制条；隐藏消息区内的 sticky statusbar，避免出现无归属悬浮栏。
- 二次验收修正：tool/command/file-change 消息不再作为普通消息气泡常驻；完成后从消息流视觉上消失，只保留正常对话。
- 二次验收修正：运行中仅在消息区底部中间显示淡色 `思考中`/命令状态浮标，点击可查看当前命令详情。
- 三次验收修正：运行态浮标在 assistant 打字、命令执行、文件编辑、等待审批时都持续显示；文件编辑聚合为 `编辑了 x, y, z 文件`。
- 三次验收修正：前端 running session 轮询加快到 650ms，后端 busy session cache TTL 调整为 500ms，并在 detail merge 时保留 SSE live delta，避免轮询覆盖流式内容。
- 四次验收修正：PC 顶部 statusbar 改为横向居中 dock，各项按内容宽度排列，避免 `Codex 默认` 撑成大块。
- 四次验收修正：`turn/start` 成功后后端立即乐观标记 session 为 `running` 并推送 live patch，避免初始 `thread/read` 返回 idle 导致前端不进入实时刷新。
- 五次验收修正：发送后前端本地保留 active-run 状态，不再用发送后的全量刷新覆盖后端返回的 running 乐观态，确保至少显示 `思考中` 浮标。
- 五次验收修正：增加 5s 后台心跳，定期刷新全局 state 和当前 session detail，避免只能手动点击刷新才更新。
- 五次验收修正：tool 消息重新以居中、淡色、小号折叠提示显示；命令可点开查看详情，但不再占用完整对话卡片。
- 六次验收修正：刷新心跳从 5s 调整到 2.5s；running session 仍保留 650ms detail polling。
- 六次验收修正：新增 `简易/详细` 小切换按钮；简易模式隐藏所有工具/文件修改明细但保留工作中浮标，详细模式显示全部工具并默认展开命令输出。
- 六次验收修正：移动端显示模式按钮并入顶栏操作区，不再占用额外行；移动端模型选项缩短 `Codex 默认` 为 `Codex`。
- 六次验收修正：移动端 workspace 明确划分顶栏、模型条、消息流和底部区域，避免模型条被对话流遮挡。
- 六次验收修正：工作中浮标改为 fixed overlay，脱离消息流滚动布局；File change 提示会从 artifacts 和 tool 文本中提取文件名。
- 六次验收修正：`/api/state` 增加 `defaultProjectId`，前端首次打开优先接入当前部署仓库项目，而不是全局最近测试会话。
- 七次验收修正：详细模式不再默认展开命令，只显示折叠工具卡片；多个 File change tool 聚合为一条文件编辑总结。
- 七次验收修正：移动端模型、思考强度、简易/详细模式收进同一行，详细模式下工具卡增加宽度约束，避免撑宽页面。
- 七次验收修正：工作中浮标增强亮度，并在 live delta/artifact 更新后保持本地 active 状态，结束后延迟收起以减少闪烁。
- 七次验收修正：左侧 Session 排序改为按 settled 更新时间，running/waiting/queued 刷新期间保持原位置，避免流式刷新造成列表跳动。

## 修改文件

- `apps/web/package.json`
- `package-lock.json`
- `apps/web/src/main.tsx`
- `apps/web/src/rendering.ts`
- `apps/web/src/styles.css`
- `apps/web/vite.config.ts`
- `apps/server/src/index.ts`

## 自动验证

- `npm run typecheck` 通过。
- `npm test -w @vsp-coder/web` 通过。
- `npm run build` 通过。
- `npm test` 通过。
- `npm run typecheck` 通过。
- `npm run build` 通过。
- `npm test` 通过。
- `npm run typecheck` 通过。
- `npm run build` 通过。
- `npm test` 通过。
- `npm run build -w @vsp-coder/web` 通过，无 chunk warning。
- `git diff --check` 通过。

## 手工验证建议

1. 发送一段包含嵌套列表、表格、任务列表、引用、链接、行内代码、代码块的 Markdown，确认渲染正确。
2. 发送包含 `$a^2+b^2=c^2$` 和 `$$E=mc^2$$` 的消息，确认聊天和 Project Status 中都能显示公式。
3. 发送安全 HTML，如 `<details><summary>展开</summary><mark>内容</mark></details>`，确认可显示。
4. 发送危险 HTML，如 `<script>alert(1)</script>` 或 `<img onerror=...>`，确认不会执行危险内容。
5. 打开包含命令执行记录的 session，确认命令默认折叠，点开后有完整 `$ ...` 和 output。
6. 滚到消息底部，确认顶部 session statusbar 不需要往上翻也能看到。
7. 在移动端检查 Markdown 表格、代码块、命令输出不会撑宽页面。

## 注意事项

- KaTeX 和 Markdown 依赖体积较大，已通过 Vite manual chunk 单独拆出。
- 目前命令折叠识别覆盖 VSP/Codex 当前的 tool 文本格式；后续如果协议层给 command item 明确结构化字段，可改为直接按 artifact/item metadata 渲染。

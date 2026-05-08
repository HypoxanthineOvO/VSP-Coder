# C3 M0 全栈审计报告

## 摘要

本次 M0 是只读审计，未修改业务代码。审计覆盖 `apps/web`、`apps/server`、`packages/protocol`、脚本、文档、本地 `.vsp-coder/` 状态和依赖安全。

基线结论：当前类型、单元测试、构建和依赖审计均通过，但用户已知体验问题都能在现有代码路径中找到合理根因。最大结构性缺口是：前端没有持久化的 session selection 状态，协议没有结构化错误/重试模型和结构化 Subagent trace，前端缺少 E2E/截图验证与统一 motion system。

M0 完成后建议先补充计划，再继续 M1+：M1 应优先建立 Playwright/截图夹具，同时把 M2 和 M3 的失败路径测试前置；M5 的动效体系需要与 M4 响应式布局联动，避免只改视觉。

## 基线验证

| 命令 | 结果 | 说明 |
|---|---|---|
| `npm run typecheck` | pass | protocol/server/web TypeScript 检查通过。 |
| `npm run test` | pass | protocol 3 项、server 54 项、web typecheck 均通过。 |
| `npm run build` | pass | protocol/server/web 构建通过，Vite 产物生成成功。 |
| `npm audit --audit-level=moderate` | pass | found 0 vulnerabilities。 |

当前没有 Playwright 配置或 E2E/截图脚本；`apps/web/package.json` 的 `test` 只是 `tsc --noEmit`。因此 UI 交互、响应式和动画问题目前主要靠人工发现，缺少自动化回归网。

## 重点发现

### F1. 默认会话选择没有用户持久化，且 fallback 会静默跳到排序第一项

证据：

- `apps/web/src/main.tsx:396-397` 初始化 `activeProjectId`/`activeSessionId` 为空。
- `apps/web/src/main.tsx:101-104` 和 `533-535` 只持久化 tool display mode，没有持久化 active project/session。
- `apps/web/src/main.tsx:572-582` 首次加载只按 `state.defaultProjectId` 或第一项目，然后选择该项目下 `allSessions.find(...)`。
- `apps/web/src/main.tsx:541-542` 当 `activeSessionId` 找不到时直接使用 `projectSessions[0]`，没有告知用户。
- `apps/web/src/main.tsx:2085-2099` 排序依赖本次运行内的 `sessionSortTimesRef`，刷新后会重新从 provider `updatedAt` 建立排序。

影响：打开前端时可能进入 provider 排序第一项或 fallback 项，而不是用户上次选择项。若 provider 的 `updatedAt`、cached-only sessions 或预取刷新事件让旧会话排前，用户就会看到“默认加载到很老的会话”。

修复入口：M2 应添加 `localStorage` 或本地 metadata 的 last selection 模型，恢复前校验 project/session 存在，失效时显示 fallback 原因。

### F2. reasoning/model 切换缺少前端 loading、失败捕获、回滚和真实 provider 确认

证据：

- `apps/web/src/main.tsx:721-733` 的 `act` 没有 `try/catch`，调用处使用 `void act(...)`，失败会变成不可见 rejected promise。
- `apps/web/src/main.tsx:1252-1268` 与 `1321-1339` 的 model/reasoning select 没有 pending/disabled 状态。
- `apps/server/src/index.ts:360-382` 切换只更新本地 `sessionCache` 并记录事件；没有向 Codex 持久化 session setting，也没有返回结构化失败原因。
- `apps/server/src/index.ts:400-413` model/list 失败会静默 fallback，用户无法知道 capability 来源是否真实。
- `apps/web/src/main.tsx:218-219`、`315-316` merge 时偏向 existing model/reasoning，可能掩盖 provider refresh 中的真实值。

影响：切换时可能等待 `model/list` 或网络/provider 请求，UI 没有反馈；失败路径不渲染；后续刷新可能出现本地状态与 provider 状态不一致。

修复入口：M2 应把 switch 变成小状态机：pending、success、failed、rollback、retry，并将 provider capability 和最终 session profile 区分清楚。

### F3. 错误传播只有字符串，不足以支撑底部错误卡片和分级恢复

证据：

- `apps/web/src/main.tsx:171-177` 的 `api` 只在非 2xx 时 `throw new Error(await res.text())`，丢失 HTTP status、retry policy 和 request context。
- `apps/web/src/main.tsx:458-459`、`648-649`、`677-679`、`714-715` 只写入 `sessionLoadError` 字符串。
- `apps/web/src/main.tsx:721-733` 的 session action 没有捕获错误。
- `apps/web/src/main.tsx:1158-1164` 只在消息区内显示 inline error；没有底部错误卡片、重试卡片或技术详情。
- `apps/server/src/index.ts:86-92` 统一错误响应为 `{ error: message }`，没有 code、kind、retryAfter、details redaction。
- `apps/server/src/codex.ts:127` JSON-RPC error 只保留 `message`，丢掉 code/data。
- `apps/web/src/main.tsx:469-481` 只监听 SSE `vsp` event，没有 `EventSource.onerror` 渲染。

影响：502、429、SSE 断开、provider 失败、发送失败等不能统一显示，也无法做 429 冷却、502 重连、发送失败保留草稿等分级恢复。

修复入口：M3 应先扩展协议错误模型，再改 server 规范化和 frontend bottom error/retry card。

### F4. 窄桌面布局把 Project 信息降级得过激，导航可达性不稳定

证据：

- `apps/web/src/main.tsx:77-99` 在 `1101-1540px` 直接把 global rail 压到 `72px`。
- `apps/web/src/styles.css:1171-1201` 在窄桌面隐藏 global rail 的 section、activity、recent sessions、project 名称和 session card 文本。
- `apps/web/src/styles.css:1248-1280` 只有 `<=1100px` 才启用 mobile drawer；`1101-1220px` 仍然是桌面窄 rail，没有可读 Project 列表。
- `apps/web/src/main.tsx:831-887` session rail 在桌面常驻，但 Project 选择主要仍依赖 global rail。

影响：宽度不够但仍大于 1100px 时，Project 列表视觉上只剩色点/图标，用户感知为“列表看不见”；右 rail 仍占用至少 300px，进一步挤压主工作区。

修复入口：M4 应增加 desktop-narrow navigation affordance，例如 Project/session drawer、rail labels on focus/hover、可配置右栏折叠和明确断点策略。

### F5. Subagent trace 是文本化启发式，默认 simple 模式会隐藏 tool trace

证据：

- `packages/protocol/src/index.ts:69-72` 的 `MessageBlock` 没有结构化 Subagent block。
- `apps/server/src/codexDiscovery.ts:146-173` 把 Codex items 转成普通 text message。
- `apps/server/src/codexDiscovery.ts:176-184` 只通过 `type/name/toolName/title` 中的字符串判断 Subagent。
- `apps/server/src/codexEvents.ts:201-204` 只通过 method 名称包含 `subagent/spawn_agent/wait_agent` 判断。
- `apps/web/src/main.tsx:1171-1174` simple mode 过滤所有 tool message。
- `apps/web/src/main.tsx:1457-1499` 前端只对文本 trace 打开 modal，modal 只有详情和关闭按钮，没有交互动作。
- `apps/server/src/index.ts:657-704` 会在用户文本提到 subagent/worker 时注入“requested/not observed”合成 trace，说明真实 provider trace 本身不可靠。

影响：真实 Subagent item 形状稍有变化就无法识别；默认简易模式下 trace 被过滤；即使识别到也只是文本详情，不支持进入交互。

修复入口：M6 应引入结构化 Subagent trace 协议字段和兼容映射，前端在 simple mode 下也显示精简入口，并明确 provider 不支持交互时的限制。

### F6. Motion system 分散，发送状态存在布局变化和高频重渲染风险

证据：

- `apps/web/src/styles.css:14` 对所有 button 套 transform、box-shadow 等 transition。
- `apps/web/src/styles.css:107-113` 对 project/session/resource 等大量列表项套 hover transform/shadow。
- `apps/web/src/styles.css:717-728`、`796-817`、`1422-1424` 分散定义 keyframes，没有全局 token。
- 未发现 `prefers-reduced-motion`。
- `apps/web/src/main.tsx:1718` send button 在 `发送` 和 `发送中` 间切换文本，按钮没有固定宽度。
- `apps/web/src/main.tsx:551-558` active Codex session 即使 idle 也每 1.8s silent hydrate；`560-570` message length 变化触发 scroll。

影响：发送时按钮宽度、active tool 浮层、消息列表更新和轮询刷新叠加，容易造成卡顿或视觉跳动。动效缺少统一的 duration/easing/reduced-motion 约束。

修复入口：M5 应先定义 motion tokens，再重构发送、列表、面板、错误卡片和 reduced-motion。

## 安全与可靠性审计

### S1. 本地服务默认绑定 `0.0.0.0` 且 API/SSE 使用 wildcard CORS

证据：

- `README.md:37` 说明构建后的服务默认绑定 `0.0.0.0`。
- `scripts/deploy-local.mjs:12` 默认 host 为 `0.0.0.0`。
- `apps/server/src/index.ts:959-965` SSE 设置 `Access-Control-Allow-Origin: *`。
- `apps/server/src/index.ts:1002-1004` JSON API 设置 `Access-Control-Allow-Origin: *`。
- API 可执行配置更新、session 创建、发送、action 等写操作，当前没有 auth/CSRF boundary。

风险：在同一局域网或容器网络中，其他页面/机器可能向本地服务发起跨源请求，触发 Codex action、配置变更或会话操作。考虑到本地默认 `full_auto`，这是 C3 之后应该优先硬化的安全风险。

建议：默认绑定 `127.0.0.1`，显式 `--host 0.0.0.0` 才开放；限制 CORS origin；为 mutating API 加本地 token 或 same-origin nonce；文档明确 LAN 风险。

### S2. 错误与 health 信息可能泄漏路径或 provider 内部细节

证据：

- `apps/server/src/index.ts:90-91` 直接返回 `Error.message`。
- `apps/web/src/main.tsx:1920` Settings 直接展示 `codexHealth.lastError`。
- `apps/web/src/main.tsx:1966` provider badge title 直接放 `health.lastError`。
- 多处 `store.recordEvent` 把 provider error message 直接进 Activity。

风险：错误详情可能包含绝对路径、命令、环境片段、provider 内部状态或敏感 header。M3 的错误卡片必须同时做脱敏。

### S3. 请求 body 没有大小限制，JSON parse 失败也没有结构化错误

证据：

- `apps/server/src/index.ts:1007-1010` 将所有 chunks 拼接后 `JSON.parse`。

风险：大请求可造成内存压力；无效 JSON 走 500 风格错误，不利于用户恢复。

建议：添加 body size limit、415/400 结构化错误、统一 redaction。

### 正向发现

- `apps/server/src/preview.ts:49-55` 对 artifact preview 做 project-root confinement。
- `apps/server/src/store.ts:862-870` workflow file 读取使用 `safeJoin` 防 path traversal。
- `apps/server/src/selfProtection.ts:4-7` 对 server root 下 full_auto sandbox 做降级。
- `npm audit --audit-level=moderate` 当前无已知中高风险依赖漏洞。

## 可扩展性与测试缺口

- `packages/protocol/src/index.ts` 缺少结构化 error、retry、subagent、frontend operation state，导致前端只能靠 `payload?: unknown` 和文本解析扩展。
- `apps/server/src/index.ts` 的 route/action 分发集中在大函数，后续 provider 增加会继续膨胀。
- `apps/web/src/main.tsx` 单文件承载主要 app 状态、渲染、协议转换和交互状态，后续 M2-M6 易互相影响。
- 当前没有 Playwright、截图、性能或可访问性自动化。用户痛点集中在 UI 交互，但测试主要覆盖 server/protocol。
- `.vsp-coder/mock-store/state.json` 中 Activity 有大量重复 refresh 事件，说明现有刷新/记录策略有噪音，可能影响“最近活动”和认知负担。

## 补充 Plan 建议

1. 保留 M1，但把它拆成两个检查点：先建测试 harness，再补用户痛点场景。否则 M2-M6 会缺少红灯测试。
2. M2 和 M3 应作为最高优先级实现修复：session selection、reasoning 切换和错误卡片是日常使用阻塞。
3. M4 和 M5 应联动执行或至少互相 review：响应式布局和 motion 都会触碰 `styles.css`、composer、rail 和 panel。
4. M6 不应只修正则；必须扩展或约束 protocol，否则 Subagent 仍会在 provider schema 变化时失效。
5. 建议新增安全硬化子任务，可能插入在 M3 后或 M7 前：host/CORS/body limit/error redaction。若不新增 Milestone，也必须纳入 M3/M7 验收。

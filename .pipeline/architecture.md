# Architecture Baseline - VSP-Coder C3

## 项目概览

VSP-Coder 是一个本地 Web 工作台，用于管理 AI coding 后端会话。当前架构由 React + Vite 前端、Node.js 后端服务和 `@vsp-coder/protocol` 共享协议包组成。浏览器只与 VSP-Coder HTTP/SSE API 通信，后端负责 Codex app-server 集成、会话发现、队列、事件、审批、错误和 provider 数据映射。

C3 不改变这个基本边界，而是在 C2 Codex adapter 基础上做全栈审计、体验修复和可验证的前端动效体系建设。

## 当前代码结构

- `apps/web/src/main.tsx`：前端工作台主状态、会话选择、消息区、composer、右侧面板、Subagent trace UI、错误展示入口。
- `apps/web/src/styles.css`：整体布局、rail、响应式断点、状态栏、消息、卡片和动效规则。
- `apps/web/src/rendering.ts`：命令输出解析等渲染辅助逻辑。
- `apps/server/src/index.ts`：HTTP/SSE API、Codex session refresh、send/action、错误返回、事件广播。
- `apps/server/src/store.ts`：dev/test store、mock session、工作流文件和本地状态辅助。
- `apps/server/src/codex*.ts`：Codex app-server client、discovery、events、models、requests、artifacts、queue、rename、session merge。
- `packages/protocol/src/index.ts`：Project、Session、Message、Event、RequestCard、Artifact、Metric 等浏览器共享协议类型。

## C3 架构关注点

### 审计与补充计划

M0 先建立证据，不做业务修复。审计报告必须把用户已知 Bug 映射到源码证据、数据流、状态机、失败路径和修复入口。M0 结束后必须进行补充 Plan，允许重排、拆分或新增后续 Milestone。

### 会话选择

前端当前会话选择涉及 project/session 列表、session 排序、hydration、SSE refresh 和本地 UI 状态。C3 的目标是将“上次选中会话”作为明确策略：持久化选择、恢复可用会话、不可用时进入可预测 fallback，并避免刷新后跳到旧会话。

### 消息生命周期与缓存一致性

M0 补充审计确认，消息不是普通数组追加问题，而是 provider identity、live patch、server cache、frontend stale response、queue 和错误恢复共同构成的状态机。C3 应在实现层明确：

- outbound message identity，例如 `clientMutationId` 或等价字段。
- optimistic user message 与 provider final item 的合并关系。
- providerItemRef/id-first merge；内容去重只能用于同一 provider item 的 live/final 对齐。
- server provider refresh 必须保留 previous live-only messages，直到 provider 明确确认或替换。
- 前端 `/api/state` 和 detail refresh 必须有 freshness/version/request generation 边界。
- queue item 的 pending/sent/confirmed/failed/cleared 状态必须能与主消息流同步。

### 控制面可靠性

reasoning/model 切换是用户高频控制面。它需要快速反馈、并发保护、失败回滚、provider capability 校验和可见错误。前端不应因为后端响应慢而表现成“卡死”，后端也需要提供足够错误语义。

### 错误模型

现有 `VspEvent` 支持 `error`，API 也会返回 `{ error }`，但 C3 要把它升级成可恢复的用户体验。建议扩展或约束统一错误模型：

- 错误类型。
- HTTP 状态码或 provider 状态。
- 用户可理解说明。
- 脱敏技术详情。
- retry policy。
- 关联 session/project/queue item。

前端使用底部错误卡片和重试卡片展示所有用户相关错误，并按 429、502、SSE 断开、发送失败等类型分级恢复。

### 响应式外壳

工作台 shell 使用多 rail/grid 布局，窄桌面和移动边界是高风险点。C3 需要明确 rail 的最小宽度、折叠策略、打开入口、resize handle 行为、右侧面板优先级和 composer 可用性，确保 Project/session 导航始终可达。

### Motion System

动效应集中在低成本属性：`opacity`、`transform`、有限的 `box-shadow`，避免频繁触发布局。C3 应定义 duration/easing/token，覆盖发送、消息入列、面板切换、列表展开、加载态、错误卡片，并提供 `prefers-reduced-motion` 降级。

### Subagent Trace

Subagent 不应只依赖文本正则识别。C3 应审计真实 Codex item 形状，必要时在 `@vsp-coder/protocol` 中引入结构化字段或 artifact/message 类型，使 server 转换和 web 展示可扩展。无法直接交互时，UI 要明确说明限制；可交互时提供稳定入口。

## 验证矩阵

主线验证：

- TypeScript workspace：`npm run typecheck`
- 单元/集成：`npm run test`
- 构建：`npm run build`
- Chromium E2E：`npm run e2e -- --project=chromium`
- Chromium 截图：`npm run screenshots -- --project=chromium`

视口矩阵：

- `1440x900`
- `1280x800`
- `1024x768`
- `768x900`
- `390x844`

## 安全与质量边界

- 错误详情必须脱敏 token、authorization、cookie、敏感 header、secret 和不必要的绝对路径。
- 浏览器不接触 Codex 原始认证状态。
- Provider adapter 继续隐藏 Codex JSON-RPC 细节，浏览器面向稳定 VSP protocol。
- 文档面向用户、发布和项目说明时必须使用中文。
- 本地服务重启仍需遵守 `safe-service-restart` 规则，不得批量按端口杀进程。

## Milestone M0 / Post-Audit Plan Review

### ADDED

- 消息生命周期与缓存一致性成为 C3 独立计划轴。
- M1 需要先建立消息生命周期红灯测试，而不是只证明 Playwright 可运行。
- M5 需要纳入消息渲染性能和 refresh event 降噪。

### CHANGED

- 后续 prompts 不建议 unchanged 运行。
- 原 M2 过胖，应把 message/cache consistency 拆出并前置。
- 原 M3 错误恢复需要依赖消息 identity 和 queue 收敛。

### REASON

- M0 补充审计和 Subagent 反审计发现直接吞消息路径：server provider refresh 丢 live-only messages、前端 `/api/state` 非空旧 messages 覆盖新 live 状态、内容去重删除合法重复消息、Codex send 缺少 optimistic user message。

### IMPACT

- downstream prompts affected: M1-M7。
- applied prompt updates: 用户已确认 `.plan-state/prompt-patch-queue.yaml`；未执行部分已调整为 M1-M8：M1 红灯测试，M2 消息生命周期与缓存一致性，M3 会话选择与 reasoning，M4 错误恢复，M5 响应式，M6 动效/性能/事件降噪，M7 Subagent，M8 回归收口。

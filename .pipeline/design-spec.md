# Design Spec - VSP-Coder C3

## 目标

C3 是一次“审计优先”的体验质量专项。目标不是立刻分散修 Bug，而是先完成全栈代码审计，把用户已经观察到的痛点逐条解释清楚，再基于证据补充修复计划并推进实现。

本 Cycle 覆盖前端、后端、协议边界、持久化、本地启动部署脚本、测试、文档、安全、错误恢复、可扩展性和整体交互体验。前端动效不是局部补丁，而要形成统一、轻量、可验证、尊重 `prefers-reduced-motion` 的 motion system。

## 已知 Bug 检查项

审计完成后必须逐条解释下列问题的根因、影响面、修复入口和验证方式：

- 前端默认加载到很老的会话。
- 点击切换 `xhigh` 等 reasoning 档位很慢，并且有失败概率。
- 发送动画明显卡顿。
- PC 端口宽度不足时左侧 Project/session 列表不可见或不可达。
- Subagent 识别不到，无法进入详情或交互。
- 502、429 等错误没有被完整捕捉和渲染。
- 前端动画效果缺少统一体系。

## 用户决策

- 执行顺序：先审计，再根据审计结果对照 Bug 列表解释问题，然后制定和补充修复计划。
- M0 审计结束后已运行补充 Plan Review，并确认重排后续 Milestone；后续执行以 M1-M8 rebaseline 为准。
- 默认会话策略：优先恢复用户上次选中的会话；不可恢复时再走确定性 fallback。
- 错误体验：所有用户相关错误都必须渲染。前端使用底部错误小卡片和重试卡片。
- 错误详情：错误卡片展示类型、HTTP 状态、用户说明、重试动作，以及可展开的脱敏技术详情。
- 恢复策略：按错误类型分级，例如 429 冷却后重试，502/SSE 断开支持重连，发送失败保留草稿和队列上下文。
- 浏览器验证主线：Chromium。Firefox/WebKit 可作为后续 smoke，不阻塞主线。
- 实现与审计/验证分开，采用 `worker_separation.mode=recommended`。

## 验证策略

自动化验证是主线，至少包括：

- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run e2e -- --project=chromium`
- `npm run screenshots -- --project=chromium`

Playwright 和截图检查需要覆盖：

- 上次选中会话恢复。
- reasoning 切换成功、失败、回滚、重试。
- 502、429、SSE 断开、发送失败等错误卡片。
- Subagent trace 识别和详情打开。
- Project/session 导航在 `1440x900`、`1280x800`、`1024x768`、`768x900`、`390x844` 下可达。
- 发送、面板切换、列表展开、加载态、错误态的动效关键状态。

## Milestone 策略

C3 拆为 8 个 Milestone：

1. M0 全栈审计与已知 Bug 根因矩阵。
2. M1 Chromium Playwright、截图与消息生命周期红灯基线。
3. M2 消息生命周期与缓存一致性。
4. M3 会话选择与 reasoning 控制面可靠性。
5. M4 错误事件、底部错误卡片与分级恢复。
6. M5 响应式工作台外壳与导航可达性。
7. M6 统一前端动效体系、发送性能与事件降噪。
8. M7 Subagent trace 识别、详情与交互入口。
9. M8 全量回归、扩展性硬化与文档同步。

## 非目标

- 不在 M0 直接修业务代码。
- 不把 Firefox/WebKit 作为主线阻塞项。
- 不引入全新的前端框架或大型动效库，除非审计证明现有方案无法满足性能与维护性。
- 不把错误详情中的 token、敏感 header、用户私密路径直接暴露到 UI。
- 不重写 provider 架构；优先在现有 VSP protocol/provider adapter 边界上演进。

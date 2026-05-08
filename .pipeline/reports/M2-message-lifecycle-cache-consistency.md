# M2 消息生命周期与缓存一致性报告

- Cycle：C3
- Milestone：M2 消息生命周期与缓存一致性
- 完成时间：2026-05-07T22:33:44+08:00
- 状态：complete

## 目标

修复 M0/M1 标出的消息生命周期高风险问题：provider refresh 吞 live-only 消息、前端刷新用旧状态覆盖新消息、同文本消息被误去重、忙时排队无可见用户消息，以及轮询/刷新请求乱序造成的状态回退。

## 变更

- 后端 `mergeProviderRefresh` 改为按 `id/providerItemRef` 合并消息，并保留本地 live-only 消息直到 provider 明确给出同身份消息。
- 后端 live patch 合并移除全局“同角色同文本”去重，改为身份匹配；同文本但不同 provider item 的消息会同时保留。
- `enqueuePendingMessage` 会同步创建与 queue item 绑定的乐观 user message，保证忙时发送的消息立即可见。
- `startCodexTurn` 会为非排队发送创建乐观 user message；队列 drain 时复用 queue item id，避免重复插入。
- 前端 `mergeStatePreservingDetails` / `mergeDetailedSession` 改为身份合并消息，防止 `/api/state` 非空旧 messages 覆盖 SSE/详情接口里的新 live 消息。
- 前端 `loadSessionDetail` 增加 per-session AbortController 和请求序号；`refresh` 增加 state 请求序号，避免旧请求晚返回覆盖新状态。
- M1 的 4 个 expected-red Playwright 用例转为通过型回归，并补充 server 单测覆盖 live-only preservation、distinct same-text message、queue optimistic message。

## 验证

- `npm run typecheck`：通过
- `npm run test`：通过，56 个单测通过
- `npm run e2e -- --project=chromium --grep "message|refresh|queue|cache"`：通过，4 个 Chromium 用例通过
- `npm run build`：通过

## 剩余风险

- 错误状态的底部错误卡片、重试卡片、429/502 等 HTTP 错误渲染属于 M4。
- 会话默认选中上次选择、reasoning/xhigh 控制面慢和失败恢复属于 M3。
- 发送动画卡顿、长会话渲染性能、统一动效体系属于 M6。

# C3 M0 Subagent 反审计摘要

时间：2026-05-07T21:25:46+08:00

对象：`.pipeline/reports/M0-frontend-cache-refresh-performance-audit.md`

## 结论

Subagent 只读检查后给出的可信度为“高”。核心发现有源码支撑：内容去重风险、Codex 发送缺少 optimistic user message、SSE/轮询/refresh 多源并发、server cache/event 噪音和 React 全量渲染风险均成立。

## 已采纳修订

- 升级为 Critical：server `refreshCodexSession -> mergeProviderRefresh` 不合并 previous messages，会丢掉 provider 尚未 materialize 的 live-only messages。
- 升级为 Critical：前端 `/api/state` incoming session 非空但更旧时，`mergeStatePreservingDetails` 会覆盖现有 live/hydrated messages。
- 补充 queue sent/confirmed/failed 收敛风险。
- 补充测试缺口：web test 当前只是 TypeScript；`mergeProviderRefresh` 测试未覆盖 live-only message 保留。
- 修正过强措辞：server provider read path 不是按内容去重；Queue 还有状态栏数量提示；长会话卡顿当前应表述为需要基线验证的高概率性能风险。

## Plan 影响

- M1 需要先建立消息生命周期红灯套件。
- 建议新增 M2.5“消息生命周期与缓存一致性”，先修 message identity、optimistic outbound、provider/cache merge、freshness metadata、request generation 和 queue 收敛。
- M2 保留会话选择与 reasoning 控制面，避免过胖。
- M3 接入发送失败、refresh 失败和 SSE 断线的统一错误恢复。
- M5 纳入消息渲染性能和 refresh event 降噪。

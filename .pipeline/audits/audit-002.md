# Audit Report — 2026-05-07

> Language: zh-CN | Timezone: Asia/Shanghai

## Summary

- Scope: C3 M2-M4 implemented changes after Playwright baseline, message lifecycle/cache consistency, session/reasoning reliability, and error recovery.
- Method: local evidence review + independent Subagent read-only audit.
- Files scanned: 14 key implementation/test files.
- Findings: 2 Critical, 6 Warning, 2 Info.
- Gate decision: **M5 前应先安排短修复门禁**。M5 可以继续讨论布局和动效，但不建议直接进入大改 CSS 前忽略 Critical。

## Critical

- [BUG-01] [apps/server/src/codexQueue.ts](/home/heyx/VSP-Coder/apps/server/src/codexQueue.ts:10) / [apps/server/src/codexQueue.ts](/home/heyx/VSP-Coder/apps/server/src/codexQueue.ts:27) / [apps/server/src/codexSessionMerge.ts](/home/heyx/VSP-Coder/apps/server/src/codexSessionMerge.ts:43) — optimistic user message 没有完整生命周期收敛。
  入队时 queue item 会创建可见 user message，但清空队列只把 queue item 标记为 `cleared`，不移除或标记对应 optimistic message。队列真正发送后，provider final message 的 id/providerItemRef 通常来自 provider item，和本地 queue id 不一致，当前合并只按 id/providerItemRef 匹配，因此 optimistic 与真实 provider user message 可能长期并存。
  影响：清空队列后用户仍看到“已发送”的消息；provider 确认后出现重复 user message；M2 的“可见性”修复没有完成“收敛”闭环。
  建议：为 outbound/optimistic message 增加生命周期字段或本地 pending map；clear queue 时删除或标记 cancelled；provider final merge 时对 optimistic outbound 做一次性确认/替换，规则应区别“真实 provider 同文本不同 item”和“本地 optimistic 待确认 item”。

- [SEC-01] [apps/server/src/index.ts](/home/heyx/VSP-Coder/apps/server/src/index.ts:72) / [apps/server/src/index.ts](/home/heyx/VSP-Coder/apps/server/src/index.ts:76) / [apps/web/src/main.tsx](/home/heyx/VSP-Coder/apps/web/src/main.tsx:519) — 非 HTTP 错误事件未统一走 AppError 脱敏。
  HTTP API catch 已返回 AppError，但 Codex stderr、protocol error、provider notification error 仍可能以 raw `event.message` 写入 store/SSE。前端会把 error event 的 message 放进错误卡和 Activity。
  影响：Authorization、cookie、token、secret、本地路径或 provider 原始错误可能进入前端和持久事件。
  建议：服务端 `recordEvent` / `publishTransientEvent` 的 error 路径统一使用 AppError helper；事件 message 使用安全摘要，技术详情只存脱敏后的 `technicalDetail`；客户端也补齐路径脱敏作为最后防线。

## Warning

- [BUG-02] [apps/web/src/main.tsx](/home/heyx/VSP-Coder/apps/web/src/main.tsx:698) — retry target 不足，重试可能发错 session 或没有重放原操作。
  `retry_send` 先 `setActiveSessionId` 再立即调用闭包里的 `sendMessage()`，存在 session/draft 仍是旧闭包的风险。`retry_request` 目前只是刷新状态，不能重放 switch/rename/create 的原请求。
  建议：AppError target 增加 operation/method/body 或 retry token；发送重试改成 `sendMessage({ sessionId, text, tokens })` 显式参数。

- [BUG-03] [apps/server/src/codexSessionMerge.ts](/home/heyx/VSP-Coder/apps/server/src/codexSessionMerge.ts:6) / [apps/web/src/sessionMerge.ts](/home/heyx/VSP-Coder/apps/web/src/sessionMerge.ts:158) — model/reasoning 合并长期偏向旧前端状态。
  M3 修了本地切换体验，但普通 refresh/detail 合并仍保留 existing model/reasoning，可能覆盖 provider canonical 或其他窗口的更新。
  建议：只在 `modelSwitch.status === pending` 时保留 optimistic；成功/失败/普通刷新应接受后端 canonical 值，必要时加 version/updatedAt 仲裁。

- [BUG-04] [apps/web/src/main.tsx](/home/heyx/VSP-Coder/apps/web/src/main.tsx:316) / [apps/web/src/main.tsx](/home/heyx/VSP-Coder/apps/web/src/main.tsx:341) — 旧 session detail 失败可能污染当前 session 的 inline error。
  detail request 只按同 session abort，旧 session 请求晚失败会写全局 `sessionLoadError`。
  建议：catch/finally 前校验 `activeSessionIdRef.current === sessionId`，或改成 per-session error map。

- [PERF-01] [apps/web/src/main.tsx](/home/heyx/VSP-Coder/apps/web/src/main.tsx:365) / [apps/web/src/main.tsx](/home/heyx/VSP-Coder/apps/web/src/main.tsx:292) — SSE 断连会重复创建错误卡并造成状态抖动。
  `source.onerror` 每次都创建随机 id，本地错误只按 id 去重。
  建议：AppError 增加 `dedupeKey`，对 `sse:disconnect` 节流；连接恢复后更新同一卡片而不是不断插入。

- [BUG-05] [apps/server/src/errors.ts](/home/heyx/VSP-Coder/apps/server/src/errors.ts:84) / [apps/web/src/main.tsx](/home/heyx/VSP-Coder/apps/web/src/main.tsx:1645) — 429 cooldown 没有被 UI 执行。
  协议和服务端有 `cooldownMs`，但 ErrorDock 按钮仍可立即连续点击。
  建议：根据 `cooldownMs + createdAt` 禁用按钮并显示倒计时。

- [ARCH-01] [apps/web/src/main.tsx](/home/heyx/VSP-Coder/apps/web/src/main.tsx:305) / [apps/web/src/main.tsx](/home/heyx/VSP-Coder/apps/web/src/main.tsx:459) — 初始 workflow 可能按空 projectId 加载。
  首次 `refresh()` 请求 workflow 时 activeProjectId 还未从 persisted selection/default project 解析。
  建议：selection bootstrap 完成或 activeProjectId 改变后立即刷新 workflow；或者让 `/api/state` 返回 resolved project 后再请求 workflow。

## Info

- [TEST-01] [e2e/message-lifecycle-red.spec.ts](/home/heyx/VSP-Coder/e2e/message-lifecycle-red.spec.ts:3) — 部分 Playwright 用例实质是函数级单测。
  它们有价值，但不足以证明浏览器内 refresh/detail/SSE 真实交错。
  建议：补页面级 race 测试：SSE delta 后 stale detail/state、clear queue 后 optimistic 消息消失、provider final 替换 optimistic、跨 session retry、重复 SSE onerror 只显示一张卡。

- [TEST-02] [e2e/message-lifecycle-red.spec.ts](/home/heyx/VSP-Coder/e2e/message-lifecycle-red.spec.ts:87) — 当前测试可能固化“同文本不同 id 必须都保留”，掩盖 optimistic 收敛需求。
  建议：拆规则：真实 provider item 不按内容去重；本地 optimistic item 在 provider 确认后必须被替换、确认或取消。

## Architecture Delta

- M2-M4 已经改善了消息可见性、选择恢复和错误可见性，但引入了一个新边界：前端需要区分“真实 provider 消息”和“本地 optimistic 消息”的生命周期。
- 错误模型已进入 protocol 层，但事件系统还没有完全迁移到 AppError，这造成 API 和 SSE/Activity 两条错误链路语义不一致。
- M5 的响应式布局应同时考虑 M4 error dock/queue dock/pending strip 的垂直优先级；但在大量 CSS 调整前，建议先修复上述 Critical 和至少 BUG-02/PERF-01。

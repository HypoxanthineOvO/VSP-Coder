# Lifecycle Audit 001：前端缓存、刷新与消息生命周期补充审计

时间：2026-05-07T21:15:36+08:00

范围：`apps/web`、`apps/server`、`packages/protocol`、`.vsp-coder/mock-store/state.json`、M0 审计产物。

完整报告：`.pipeline/reports/M0-frontend-cache-refresh-performance-audit.md`

## Critical

- Server provider refresh 会丢掉 previous live-only messages。证据：`apps/server/src/index.ts:844-858`、`541-563`；`apps/server/src/codexSessionMerge.ts:3-16`。
- 前端 `/api/state` 非空旧 messages 可以覆盖现有 live/hydrated messages。证据：`apps/web/src/main.tsx:433-435`、`200-228`。
- 前端 detail/final merge 与 server live finalMessages path 存在 `role + normalized text` 内容去重风险，会删除合法重复 user message。证据：`apps/web/src/main.tsx:297-307`、`327-332`、`357-374`；`apps/server/src/index.ts:903-913`、`926-939`。
- Codex 发送路径没有乐观 user message。`startCodexTurn` 只把 session 标为 running，前端成功后清空 draft；刷新窗口内用户刚发的消息可能不可见。证据：`apps/web/src/main.tsx:661-681`；`apps/server/src/index.ts:243-286`。
- SSE、轮询详情、全局 refresh 和手动 refresh 没有请求顺序/版本边界，旧响应可以在新 live patch 后落地。证据：`apps/web/src/main.tsx:433-441`、`443-463`、`465-482`、`526-558`。

## Warning

- Server cache 是进程内 stale-while-revalidate，缺少用户可见 freshness metadata；重启后 optimistic/queue 状态主要依赖 provider 重建。证据：`apps/server/src/index.ts:44-55`、`520-538`、`586-630`。
- 高频 session refresh 被持久化和广播；本地 store 当前 200 条 events 中 198 条是两类 refresh 噪音。证据：`apps/server/src/index.ts:541-563`、`apps/server/src/store.ts:370-390`、`1067-1074`。
- React 状态是单体 `VspState`，消息区全量渲染且缺少虚拟化/缓存；长会话和 live patch 有高概率性能风险，需 M1/M5 建立基线。证据：`apps/web/src/main.tsx:393-431`、`610-614`、`1145-1160`、`1420-1455`、`1532-1541`。
- Pending outbound 不进入主消息流，状态栏/QueueDock 提示不足以替代消息可见性。证据：`apps/server/src/codexQueue.ts:10-23`、`apps/server/src/index.ts:288-299`、`apps/web/src/main.tsx:947-950`、`1272`。
- Queue item 的 sent/confirmed/failed 收敛策略不完整。证据：`apps/server/src/index.ts:750-777`、`apps/server/src/codexSessionMerge.ts:11`、`apps/server/src/codexQueue.ts:26-41`。
- 502、429、SSE 断线和 provider refresh failed 仍缺少统一错误卡片与 retry action。证据：`apps/web/src/main.tsx:171-177`、`433-441`、`469-481`；`apps/server/src/index.ts:86-92`。
- 上次选中恢复和排序策略会放大旧会话问题。证据：`apps/web/src/main.tsx:572-582`、`541-542`、`2085-2099`；`apps/server/src/index.ts:586-630`。

## Info

- dev-test `MockStore.sendMessage` 已有“发送即追加 user message”的体验，可作为 Codex optimistic outbound 的测试对照。证据：`apps/server/src/store.ts:466-501`。
- M1 应优先添加红灯测试：重复文本保留、发送后刷新保留、server refresh 保留 live-only messages、旧 state/detail 丢弃、queue 主消息流可见、SSE onerror 错误卡片、长会话性能。

## 后续动作

- 建议新增 M2.5“消息生命周期与缓存一致性”，先做 `clientMutationId`、optimistic outbound、providerItemRef/id-first merge、freshness metadata、request generation 和 queue 收敛。
- M2 保留“上次选中恢复 + reasoning 控制面可靠性”，避免承载全部 message/cache 大改。
- 将 M5 扩大为“统一动效体系 + 消息渲染性能 + refresh event 降噪”。

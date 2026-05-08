# C3 M0 补充审计：前端缓存、刷新与消息生命周期

## 摘要

本轮补充审计时间：2026-05-07T21:15:36+08:00。

第一版 M0 报告主要围绕用户已列出的 Bug 建立根因矩阵，覆盖面不足。本补充报告把审计主轴改为“消息生命周期与前端更新策略”：发送、乐观状态、队列、SSE live patch、轮询详情刷新、server cache、消息去重、排序、错误恢复和渲染性能。

结论：当前“刷新时吞掉已经发送的消息”不是单一 UI 小 Bug，而是消息合并策略、乐观写入缺失、刷新竞态和缓存模型共同造成的架构风险。尤其严重的是：server provider refresh 会丢掉尚未 materialize 的 live-only messages，前端 `/api/state` 可以用非空旧消息覆盖新 live 状态，且前后端都存在 `role + normalized text` 的内容去重风险。

本报告仍然只做审计和计划补充，未修改业务代码。

## Subagent 反审计修订

2026-05-07T21:25:46+08:00 已按用户要求调用 Subagent 只读反审计。反审计结论为“可信度高”，同时指出两条需要升为 Critical 的直接吞消息路径，以及三处需要降级或修正的措辞。

本版已采纳以下修订：

- 新增 Critical 1：server `refreshCodexSession -> mergeProviderRefresh` 不合并 previous messages，会丢掉 live-only messages。
- 新增 Critical 2：前端 `/api/state` incoming session 非空但更旧时，`mergeStatePreservingDetails` 会覆盖现有 live messages。
- 将内容去重结论修正为：前端 detail/final merge 与 server live finalMessages path 均有风险，但 server provider read path 的直接问题是 live-only message 丢失。
- 将“Queue 只在 QueueDock 可见”修正为“pending outbound 不进入主消息流，状态栏和 QueueDock 提示不足以替代消息流可见性”。
- 将“500+ messages 明显卡顿”降级为“高概率性能风险，需要 M1/M5 建立性能基线验证”。

## 严重发现

### Critical 1. Server provider refresh 会丢掉 previous live-only messages

证据：

- `apps/server/src/index.ts:844-858` `applyLivePatch` 会把 SSE/live message 合入 `sessionCache`。
- `apps/server/src/index.ts:541-563` `refreshCodexSession` 随后调用 `readCodexSession` 读取 provider session，再用 `mergeProviderRefresh(previous, session)` 合并。
- `apps/server/src/codexSessionMerge.ts:3-16` `mergeProviderRefresh` 以 `...next` 为主体，只保留 queue/cards/artifacts/status/currentTurnId 等字段，没有合并 `previous.messages`。

影响：

如果 provider `thread/read` 暂未 materialize 刚刚通过 live patch 进入 cache 的消息，server refresh 会用 provider 返回的 message list 覆盖 cache 中的 live-only messages。这个路径比“内容去重”更直接：即使消息文本完全不重复，也可能在刷新后从 server cache 消失。

复现路径：

1. SSE `item/agentMessage/delta` 或 tool delta 到达，`applyLivePatch` 将 message 写入 `sessionCache`。
2. `turn/completed`、active polling 或用户刷新触发 `refreshCodexSession`。
3. `readCodexSession` 返回的 provider turns 尚未包含该 live item。
4. `mergeProviderRefresh` 返回 `...next`，没有把 previous live-only message 合回去。
5. 后续 `/api/sessions/:id` 或 `/api/state` 返回的 session 中不再包含该 live-only message。

修复入口：

- M1 增加 server 单测：provider refresh 必须保留 previous live-only messages，等 provider final item 到达后再按 id/providerItemRef 合并。
- M2.5 或等价拆分任务中重写 `mergeProviderRefresh` 的 message merge，严禁单纯以 provider `next.messages` 覆盖 cache。

### Critical 2. 前端 `/api/state` 非空旧消息可以覆盖新 live 状态

证据：

- `apps/web/src/main.tsx:433-435` `refresh` 拉取 `/api/state` 后直接执行 `mergeStatePreservingDetails(prev, next)`。
- `apps/web/src/main.tsx:200-228` `mergeStatePreservingDetails` 只有在 incoming `session.messages.length === 0` 时才保留 existing messages。
- `apps/web/src/main.tsx:212-225` 如果 incoming session 有非空 messages，即使更旧、更短或来自 stale server cache，也会使用 incoming messages。

影响：

这不是泛泛的“竞态风险”，而是明确的合并条件缺陷：只要 `/api/state` 返回一个非空但旧的 session messages 数组，它就能覆盖前端现有 live/hydrated messages。结合 server stale cache 和 active polling，用户刷新或全局 refresh 时可能看到消息回退、消失或状态闪回。

修复入口：

- M1 增加前端合并单测：incoming 非空但 revision/fetchedAt 旧时不能覆盖现有较新的 messages。
- M2.5 引入 per-session freshness metadata 或 request generation，前端 state/detail 合并必须以 id/revision/source 为准。

### Critical 3. 前后端按内容去重会吞掉合法重复消息

证据：

- `apps/web/src/main.tsx:297-307` 在 live patch finalMessages 合并后调用 `dedupeMessagesByContent(next)`。
- `apps/web/src/main.tsx:327-332` 详情刷新合并时也会过滤与 detail 同内容的 live-only message，并再次按内容去重。
- `apps/web/src/main.tsx:357-374` 的去重 key 是 `${role}:${normalizedMessageText(message)}`，不考虑 `id`、`providerItemRef`、turn id、createdAt 或消息来源。
- `apps/server/src/index.ts:903-913` live patch finalMessages 合并同样按内容找 duplicate。
- `apps/server/src/index.ts:926-939` server 侧去重 key 也是 `${role}:${text}`。

影响：

用户连续发送两次相同文本，例如“继续”“好的”“开始吧”，前端 detail/final merge 会把同 role 同文本消息视作重复；server live finalMessages path 也有同类内容去重风险。server provider read path 本身不是按内容去重，而是由 Critical 1 的 live-only 覆盖问题直接导致丢失。整体行为与用户描述的“前端刷新时经常吞掉已经发送的消息”高度一致，因为刷新和 final item 到达都会触发这些合并路径。

复现路径：

1. 在同一 session 连续发送相同文本两次。
2. 等待 `item/completed` 或主动刷新触发 `/api/sessions/:id`。
3. `mergeLiveMessages` 或 `mergeDetailedMessages` 会把第二条同 role 同文本消息视为重复。
4. UI 只保留第一条，用户感知为消息被吞。

修复入口：

- M1 必须先加红灯测试：同一 session 内连续两条相同 user message 刷新后必须都存在。
- M2 应把消息 identity 改成 provider-first：优先使用 `providerItemRef`/`id`，缺失时使用 clientMutationId 或 turn-scoped 临时 id。
- 内容相似去重只能用于 live delta 与 final item 的同一 provider item 对齐，不能跨不同 turn/item 做全局去重。

### Critical 4. Codex 发送路径没有乐观 user message，刷新窗口内会出现“已发但历史里没有”

证据：

- `apps/web/src/main.tsx:661-681` 发送后直接把 server 返回的 `next` 替换进 session，成功后清空 draft。
- `apps/server/src/index.ts:243-276` `startCodexTurn` 调用 `turn/start` 后只执行 `markCodexTurnRunning`，返回的 optimistic session 只改 `status/currentTurnId/updatedAt`。
- `apps/server/src/index.ts:279-286` `markCodexTurnRunning` 没有追加 user message。
- `apps/server/src/index.ts:268` 只记录 `"消息已发送到 Codex turn/start"` 事件，事件 payload 不含用户消息正文和可用于恢复的 message id。
- 对比 dev-test 路径：`apps/server/src/store.ts:466-501` 会立即把 user message push 到 `session.messages`，Codex 路径缺少同等体验。

影响：

发送请求成功并清空输入框后，如果 provider 的 `thread/read` 尚未 materialize 该 userMessage，或者刷新/重载发生在这个窗口内，浏览器只能看到“running”而看不到刚发出的用户消息。网络慢、provider 慢、页面刷新或 SSE 断线时，这个窗口会被放大。

复现路径：

1. 发送一条消息。
2. Server `turn/start` 成功，前端清空 draft。
3. 在 provider `thread/read` 返回完整 turns 前刷新页面。
4. 新页面从 `/api/state` 和 `/api/sessions/:id` 读到 running session，但没有刚发送的 user message。

修复入口：

- M2 应引入 `clientMutationId` 和 optimistic user message，并把 pending/sent/failed 状态渲染在消息流中。
- Server 侧 `startCodexTurn` 应把 outbound user message 纳入 session cache；provider final item 到达后按 `clientMutationId/providerItemRef` 合并。
- 发送失败时 draft 不应丢；成功但 provider 未确认时应显示“已提交，等待 provider 确认”。

### Critical 5. 刷新、SSE、轮询详情三套更新源没有顺序边界，旧响应可以覆盖新状态

证据：

- `apps/web/src/main.tsx:433-441` `refresh` 拉 `/api/state` 后直接 `setState`，没有 request generation、abort 或 freshness check。
- `apps/web/src/main.tsx:443-463` `loadSessionDetail` 对任何返回的 detail 都立即合并，无法判断它是否比当前 live patch 更新。
- `apps/web/src/main.tsx:465-482` SSE 收到 session event 后会 `loadSessionDetail(..., { silent: true })`。
- `apps/web/src/main.tsx:522-524` active session 变化会加载 detail。
- `apps/web/src/main.tsx:526-531` 全局每 10 秒 refresh。
- `apps/web/src/main.tsx:551-558` active Codex session idle 也每 1.8 秒 silent hydrate，busy 时每 2.5 秒。

影响：

同一个 session 同时有 SSE live patch、active polling、手动刷新、全局 refresh 和 initial bootstrap。没有 sequence/version 时，较慢的旧请求可以在新 live patch 后返回，然后被 `mergeDetailedSession` 或 `mergeStatePreservingDetails` 合并进 UI。在内容去重、server live-only 覆盖和 cache stale 的组合下，旧 detail 可能导致消息闪回、重复、丢失或状态回退。

修复入口：

- M2/M5 应增加 per-session refresh controller：只允许最新 detail response 落地，旧请求丢弃。
- Server response 应带 `fetchedAt`、`source`、`revision` 或 provider turn/version。
- Frontend merge 应以 message id 和 revision 为准，避免用文本猜测新旧。

## 警告发现

### Warning 1. Server cache 是内存 stale-while-revalidate，缺少用户可见的数据新鲜度

证据：

- `apps/server/src/index.ts:44-55` discovery/session cache 都是进程内 Map，TTL 分别为 2s、3s、busy 500ms、stale 60s。
- `apps/server/src/index.ts:520-538` stale window 内会返回旧 cached session，同时后台 refresh。
- `apps/server/src/index.ts:586-630` `/api/state` 会把 cached details 合入 discovery，cached-only sessions 还会排在 discovered sessions 前。
- `.vsp-coder/mock-store/state.json` 当前 codex mode 下 sessions 为 0，仅保存 events；server 重启后 optimistic session cache、queue 和 pending 状态主要依赖 provider 重新发现。

影响：

用户刷新页面时并不知道当前看到的是 fresh、stale、live-only 还是 provider-confirmed。server 重启、provider 卡顿或 discovery fallback 时，前端会显示旧事件和旧 session 状态，却缺少“数据正在对齐”的明确提示。

修复入口：

- 协议增加 session hydration metadata：`source: live|cache|provider|stale`、`fetchedAt`、`providerConfirmedAt`。
- 前端在消息区显示轻量数据新鲜度状态，特别是刚发送、重连、502/429 后。
- 对 outbound pending/queue 做可恢复持久化，而不是只放内存 Map。

### Warning 2. 高频刷新事件被持久化并广播，造成噪音和额外渲染

证据：

- `apps/server/src/index.ts:541-563` 每次 `refreshCodexSession` 都 `recordEvent("Codex session 已刷新：...")`。
- `apps/server/src/store.ts:370-378` 每个 record event 都写入 state、persist 到磁盘，并通知 SSE subscriber。
- `apps/server/src/store.ts:381-390` noisy duplicate 只对特定 noisy event 生效。
- `apps/server/src/store.ts:1067-1074` `isNoisyCoalescableEvent` 只把 `Codex app-server ...` 的 session_updated 当作可合并噪音，不包括 `Codex session 已刷新：...`。
- 本地 `.vsp-coder/mock-store/state.json` 当前 200 条 events 中，有 99 条 `"Codex session 已刷新：Initialize hypo-workflow"` 和 99 条 `"Codex session 已刷新：检查新 Cycle 状态"`。

影响：

活跃 session 的 1.8s/2.5s hydrate 与后台 prefetch 会持续制造持久化事件、SSE 广播和前端 Activity 重渲染。用户看到的 Activity 列表被刷新噪音淹没，性能也被无意义事件放大。

修复入口：

- refresh 成功不应默认进入持久 Activity；只有错误、状态变化、消息数变化、title 变化等语义变化才记录。
- 对 refresh event 做 coalesce 或仅作为 transient debug。
- M5 的性能优化应同时清理事件噪音，否则动画优化会被刷新重渲染抵消。

### Warning 3. React 状态是单体 VspState，消息列表没有虚拟化或渲染缓存

证据：

- `apps/web/src/main.tsx:393-431` 主要 UI 状态集中在 `App`，`state` 是完整 `VspState`。
- `apps/web/src/main.tsx:610-614` live patch 每次都重建 events 和 sessions 数组。
- `apps/web/src/main.tsx:1145-1160` `visibleMessages.map(...)` 渲染全部可见消息。
- `apps/web/src/main.tsx:1420-1455` 每个 message render 都会 sanitize、parse command output、render markdown。
- `apps/web/src/main.tsx:1532-1541` file change notice 为单条 tool message 提取路径时，会扫描整个 session 的 file change tool messages。
- `apps/web/src/styles.css:387-407` 消息区是普通 grid，无窗口化、分段折叠或长消息 lazy render。

影响：

长会话、工具输出、markdown、文件变更通知和活动列表更新会在每次 live patch/refresh 时一起重算。发送动画卡顿不只是 CSS 动画问题，还包括状态更新粒度过大和消息渲染成本过高；当前这是高概率性能风险，具体阈值和实测卡顿程度需要 M1/M5 建立性能基线。

修复入口：

- M5 应把消息渲染性能纳入 motion system：message memo、tool output collapse、长会话窗口化或分段渲染。
- M2/M5 应把 session/message 归一化，至少避免非 active session 更新导致 active conversation 全量重渲染。
- file change path 解析应预计算或基于 artifacts，不应在每条 notice render 时扫全量 session。

### Warning 4. Pending outbound 不进入主消息流，状态栏/QueueDock 提示不足以替代消息可见性

证据：

- `apps/server/src/codexQueue.ts:10-23` busy 时只创建 `QueueItem`。
- `apps/server/src/index.ts:288-299` `enqueueCodexMessage` 返回 queue 更新后的 session，但没有追加 user message。
- `apps/web/src/main.tsx:947-950` pending queue 只传给 `QueueDock`。
- `apps/web/src/main.tsx:1272` 状态栏显示 pending queue 数量。
- `apps/web/src/main.tsx:1628` QueueDock 仅展示 pending message 摘要，和对话流分离。

影响：

用户在 busy session 里发送消息后，消息不会出现在主对话历史，只能通过状态栏数量和底部 QueueDock 感知。刷新、窄屏或 dock 被忽略时，用户仍会认为消息被吞。等队列 drain 后又走 `startCodexTurn`，仍然没有立即在消息流里写 optimistic user message。

修复入口：

- Pending outbound 必须作为消息流中的一等状态，queue dock 只是汇总入口。
- Queue item 与 optimistic message 应共享 id，以便 sent/failed/cleared 状态同步。

### Warning 5. Queue item 的 sent/confirmed/failed 收敛策略不完整

证据：

- `apps/server/src/index.ts:750-777` `drainCodexQueue` 先把 queue item 标为 `sent`，再调用 `startCodexTurn`。
- `apps/server/src/codexSessionMerge.ts:11` `mergeProviderRefresh` 只要 previous queue 非空就继续保留 previous queue。
- `apps/server/src/codexQueue.ts:26-41` `clearPendingQueue` 只清理 `pending` item，不处理 sent item 的 provider-confirmed 收敛。
- 当前 queue item 没有和 optimistic message 或 clientMutationId 绑定。

影响：

sent queue item 可能长期留在 session queue 中，既不能和主消息流的用户消息对应，也缺少 provider 确认后的收敛条件。后续错误恢复和重试卡片如果不先修这个状态机，会出现“消息已发送但 queue 仍残留”或“重试不知道重试哪条”的问题。

修复入口：

- M2.5 定义 queue item 与 optimistic outbound message 的同一 identity。
- Provider final userMessage 到达后，应把对应 queue/optimistic item 标记为 confirmed 或移出 pending UI。

### Warning 6. 错误更新不会进入统一 UI，刷新失败可能静默变成旧数据

证据：

- `apps/web/src/main.tsx:171-177` `api` 丢失 HTTP status，只抛 Error text。
- `apps/web/src/main.tsx:433-441` `refresh` 没有统一 catch；被 interval 或 SSE catch 触发时可能只产生 rejected promise。
- `apps/web/src/main.tsx:469-481` `EventSource` 没有 `onerror`。
- `apps/server/src/index.ts:86-92` 错误响应只有 `{ error }`。
- `apps/server/src/codexEvents.ts:193-196` provider error 只作为 persistent event，payload 只有 method/willRetry。

影响：

502、429、SSE 断线、provider refresh failed、JSON parse failed 等无法统一进入“底部错误小卡片和重试卡片”。刷新失败时用户可能只是停留在旧 session cache 上，误以为消息被吞或状态没更新。

修复入口：

- M3 应先定义统一 `AppError`/`RetryAction` 协议，再接 API、SSE、provider event 和 UI bottom card。
- 对 429 做冷却，对 502/SSE 做重连，对发送失败做 draft/message 恢复。

### Warning 7. 上次选中恢复和排序策略仍会放大“旧会话”问题

证据：

- `apps/web/src/main.tsx:572-582` bootstrap 不读取 last selection。
- `apps/web/src/main.tsx:541-542` active session 不存在时直接 fallback 到 `projectSessions[0]`。
- `apps/web/src/main.tsx:2085-2099` sortTimes/statuses 是运行期 Map，刷新页面后重建。
- `apps/server/src/index.ts:586-630` cached-only sessions 会插到 discovered sessions 前。

影响：

刷新后会话选择、排序、cached-only session 合并和 refresh events 共同作用，容易让用户进入旧会话。这个问题和“吞消息”相互放大：用户以为消息没了，实际可能还切到了另一个旧 session。

修复入口：

- M2 必须把 last selected project/session 与 message cache 一起处理，不能只修默认 session。
- 恢复失败时 UI 应显示 fallback 原因，而不是静默选择第一条。

## 测试缺口

当前测试覆盖 server/protocol 的基础 mapping、queue、merge、events，但缺少以下关键场景：

- 同一 session 连续发送相同文本，刷新后两条都保留。
- 发送后立刻刷新或重载，optimistic user message 仍可见。
- Server `mergeProviderRefresh` 必须保留 previous live-only messages。
- `/api/state` 返回非空旧 messages 时，前端不能覆盖较新的 live/hydrated messages。
- SSE live delta、item completed、manual refresh、polling detail 并发到达时，旧响应不能覆盖新响应。
- busy queue 中 pending message 在主消息流可见，刷新后状态保持。
- Queue sent item 能在 provider confirmed 后收敛，不长期残留。
- 429/502/SSE onerror 渲染底部错误卡片，并可重试。
- 500+ messages 的长会话发送和 live patch 有明确性能基线，后续优化能量化对比。
- `.vsp-coder/mock-store/state.json` refresh noise 不应持续增长到 200 条全是刷新事件。
- `apps/web/package.json` 当前 `test` 只是 `tsc --noEmit`，M1 需要补真正的 E2E/截图/交互红灯。
- `apps/server/src/codexSessionMerge.test.ts` 当前只覆盖 provider canonical title/profile，没有覆盖 live-only message 保留。

M1 Playwright/截图基线应把这些作为红灯用例纳入，而不是只覆盖页面能打开。

## 补充修复计划建议

建议在 M0 后的补充 Plan 中调整后续 Milestone：

1. M1 增加“消息生命周期红灯套件”：重复文本、发送后刷新、server refresh 保留 live-only、前端旧 state/detail 丢弃、pending queue 进主消息流、SSE 断线、新旧会话 fallback、refresh 噪音上限和长会话性能基线。
2. 建议新增 M2.5“消息生命周期与缓存一致性”，先于大规模 reasoning 控制面实现：`clientMutationId`、optimistic outbound、providerItemRef/id-first merge、`mergeProviderRefresh` message 合并、freshness metadata、per-session request generation/AbortController、queue item 收敛。
3. M2 保留“上次选中恢复 + reasoning 控制面可靠性”，但不要独自承载 message identity/cache 的大改；否则 M2 会过胖。
4. M3 继续做错误模型和底部错误/重试卡片，但必须接入发送失败、refresh 失败和 SSE 断线恢复。
5. M5 不只做动效 token，还要包含消息渲染性能和 refresh event 降噪：memo、低成本更新、长消息/长会话策略、Activity 噪音上限。

## 审计结论

用户指出“审计不够全面”是准确的。第一版 M0 把症状拆成已知 Bug，但没有把刷新、缓存、消息 identity、并发更新和渲染成本作为一个整体系统审计。本补充报告把核心风险收束为一句话：

当前前端没有可靠的 message identity 与更新顺序模型，server 也没有可恢复的 outbound/refresh 状态协议；因此刷新、重复消息、provider 延迟和 live patch 竞态都会被用户感知为吞消息、卡顿或状态错乱。

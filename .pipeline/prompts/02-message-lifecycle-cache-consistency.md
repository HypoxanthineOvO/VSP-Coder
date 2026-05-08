# Prompt 02: 消息生命周期与缓存一致性

## Objective

修复刷新吞消息、重复消息丢失、缺少 optimistic outbound、server/provider refresh 覆盖 live-only messages、前端 stale response 落地和 queue 收敛问题。

## 需求

- 引入 outbound identity，例如 `clientMutationId` 或等价字段，用于把前端发送、server cache、queue item 和 provider final item 关联起来。
- Codex send 成功后必须立即在主消息流中显示 optimistic user message。
- Busy session 发送时，pending outbound 也必须进入主消息流；QueueDock 和状态栏只是汇总入口。
- 改造 message merge：
  - 优先使用 `id` / `providerItemRef` / `clientMutationId`。
  - 内容去重只允许用于同一 provider item 的 live delta 与 final item 对齐。
  - 不允许跨 turn/item 用 `role + normalized text` 全局删除消息。
- 改造 server `mergeProviderRefresh`：provider refresh 必须保留 previous live-only messages，直到 provider 明确确认、替换或完成收敛。
- 增加 session freshness metadata 或等价机制，使前端能区分 live/cache/provider/stale 来源。
- 前端 `/api/state`、session detail、SSE live patch、manual refresh 和 polling detail 需要 request generation 或 AbortController，旧响应不能覆盖新状态。
- 定义 queue item 的 `pending/sent/confirmed/failed/cleared` 收敛策略，并与 optimistic message 同步。
- 发送失败时必须保留 draft 或 optimistic failed message，并为 M4 错误卡片提供 retry target。

## Boundaries

- 重点文件：`packages/protocol/src/index.ts`、`apps/server/src/index.ts`、`apps/server/src/codexSessionMerge.ts`、`apps/server/src/codexQueue.ts`、`apps/server/src/codexEvents.ts`、`apps/web/src/main.tsx`。
- 可新增小型 merge/cache/queue 测试辅助模块，避免继续把所有逻辑塞进 `main.tsx`。
- 可改 M1 中新增的测试夹具，使红灯转绿。

## Non-Goals

- 不重写整个 provider adapter。
- 不引入大型前端状态库。
- 不在本 Milestone 完成底部错误卡片完整 UI；但必须提供 M4 可用的错误/重试 identity。
- 不解决 responsive shell 和 motion system 的视觉细节。

## 预期测试

- 同一 session 连续发送相同文本，刷新/final merge 后两条都保留。
- Server provider refresh 保留 previous live-only messages。
- 前端 stale non-empty `/api/state` 或 detail response 不覆盖较新的 live/hydrated messages。
- 发送后立即刷新或重载，optimistic user message 仍可见。
- Busy queue pending outbound 在主消息流可见，并能在 provider confirmed 后收敛。
- 发送失败能保留恢复入口，retry target 可定位到具体 message/session/queue item。

## Validation Commands

```bash
npm run test
npm run e2e -- --project=chromium --grep "message|refresh|queue|cache"
```

## Evidence

- M1 消息生命周期红灯矩阵中对应项转绿。
- 单元/集成测试证明 mergeProviderRefresh、前端 merge、queue 收敛和重复消息保留。
- E2E 证明发送后刷新、busy queue 和 stale response 场景可恢复。
- `.pipeline/reports/M2-message-lifecycle-cache.md`

## Human QA

- 审计/验证视角复核 message identity、provider merge、queue 状态和旧响应丢弃规则。
- 特别确认没有用新的内容去重替代旧的内容去重。

## 预期产出

- 协议/server/web 的消息生命周期修复。
- M1 红灯测试对应转绿记录。
- `.pipeline/reports/M2-message-lifecycle-cache.md`

# M7 Subagent trace 识别、详情与交互入口报告

- 时间：2026-05-08T00:27:10+08:00
- 状态：完成
- Prompt：`.pipeline/prompts/07-subagent-trace-interaction.md`

## 完成内容

1. 协议层新增 `SubagentTrace` 和 `subagent_trace` message block，不再把 Subagent 仅当作普通工具文本。
2. 服务端 Codex discovery 和 live event 两条路径都会把 Subagent item 转换为结构化 trace，同时保留 legacy text block，兼容旧展示和日志。
3. 前端 simple mode 不再过滤 Subagent trace；消息流与当前工具活动都会显示 `Subagent <agent> · <status>` 入口。
4. 详情面板展示 agent 名称、类型、状态、method、summary、raw payload、可用动作和 provider 交互限制。
5. 当前 Codex provider 只暴露 trace，未暴露可进入子 agent 的双向 channel；UI 明确显示“只读 trace”和不可交互原因。
6. SSE 短暂断连错误改为持续断开后再显示，连接恢复后自动清理，避免测试和重启期间连续推送错误卡。

## 验证覆盖

- `packages/protocol/src/index.test.ts` 覆盖结构化 trace block 类型。
- `apps/server/src/codexEvents.test.ts` 覆盖 live Subagent notification 到结构化 final message。
- `apps/server/src/codexDiscovery.test.ts` 覆盖历史 item discovery 中的结构化 trace 和 legacy text fallback。
- `e2e/subagent-trace.spec.ts` 覆盖 simple mode 可见入口、详情打开、agent/status 展示和不可交互说明。
- `e2e/error-retry.spec.ts` 更新 SSE 断连用例，验证延迟错误卡仍可在持续断开时出现。

## 验证

```bash
npm run typecheck
npm run test
npm run e2e -- --project=chromium --grep "subagent|SSE disconnect"
```

结果：类型检查通过；单元测试通过；Chromium 聚焦 E2E 2 passed。

## 关闭的问题

| 问题 | 状态 | 证据 |
|---|---|---|
| Subagent 识别不到 | fixed | 协议、server discovery、server live event 都输出 `subagent_trace` block。 |
| simple mode 吞掉 Subagent 入口 | fixed | `visibleConversationMessages` 对 Subagent tool message 特例保留。 |
| 无法打开详情 | fixed | `SubagentTraceNotice` 使用详情弹窗展示结构化字段和 raw payload。 |
| 无法进入真实交互 | accepted risk | Codex provider 当前未暴露子 agent 交互 channel；UI 已明确标注只读 trace 和限制原因。 |
| 错误卡连续推送噪音 | fixed | SSE onerror 增加持续断开延迟和 onopen 清理。 |

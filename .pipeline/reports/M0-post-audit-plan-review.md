# C3 M0 后补充 Plan Review

时间：2026-05-07T21:54:23+08:00

## Review 结论

M0 原始审计、补充审计和 Subagent 反审计共同改变了后续计划的优先级。后续实现不能继续按“session/reasoning -> error -> layout -> motion”直接推进；必须先建立消息生命周期红灯测试，再优先修复 message identity、provider/cache merge、optimistic outbound、freshness metadata 和 queue 收敛。

架构基线仍然成立：浏览器通过 VSP HTTP/SSE API 访问本地 Node server，server 负责 Codex app-server/provider 适配。但 C3 必须新增一个明确的消息生命周期一致性层，避免前端和 server 继续靠文本去重、非空覆盖和运行期内存 cache 猜测状态。

## ADDED

- 消息生命周期一致性成为单独计划轴：`clientMutationId`、optimistic outbound、providerItemRef/id-first merge、server `mergeProviderRefresh` message merge、front-end freshness metadata、per-session request generation/AbortController、queue sent/confirmed/failed 收敛。
- M1 必须先建立红灯测试，而不是只建立 Playwright 能跑的烟测。
- M5 必须包含渲染性能和 refresh event 降噪，而不只是 CSS 动效。

## CHANGED

- 原 M2 过胖：如果同时承载上次选中、reasoning 控制面、message identity、cache consistency 和 queue 收敛，会把最高风险改动混在一起。
- 原 M3 需要依赖 M2 的 outbound identity 和 queue 状态，否则发送失败、refresh 失败和重试卡片无法准确绑定用户消息。
- 原 M5 需要等消息生命周期和错误模型基本稳定后再做动效/性能，否则会优化到不稳定状态之上。

## REASON

- 补充审计发现刷新吞消息的直接路径：server provider refresh 丢 live-only messages；前端 `/api/state` 非空旧 messages 覆盖新 live 状态；内容去重删除合法重复消息；Codex 发送缺少 optimistic user message。
- Subagent 反审计确认这些结论可信，并建议新增或前置“消息生命周期与缓存一致性”。

## IMPACT

下游 prompts 不建议 unchanged 运行。建议采用“重排未执行里程碑”的方案：

| 新序号 | 名称 | 来源/变化 |
|---|---|---|
| M1 | Chromium Playwright 与截图回归基线 | 保留，但扩展为消息生命周期红灯套件。 |
| M2 | 消息生命周期与缓存一致性 | 新增，前置最高风险修复。 |
| M3 | 会话选择与 reasoning 控制面可靠性 | 原 M2 后移，删去 message/cache 大改，只聚焦 last selection + reasoning 状态机。 |
| M4 | 错误事件、底部错误卡片与分级恢复 | 原 M3 后移，接入 M2 的 outbound identity 和 queue 状态。 |
| M5 | 响应式工作台外壳与导航可达性 | 原 M4 后移。 |
| M6 | 统一前端动效体系、发送性能与事件降噪 | 原 M5 后移，并加入 refresh event 降噪与长会话性能基线。 |
| M7 | Subagent trace 识别、详情与交互入口 | 原 M6 后移。 |
| M8 | 全量回归、扩展性硬化与文档同步 | 原 M7 后移，收口新增消息生命周期矩阵。 |

## Prompt Patch Queue

已写入 `.plan-state/prompt-patch-queue.yaml`，状态均为 `proposed`。按 `plan-review` 规则，本轮没有直接重写后续 prompt；需要用户确认后再进入 prompt rewrite/state rebaseline。

## 推荐确认项

推荐采用上述 M1-M8 重排。保守替代方案是把消息生命周期塞进 M2，不新增 Milestone，但不推荐：M2 会过大，且 reasoning 控制面会和底层消息一致性互相干扰。

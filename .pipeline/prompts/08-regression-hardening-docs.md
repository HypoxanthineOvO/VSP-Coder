# Prompt 08: 全量回归、扩展性硬化与文档同步

## Objective

收口 C3：对照 M0 原始根因矩阵和 M0 补充消息生命周期审计逐项关闭，完成全量回归、扩展性硬化和中文文档同步。

## 需求

- 对照 M0 `known bug root cause matrix`，逐项标记 `fixed`、`deferred` 或 `accepted risk`。
- 对照 M0 补充审计，逐项标记消息生命周期/cache/performance 发现的关闭状态。
- 修复审计中发现的低风险但低成本问题。
- 检查 provider adapter、协议类型、错误模型、测试夹具、脚本和文档的可扩展性。
- 更新 README、user guide、API reference 等中文用户/项目文档，保持实际 API/UX 一致。
- 文档需要覆盖：消息恢复、错误卡片、上次选中、Subagent trace、响应式行为、动效/reduced-motion。
- 汇总剩余风险和下一 Cycle 候选项。

## Boundaries

- 可改 `README.md`、`docs/**/*.md`、测试脚本、低风险硬化代码。
- 不做大型新功能。

## Non-Goals

- 不把所有未来 provider 功能都塞进 C3。
- 不在没有证据的情况下关闭 deferred 项。

## 预期测试

- 完整 QA、E2E、截图检查通过。
- 文档和实际 UI/API 一致。
- 每个 P1 known bug 和 M0 supplemental finding 都有关闭证据或明确 deferred 说明。

## Validation Commands

```bash
npm run qa
npm run e2e -- --project=chromium
npm run screenshots -- --project=chromium
```

## Evidence

- `.pipeline/reports/M8-regression-and-closure.md`
- 全量命令结果。
- 已知 Bug 和补充审计发现关闭表。
- 文档同步摘要。

## Human QA

- 最终审计/验证视角签收，不由最后实现者单独验收。

## 预期产出

- 回归收口报告。
- 中文文档更新。
- 下一 Cycle 候选清单。

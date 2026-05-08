# Prompt 07: Subagent trace 识别、详情与交互入口

## Objective

修复 Subagent 识别不到、无法进入详情或交互的问题，并让协议边界更可扩展。

## 需求

- 审计 Codex subagent/tool item 的真实形状，避免仅靠文本正则识别。
- 必要时扩展 `@vsp-coder/protocol`：结构化 Subagent trace/message/artifact 字段。
- 服务端从 Codex items 转换结构化 trace，并兼容已有文本 trace。
- 前端提供可打开详情、状态、摘要和交互入口。
- 如果当前协议或 provider 不支持直接交互，UI 要明确显示可用动作和限制。
- Subagent trace 展示必须与 M2 message identity、M4 error card、M6 motion/reduced-motion 兼容。

## Boundaries

- 重点文件：`packages/protocol/src/index.ts`、`apps/server/src/codexDiscovery.ts`、`apps/server/src/codexEvents.ts`、`apps/server/src/codexArtifacts.ts`、`apps/web/src/main.tsx`。
- 保持向后兼容已有文本 trace。

## Non-Goals

- 不实现独立 Subagent 编排系统。
- 不承诺 provider 没有暴露能力时的真实双向交互。

## 预期测试

- server/protocol 单测覆盖多种 subagent item 形状。
- Playwright 覆盖 Subagent trace 可识别、可打开、详情信息正确。
- 不可交互状态有清晰说明。
- simple display mode 下仍有可见入口，不被 tool message 过滤吞掉。

## Validation Commands

```bash
npm run test
npm run e2e -- --project=chromium --grep "subagent"
```

## Evidence

- 结构化 Subagent 数据端到端可见。
- 详情打开稳定。
- 报告记录 Subagent 问题关闭证据或 provider 限制。

## Human QA

- 独立审计视角复核 provider 适配边界和向后兼容。

## 预期产出

- 协议/server/web 的 Subagent trace 改进。
- `.pipeline/reports/M7-subagent-trace.md`

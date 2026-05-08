# Prompt 05: 响应式工作台外壳与导航可达性

## Objective

修复 PC 窄宽度时 Project/session 导航消失或不可达的问题。

## 需求

- 审计并重构工作台 grid、rail 宽度约束、collapse 策略、resize handle、desktop/mobile 边界。
- 在 `1440x900`、`1280x800`、`1024x768`、`768x900`、`390x844` 下保证 Project/session 入口可见或可一键打开。
- 处理右侧面板、状态栏、composer、消息列表、底部错误卡片和 queue/message pending 状态在窄宽度下的优先级、溢出和遮挡。
- 文本不能溢出按钮、卡片或状态栏；关键控件不能相互覆盖。
- 响应式修复必须保留 M2/M4 的消息可见性和错误恢复入口。

## Boundaries

- 重点文件：`apps/web/src/main.tsx`、`apps/web/src/styles.css`。
- 可以调整布局 CSS 和少量状态逻辑。
- 不修改 M2 的消息 merge 语义或 M4 的错误模型。

## Non-Goals

- 不做全新信息架构。
- 不移除现有 Project/session 双 rail 概念，除非审计证明必须合并。

## 预期测试

- 多视口截图中 Project/session 导航可达。
- 主会话区、composer、错误卡片和 queue/pending message 不被遮挡。
- resize 后布局仍稳定。

## Validation Commands

```bash
npm run screenshots -- --project=chromium --grep "responsive|shell"
```

## Evidence

- 视口截图和截图检查摘要。
- 报告记录窄宽度侧栏问题关闭证据。

## Human QA

- 测试/审计视角检查截图，不只看测试是否通过。

## 预期产出

- 响应式 shell 修复。
- `.pipeline/reports/M5-responsive-shell.md`

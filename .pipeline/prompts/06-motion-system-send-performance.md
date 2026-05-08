# Prompt 06: 统一前端动效体系、发送性能与事件降噪

## Objective

建立一致、轻量、可维护、尊重 reduced-motion 的前端动效体系，并解决发送动画卡顿、长会话渲染性能风险和 refresh event 噪音问题。

## 需求

- 抽取 motion tokens：duration、easing、opacity/transform 规则、loading/error/success 状态。
- 替换高成本动画和容易触发 layout thrash 的交互。
- 优化发送按钮、optimistic/pending/failed message 状态、消息列表滚动、面板切换、列表展开、加载态、错误卡片进入/退出。
- 补齐 `prefers-reduced-motion` 降级。
- 基于 M1 性能基线，加入 message render memoization、分段渲染、长 tool output 折叠或等价低成本策略。
- 降低 refresh event 噪音：
  - refresh 成功不应持续进入持久 Activity。
  - 无语义变化的 refresh 应 coalesce 或 transient 化。
  - Activity/SSE 更新不应造成无意义全量重渲染。
- 保持 UI 色彩和组件风格不变成单一色调主题；动效服务于效率，不做装饰性干扰。

## Boundaries

- 重点文件：`apps/web/src/styles.css`、`apps/web/src/main.tsx`、`apps/server/src/index.ts`、`apps/server/src/store.ts`。
- 可新增小型 CSS token 区块或辅助 class。
- 可调整 server event coalescing 逻辑。
- 不引入大型动效库，除非审计证明必要。

## Non-Goals

- 不做营销式页面改造。
- 不为动效牺牲可访问性或性能。
- 不重新打开 M2 的 message identity 设计。

## 预期测试

- 发送状态不卡顿，布局不跳。
- 面板切换、列表展开、错误卡片动效一致。
- reduced-motion 下动画被降级。
- 500+ messages baseline 有改善或至少不退化。
- refresh event 噪音有明确上限，不再把 Activity 填满为重复刷新事件。

## Validation Commands

```bash
npm run e2e -- --project=chromium --grep "motion|send|performance|activity"
npm run screenshots -- --project=chromium --grep "motion"
```

## Evidence

- E2E 和截图检查结果。
- 报告记录发送动画卡顿、长会话性能和 refresh event 噪音关闭证据。
- 如加入性能观测，记录 frame budget 或时间窗结果。

## Human QA

- 审计/验证视角复核 CSS、交互状态和事件噪音，避免只做视觉表面修补。

## 预期产出

- Motion system CSS 和必要组件状态调整。
- Refresh event 降噪和性能优化。
- `.pipeline/reports/M6-motion-performance-events.md`

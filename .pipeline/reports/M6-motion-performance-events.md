# M6 统一前端动效体系、发送性能与事件降噪报告

- 时间：2026-05-08T00:01:29+08:00
- 状态：完成
- Prompt：`.pipeline/prompts/06-motion-system-send-performance.md`

## 完成内容

1. Motion token：新增 `--motion-fast/base/slow`、统一 easing、focus ring 和按钮色调变量。
2. Reduced motion：`prefers-reduced-motion: reduce` 下动画和 transition 降为 1ms，hover/active 不再位移。
3. 发送与消息状态：发送按钮使用轻量 icon pulse，不移动 composer；pending/sent/confirmed message 使用低成本状态标记。
4. 长会话性能：MessageBubble memo 化；消息气泡启用 `content-visibility`；超过 220 条可见消息时默认分段渲染，提供“显示更早消息”入口。
5. Activity 降噪：`refreshCodexSession` 不再把成功刷新写入持久 Activity；重复刷新类事件在 store 层 coalesce。
6. Composer 性能：textarea 高度在 input 后下一帧更新，避免布局抖动和自动化填充不生效。

## 验证覆盖

新增 `e2e/responsive-motion.spec.ts`：

- 1280 响应式 shell 主区宽度、右侧折叠、composer 可见；
- 移动端 drawer 导航可达；
- 长输入 composer 自动增高和显式展开；
- reduced-motion token 降级。

新增/更新单测：

- `apps/server/src/store.test.ts` 覆盖刷新 Activity coalesce。

## 验证

```bash
npm run typecheck
npm run test
npm run e2e -- --project=chromium
npm run screenshots -- --project=chromium
npm run build
```

结果：单元测试 61 passed；Chromium E2E 23 passed；截图检查 7 passed；生产构建通过。

## 注意

Playwright 中 SSE 断连卡片来自 `e2e/error-retry.spec.ts` 的故障注入测试，用来确认断连错误会渲染且去重为一张卡；不是实际服务在业务路径中连续失败。

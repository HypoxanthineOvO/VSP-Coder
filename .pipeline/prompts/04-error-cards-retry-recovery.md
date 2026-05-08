# Prompt 04: 错误事件、底部错误卡片与分级恢复

## Objective

让 HTTP、SSE、provider、queue、refresh 和发送错误全部渲染为用户可理解、可恢复的底部错误卡片和重试卡片。

## 需求

- 定义统一错误模型：类型、HTTP 状态码、用户说明、脱敏技术详情、retry policy、关联 session/project/message/queue item。
- 后端规范化 502、429、5xx、SSE 断开、Codex app-server/provider 错误，并通过 API/SSE 传递给前端。
- 前端新增底部错误卡片和重试卡片。
- 分级恢复：
  - 429：显示冷却或稍后重试语义。
  - 502/5xx/SSE 断开：允许重连或重新请求。
  - 发送失败：保留草稿、optimistic failed message 或 queue 上下文。
  - refresh 失败：提示当前数据可能 stale，并提供重试。
  - provider refresh/live refresh failed：错误可见，不静默停留在旧 cache。
- 重试动作必须绑定 M2 的 outbound identity、session id、message id 或 queue item id，不能只靠当前 active session 猜测。
- 错误详情必须脱敏 token、authorization、cookie、secret、敏感 header 和不必要绝对路径。

## Boundaries

- 重点文件：`packages/protocol/src/index.ts`、`apps/server/src/index.ts`、`apps/server/src/codex.ts`、`apps/server/src/codexEvents.ts`、`apps/web/src/main.tsx`、`apps/web/src/styles.css`。
- 可新增 server/web 测试夹具模拟错误。
- 可使用 M2 的 message/queue identity，不重新定义一套 retry target。

## Non-Goals

- 不实现复杂通知中心。
- 不暴露 raw Codex JSON-RPC 错误对象给浏览器。
- 不把所有 provider health 设置都塞进错误卡片。

## 预期测试

- 502、429、SSE 断开、发送失败、refresh 失败、provider refresh failed 均能在 UI 渲染。
- 重试行为按类型分级，并能准确定位 message/session/queue item。
- 技术详情可展开但已脱敏。
- 错误卡片不会遮挡 composer 或 pending controls。

## Validation Commands

```bash
npm run test
npm run e2e -- --project=chromium --grep "error|retry"
```

## Evidence

- 错误规范化和脱敏单测。
- Playwright 截图/日志证明错误卡片和重试卡片可见。
- 报告记录 502/429、SSE 断线、发送失败和 refresh 失败关闭证据。

## Human QA

- 独立审计视角重点复核错误传播链路、重试绑定和信息泄漏风险。

## 预期产出

- 协议/后端/前端错误模型和 UI。
- `.pipeline/reports/M4-error-recovery.md`

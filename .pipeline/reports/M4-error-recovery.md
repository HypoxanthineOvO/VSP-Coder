# M4 错误事件、底部错误卡片与分级恢复报告

- Cycle：C3
- Milestone：M4 错误事件、底部错误卡片与分级恢复
- 完成时间：2026-05-07T22:54:52+08:00
- 状态：complete

## 目标

让 HTTP、SSE、provider、refresh 和发送错误不再静默失败，而是渲染为用户可理解、可恢复的底部错误卡片，并且技术详情经过脱敏。

## 变更

- 协议层新增 `AppError` 统一错误模型，包含错误类型、HTTP 状态码、用户说明、技术详情、retry policy 和 target。
- 后端新增错误规范化与脱敏工具，API catch 统一返回 `{ error: AppError }`。
- 后端脱敏覆盖 Authorization、Cookie、API key、token、secret、Bearer token 和 `/home/...` 绝对路径。
- 前端 API client 解析 `AppError`，本地网络/文本错误也会转换成同一模型。
- 前端新增底部 `ErrorDock` 和 `ErrorCard`，展示 502/429/SSE/send/refresh 等错误，支持技术详情展开、关闭和重试。
- 发送失败会保留草稿并绑定 session target；refresh、SSE 断开和 5xx/429 走分级 retry 入口。
- SSE 断开现在会显式显示“实时连接”错误，而不是停在旧 cache 状态里。

## 验证

- `npm run typecheck`：通过
- `npm run test`：通过，58 个单测通过
- `npm run e2e -- --project=chromium --grep "error|retry"`：通过，3 个 Chromium 用例通过
- `npm run build`：通过

## 剩余风险

- provider live refresh failed 目前通过事件/refresh 错误入口可见，但更细粒度的 queue item retry UI 可在 M6/M8 做体验强化。
- 错误卡片已有基础视觉和不遮挡 composer 的布局，统一动效会在 M6 接入。

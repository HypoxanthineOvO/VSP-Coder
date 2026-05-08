# C3 M1 报告：Chromium Playwright、截图与消息生命周期红灯基线

时间：2026-05-07T22:25:55+08:00

## 摘要

M1 已完成。新增 Chromium Playwright 测试基础设施、截图 smoke baseline 和消息生命周期 expected-red 基线。业务修复尚未在 M1 进行；红灯测试明确指向 M2。

## 已实现

- 新增 `@playwright/test` dev dependency。
- 新增 root scripts：
  - `npm run e2e`
  - `npm run screenshots`
- 新增 `playwright.config.ts`：
  - Chromium project。
  - `webServer` 自动执行 `npm run build` 后启动本地 server。
  - 使用 `VSP_CODER_STATE_DIR=.vsp-coder/e2e-state` 隔离 E2E 状态。
  - 使用 `VSP_DEV_FIXTURES=1` 提供 dev-test fixture。
  - 绑定 `127.0.0.1:4197`，不按端口杀进程。
- 新增 `e2e/workbench.spec.ts`：
  - 5 个视口截图 smoke：1440x900、1280x800、1024x768、768x900、390x844。
  - 基础控件可达性 smoke。
  - 截图产物写入 `test-results/m1-screenshots/`。
- 新增 `e2e/message-lifecycle-red.spec.ts`：
  - `mergeProviderRefresh` 应保留 previous live-only messages。
  - 前端 stale non-empty `/api/state` 不应覆盖新 live messages。
  - 同 role 同文本不同 provider item 消息应全部保留。
  - busy queue pending outbound 应在主消息流有 optimistic user message。
  - 以上 4 项均用 Playwright `test.fail` 标记为 expected-red，后续 M2 转绿。
- 新增 `apps/web/src/sessionMerge.ts`，把前端现有 merge/sanitize 逻辑抽出为可测试模块；保持现有行为不修复。
- `apps/server/src/store.ts` 新增 `VSP_CODER_STATE_DIR` 支持，默认行为不变，用于 E2E 状态隔离。
- `.gitignore` 新增 `test-results/` 和 `playwright-report/`。

## 红灯矩阵

| 红灯项 | 当前测试 | 当前状态 | 后续入口 |
|---|---|---|---|
| Server provider refresh 丢 live-only messages | `e2e/message-lifecycle-red.spec.ts` | expected-red | M2 |
| 前端 stale non-empty state 覆盖 live messages | `e2e/message-lifecycle-red.spec.ts` | expected-red | M2 |
| 同文本重复消息被内容去重删除 | `e2e/message-lifecycle-red.spec.ts` | expected-red | M2 |
| Busy queue pending outbound 不进主消息流 | `e2e/message-lifecycle-red.spec.ts` | expected-red | M2 |
| 多视口工作台非空截图 | `e2e/workbench.spec.ts` | green | M5/M6 可复用 |
| 核心输入/状态栏/发送按钮可达 | `e2e/workbench.spec.ts` | green | M3-M6 可复用 |

## 验证命令

| 命令 | 结果 |
|---|---|
| `npm run typecheck` | pass |
| `npm run test` | pass |
| `npm run e2e -- --project=chromium` | pass，10 passed，其中 4 个 expected-red |
| `npm run screenshots -- --project=chromium` | pass，5 passed |
| `npm run build` | pass |

## 截图产物

截图 smoke 写入 ignored 目录：

- `test-results/m1-screenshots/desktop-1440.png`
- `test-results/m1-screenshots/desktop-1280.png`
- `test-results/m1-screenshots/tablet-1024.png`
- `test-results/m1-screenshots/tablet-768.png`
- `test-results/m1-screenshots/mobile-390.png`

## 注意事项

- M1 没有修复消息生命周期问题，只建立了稳定红灯。
- `test.fail` 是有意使用：如果 M2 修复后这些测试开始通过，Playwright 会提示 unexpected pass，届时 M2 需要移除 expected-fail 标记。
- E2E server 使用独立 `.vsp-coder/e2e-state`，避免污染用户本地 `.vsp-coder/config.json` 和 mock store。

## 结论

M1 完成并可作为后续 M2-M8 的自动化回归基线。

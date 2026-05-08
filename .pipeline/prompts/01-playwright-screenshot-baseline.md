# Prompt 01: Chromium Playwright、截图与消息生命周期红灯基线

## Objective

建立 Chromium E2E、截图和消息生命周期红灯测试，使后续修复能先被稳定复现，再逐项转绿。

## 需求

- 新增 Playwright 配置和脚本，主线只要求 Chromium。
- 设计可稳定启动本地 server/web 的测试方式；遵守本项目服务重启安全规则，不按端口批量杀进程。
- 建立多视口截图矩阵：`1440x900`、`1280x800`、`1024x768`、`768x900`、`390x844`。
- 覆盖基础工作台场景：会话加载、上次选中恢复入口、reasoning 控制面入口、错误卡片预留状态、Subagent trace、响应式侧栏、动效关键状态。
- 新增消息生命周期红灯套件，允许当前失败但必须稳定复现：
  - 同一 session 连续两条相同文本消息，刷新/final merge 后两条都应保留。
  - `mergeProviderRefresh` 必须保留 previous live-only messages，直到 provider final item 明确确认或替换。
  - 前端 `/api/state` 返回非空但旧的 messages 时，不能覆盖较新的 live/hydrated messages。
  - 发送后立即刷新或重载，optimistic user message 仍应可见。
  - busy queue pending outbound 必须能进入主消息流，状态栏/QueueDock 不能作为唯一可见性。
  - SSE `onerror`/reconnect 和 provider refresh failure 能进入错误状态夹具。
  - refresh event 噪音应有上限或可观测基线。
  - 500+ messages 长会话有可记录的渲染性能基线。

## Boundaries

- 可改 `package.json`、新增 `playwright.config.*`、新增 E2E/截图测试目录、必要测试夹具。
- 可新增 server/web 测试夹具 endpoint，但只能服务于可控测试，避免提前修复 M2-M8 的业务行为。
- 可以新增小型纯函数测试以覆盖 merge 行为。

## Non-Goals

- Firefox/WebKit 不作为阻塞项。
- 不要求接入远端 CI。
- 不在本 Milestone 修复消息生命周期业务逻辑；红灯测试应标注为 expected failure 或后续 M2 任务。

## 预期测试

- `npm run e2e -- --project=chromium` 可运行。
- `npm run screenshots -- --project=chromium` 可运行。
- 红灯测试能稳定复现 M0 补充审计发现的问题，并在报告中标记归属 Milestone。
- 截图能捕捉主要布局和状态，不出现空白页面、控件重叠或导航不可达。

## Validation Commands

```bash
npm run test
npm run e2e -- --project=chromium
npm run screenshots -- --project=chromium
```

## Evidence

- Playwright 通过日志或 expected-red 摘要。
- 截图产物或截图检查摘要。
- 红灯矩阵：问题、复现脚本、当前状态、后续修复入口。
- 记录任何需要 M2-M8 修复的测试失败，并标注为预期红灯或后续任务。

## Human QA

- 测试/审计视角维护场景，实施者补齐夹具。
- 验证截图是否真的覆盖用户痛点，而不是只检查页面能打开。
- 确认红灯测试没有把当前错误行为固化成通过条件。

## 预期产出

- `playwright.config.*`
- `e2e/` 或等价测试目录
- `package.json` 脚本更新
- `.pipeline/reports/M1-playwright-red-baseline.md`

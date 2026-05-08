# Prompt 03: 会话选择与 reasoning 控制面可靠性

## Objective

修复默认进入旧会话，以及 reasoning/xhigh 切换慢、失败不可见、状态污染的问题。此 Milestone 复用 M2 的消息生命周期与 freshness primitives，不再重新设计消息缓存层。

## 需求

- 前端持久化上次选中的 project/session。
- 在刷新、discovery refresh、SSE event、hydration 后确定性恢复上次选中会话。
- 当 session 不存在、project 缺失、会话已归档或 provider 数据缺失时进入可解释 fallback。
- 重构 model/reasoning switch：
  - 快速反馈。
  - 禁用重复提交。
  - pending/success/failed/rollback/retry 状态机。
  - provider capability 校验。
  - 失败路径通过 M4 将使用的统一错误模型入口暴露。
- 使用 M2 已建立的 freshness/request generation 机制，避免 reasoning refresh 与 session detail refresh 互相覆盖。

## Boundaries

- 重点文件：`apps/web/src/main.tsx`、`apps/server/src/index.ts`、`apps/server/src/codexModels*.ts`、`packages/protocol/src/index.ts`。
- 可新增小型测试辅助函数，但避免大规模前端状态库迁移。
- 不重复实现 M2 已负责的 message identity、optimistic outbound 和 queue 收敛。

## Non-Goals

- 不重写 provider adapter。
- 不实现跨设备同步用户选择。
- 不把完整底部错误卡片 UI 放进本 Milestone。

## 预期测试

- 刷新后 active session 等于上次选中会话。
- 切换 `xhigh/high/medium/low` 有即时 UI 状态。
- 后端失败时 UI 回滚到原状态并显示可重试错误入口。
- provider 不支持的 reasoning 不应污染 session 状态。
- 选择恢复不会触发消息回退或进入旧会话。

## Validation Commands

```bash
npm run test
npm run e2e -- --project=chromium --grep "session|reasoning"
```

## Evidence

- 单元/集成测试通过。
- Playwright 证明刷新恢复和 failure rollback。
- 报告记录旧会话问题和 reasoning 切换问题的根因关闭证据。

## Human QA

- 审计/验证视角复核状态机、fallback、失败路径和持久化边界。

## 预期产出

- 会话选择和 reasoning 控制面修复代码与测试。
- `.pipeline/reports/M3-session-reasoning.md`

# M3 会话选择与 Reasoning 控制面可靠性报告

- Cycle：C3
- Milestone：M3 会话选择与 reasoning 控制面可靠性
- 完成时间：2026-05-07T22:45:46+08:00
- 状态：complete

## 目标

关闭“刷新后默认进入旧会话”和“xhigh/reasoning 切换慢、失败不可见、状态污染”的问题，并复用 M2 的请求 freshness 基础，避免刷新和详情加载互相回退。

## 变更

- 新增 `sessionSelection` 小模块，负责读取/写入上次选择，并确定性解析 active project/session。
- 前端会把上次选中的 project/session 写入 `localStorage`，刷新、SSE、discovery refresh 和 hydration 后都优先恢复该选择。
- 当上次 project/session 不存在或项目为空时，会进入可解释 fallback，并通过现有 inline error 入口暴露原因。
- model/reasoning 切换新增前端状态机：pending、success、failed、rollback。
- 切换时先做 provider capability 校验，禁用重复提交，并提供即时 UI 反馈。
- 后端 `switch_model` 改为严格校验 provider/model/reasoning，不再把不支持的 reasoning 静默改成默认值。
- 修复 `codex-default` 显示 fallback model 时 reasoning 提交仍带旧 session model 的问题，reasoning 切换现在提交控件实际选中的 model。

## 验证

- `npm run typecheck`：通过
- `npm run test`：通过，56 个单测通过
- `npm run e2e -- --project=chromium --grep "session|reasoning"`：通过，4 个 Chromium 用例通过
- `npm run build`：通过

## 剩余风险

- 502/429 等错误的统一底部错误卡片与重试卡片将在 M4 完成。
- 这次使用 inline error 作为 M4 前的统一错误入口，视觉和交互会在下一里程碑升级。

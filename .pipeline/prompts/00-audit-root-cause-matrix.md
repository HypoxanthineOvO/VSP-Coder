# Prompt 00: 全栈审计与已知 Bug 根因矩阵

## Objective

完成 C3 的证据优先审计：覆盖前端、后端、协议、持久化、测试、脚本、文档、安全和可扩展性，并逐条解释用户已知 Bug 的根因与修复入口。

## 需求

- 不修改业务代码，先建立审计事实。
- 阅读 `apps/web/src/main.tsx`、`apps/web/src/styles.css`、`apps/server/src/index.ts`、`apps/server/src/store.ts`、`apps/server/src/codex*.ts`、`packages/protocol/src/index.ts`、`package.json`、`docs/`、`.vsp-coder/` 相关本地状态入口。
- 对照以下 Bug 逐条给出源码证据、数据流、状态机、复现路径、根因解释、风险级别和修复入口：
  - 默认加载很老会话。
  - reasoning/xhigh 切换慢且有失败概率。
  - 发送动画卡顿。
  - 窄桌面 Project/session 导航不可见或不可达。
  - Subagent 识别不到，无法进入详情或交互。
  - 502、429 等错误没有完整渲染。
  - 前端动效缺少统一体系。
- 审计完成后提出补充 Plan 建议：哪些后续 Milestone 需要重排、拆分、新增或改范围。

## Boundaries

- 只读审计为主，允许创建报告文件。
- 可运行验证命令建立基线。
- 不修业务逻辑，不重构代码，不新增依赖。

## Non-Goals

- 不在本 Milestone 修复 Bug。
- 不启动需要确认的服务重启。
- 不把审计发现直接写成未验证的结论。

## 预期测试

- 现有命令能作为基线运行。
- 审计报告必须覆盖所有已知 Bug。
- 每个结论必须包含文件/函数/状态路径证据。

## Validation Commands

```bash
npm run typecheck
npm run test
npm run build
```

## Evidence

- 写入 `.pipeline/reports/M0-audit.md`。
- 写入 `.pipeline/reports/M0-known-bug-root-cause-matrix.md`。
- 报告中记录命令结果、失败项、风险分级、源码证据和补充 Plan 建议。

## Human QA

- 审计/验证视角复核报告，不由后续实现者单独验收。
- M0 完成后必须触发 `/hw:plan:review` 或 `/hw:plan:extend` 的补充计划检查，再继续 M1+。

## 预期产出

- `.pipeline/reports/M0-audit.md`
- `.pipeline/reports/M0-known-bug-root-cause-matrix.md`
- 补充 Plan 建议清单

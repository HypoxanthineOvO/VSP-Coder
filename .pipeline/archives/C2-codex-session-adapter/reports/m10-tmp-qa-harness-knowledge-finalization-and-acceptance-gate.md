# M10 Tmp QA Harness, Knowledge Finalization, And Acceptance Gate

状态: manual_validation  
时间: 2026-05-06 14:01 Asia/Shanghai

## 完成内容

- 新增 disposable tmp QA fixture generator。
- 新增 `POST /api/qa/tmp-fixture`，每次在 `os.tmpdir()` 下生成唯一 `vsp-coder-c2-*` 目录。
- 新增 `POST /api/qa/tmp-session`，生成 disposable tmp fixture 后立刻在该 cwd 下创建空 Codex thread，方便用户在 UI 里手工发送最终 smoke prompt。
- fixture 包含 `README.md`、`qa-notes.md`、`.gitignore`，并返回最终 Codex smoke prompt。
- fixture 路径是运行时输出，不写入生产默认配置，不 hardcode 用户路径。
- provider protocol 和 Codex adapter mapping 已补充 C2 final limitations、tmp QA rule、OpenCode/Claude handoff notes。
- knowledge reference index 已将 C2 provider protocol 和 Codex adapter mapping 标记为 `finalized-for-c2`。
- C2 final acceptance report 已生成：`.pipeline/reports/c2-final-acceptance-report.md`。

## 修改文件

- `apps/server/src/tmpQa.ts`
- `apps/server/src/tmpQa.test.ts`
- `apps/server/src/index.ts`
- `apps/server/src/store.test.ts`
- `.pipeline/knowledge/reference/vsp-provider-protocol.md`
- `.pipeline/knowledge/reference/codex-adapter-mapping.md`
- `.pipeline/knowledge/index/references.yaml`
- `.pipeline/knowledge/index/decisions.yaml`
- `.pipeline/reports/c2-final-acceptance-report.md`
- `.pipeline/reports/m10-tmp-qa-harness-knowledge-finalization-and-acceptance-gate.md`

## 自动验证

- 通过：`npm run typecheck`
- 通过：`npm test`（50 tests）
- 通过：`npm run build`
- 通过：`git diff --check`

## Tmp Fixture Evidence

- Endpoint: `POST /api/qa/tmp-session`
- Generated tmp path: `<system-tmp>/vsp-coder-c2-*`
- Generated session id: `019dfbcd-d545-7971-a1e2-b77667896d14`
- Generated project id: `codex-lnxcac`
- Generated files:
  - `<system-tmp>/vsp-coder-c2-*/README.md`
  - `<system-tmp>/vsp-coder-c2-*/qa-notes.md`
  - `<system-tmp>/vsp-coder-c2-*/.gitignore`
- Smoke prompt:

  ```text
  M10 final QA smoke: please run pwd, create m10-codex-smoke.txt with content hello-m10, then show the file content. Do not modify files outside this disposable tmp QA directory.
  ```

4180 已按安全流程重启到新构建，运行配置已恢复为 `local / codex / full_auto`，Codex provider health 为 `ready`。
`/api/state` 已确认能看到 session `019dfbcd-d545-7971-a1e2-b77667896d14`，cwd 为系统临时目录下的 disposable QA project。

## 验收前 UI 收口修复

- 降低流式期间 detail polling 对 live message 的覆盖：detail merge 会保留更长的 live text，busy 轮询放缓到 2.5s，避免正在流式输出的消息被旧快照反复替换。
- PC 顶栏改为明确 grid 宽度和窄屏裁剪规则，1280px 以下桌面宽度隐藏低优先级指标，避免模型/按钮/状态文字互相重叠。
- 右侧栏移除 `Activity` tab；Activity 只保留在左侧栏。
- Skill/File preview 改为读取真实文件内容，skill 路径从 `CODEX_HOME` 或用户 home 动态推导，不 hardcode 用户路径。
- Skill panel 列表改为简写入口，点击后显示完整 Markdown/File 内容。
- 输入框补全点击后直接插入正文，不再生成独立 token chip。

收口验证：

- 通过：`npm run typecheck`
- 通过：`npm test`（50 tests）
- 通过：`npm run build`
- 通过：`git diff --check`
- 已安全重启 4180 并恢复 `local / codex / full_auto`。
- `GET /api/preview/skill-plan` 返回真实 `<codex-home>/skills/.../SKILL.md` 内容，body length 9453。

## 最终手工 QA 脚本

1. 如需重新生成 disposable tmp Codex session，运行：

   ```bash
   curl -sS -X POST http://127.0.0.1:4180/api/qa/tmp-session
   ```

2. 本次已生成的验收 session 是 `019dfbcd-d545-7971-a1e2-b77667896d14`，路径位于系统临时目录下的 disposable QA project。
3. 在 VSP-Coder 中刷新，打开最近 Session/Project 里的 `Codex 019dfbcd`。
4. 使用返回的 `prompt` 发送最终 smoke 请求：

   ```text
   M10 final QA smoke: please run pwd, create m10-codex-smoke.txt with content hello-m10, then show the file content. Do not modify files outside this disposable tmp QA directory.
   ```

5. 确认消息流能显示 assistant response，运行中状态和最终状态正常。
6. 确认命令 artifact、文件变更 artifact、preview 能看到 `m10-codex-smoke.txt` 和 `hello-m10`。
7. 发送第二条消息测试 pending queue；必要时点击 Interrupt 验证 active turn 中断。
8. 将 tmp thread rename 为 `M10 final QA <date>`，刷新浏览器确认持久。
9. 安全重启 4180，再确认该 tmp thread 仍显示 rename 后名称。
10. 检查 Settings 为 `local / codex / full_auto`。
11. 检查模型池来自 Codex `model/list`，只显示 Codex 模型。

## Acceptance Gate

C2 不能自动 accept。用户完成最终手工 QA 后，需要明确回复：

- `accept`：进入 Hypo-Workflow accept gate，关闭 C2。
- reject feedback：记录反馈并继续修复。

## 已知遗留

- 移动端软键盘跟随仍可能受浏览器/系统影响，用户已明确暂不阻塞 M09/M10。
- Codex app-server plugin sync warning 在 API-key auth 下可能出现；当前视为非阻塞 warning。
- VSP pending queue 仍是内存态，不是跨 server restart 的 durable queue。

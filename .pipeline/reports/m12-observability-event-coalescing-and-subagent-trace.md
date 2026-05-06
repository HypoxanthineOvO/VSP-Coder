# M12 Observability, Event Coalescing, And Subagent Trace

状态: manual_validation  
时间: 2026-05-06 14:33 Asia/Shanghai

## 完成内容

- 事件降噪：
  - Codex `item/completed`、artifact 更新、turn started、thread status、token usage、rate limit 等高频 live 更新不再持久刷 Activity。
  - 前端不再因为 `rate_limit_updated`、`metric_updated`、`warning` 这类无 sessionId 事件触发全量 `/api/state` 刷新。
  - Store 层对 warning、metric、rate-limit、Codex app-server health 这类噪声事件做 60s coalescing。
  - Codex app-server 的已知非阻塞 warning 不再作为红色 error 写入 Activity。
- Subagent trace：
  - 后端识别 subagent-like notification：`subagent`、`spawn_agent`、`wait_agent`。
  - 后端识别 thread history 中 subagent-like item，并映射为 tool trace message。
  - 前端详细模式下显示 `Subagent <agent> · <status>` 小条目。
  - 点击 subagent 条目会打开 trace modal，显示 status、agent、method、summary 和 raw trace。
  - 简易模式仍隐藏工具细节，只保留工作中/思考中浮标。
- PC 窄宽顶栏：
  - 1380px 以下桌面宽度隐藏低优先级 statusbar 文本，只保留状态、模型、reasoning 和显示模式。
  - 1220px 以下进一步压缩状态栏，避免按钮和文本挤压重叠。
- 测试隔离：
  - 修复 `store.test` 对 ignored local config 的状态污染，避免 release/manual 测试影响后续测试进程。

## 修改文件

- `apps/server/src/codexEvents.ts`
- `apps/server/src/codexEvents.test.ts`
- `apps/server/src/codexDiscovery.ts`
- `apps/server/src/codexDiscovery.test.ts`
- `apps/server/src/index.ts`
- `apps/server/src/store.ts`
- `apps/server/src/store.test.ts`
- `apps/web/src/main.tsx`
- `apps/web/src/styles.css`
- `.pipeline/prompts/12-observability-event-coalescing-and-subagent-trace.md`

## 自动验证

- 通过：`npm run typecheck`
- 通过：`npm test`（52 tests）
- 通过：`npm run build`
- 通过：`git diff --check`

4180 已按安全流程重启到新构建，运行配置已恢复为 `local / codex / full_auto`，Codex provider health 为 `ready`。

## 复查修复

- 修复 live delta 和 final `item/completed` 使用不同 id 时，前端/后端缓存中同一 assistant 文本重复显示的问题。
- 如果用户请求 subagent/worker/explorer，但 Codex 没有发出真实 subagent trace，详细模式会显示 `Subagent provider · not observed`，点击可看到“provider 未发出 trace”的说明。
- 复查发现实际 QA 会话中 Codex 历史只有 user + assistant，没有 subagent/tool item；因此本次问题不是 UI 没渲染，而是 provider 没实际调用或没暴露 subagent trace。
- 复查后重新通过：`npm run typecheck`、`npm test`（52 tests）、`npm run build`、`git diff --check`。
- 4180 已再次按安全流程重启，配置恢复为 `local / codex / full_auto`。

## 手工 QA

1. 刷新 `http://127.0.0.1:4180`。
2. 在一个 disposable tmp session 中发送一条会触发 subagent 的 probe，例如：

   ```text
   M12 subagent trace QA：请使用一个 subagent/worker 帮你只读检查当前目录文件列表，然后在主回复里总结结果。不要修改文件。
   ```

3. 切到详细模式，确认消息流里出现 Subagent 小条目。
4. 点击 Subagent 小条目，确认弹出 trace 面板。
5. 观察左侧 Activity，确认非阻塞 Codex warning 不再反复刷屏。
6. 把浏览器桌面宽度缩到 1380px、1220px 附近，确认 PC 顶栏不重叠。

## 已知说明

- Codex health 里仍可能保留 app-server `lastError` 字段，因为这是 provider health 的原始状态；M12 只是不再把已知非阻塞 warning 刷进 Activity。
- 真实 subagent schema 依赖 Codex app-server 实际通知/历史 item；M12 已加入 heuristic 和 raw trace 面板，若 app-server 后续给出更正式 schema，可在该映射上继续收窄。

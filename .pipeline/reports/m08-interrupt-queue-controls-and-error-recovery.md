# M08 Interrupt, Queue Controls, And Error Recovery

状态: manual_validation  
时间: 2026-05-05 23:54 Asia/Shanghai

## 完成内容

- Codex 模式下 `interrupt` 已接入真实 `turn/interrupt`，只中断当前 active turn，不终止 VSP-Coder server 或 Codex app-server 进程。
- Codex 模式下 `clear_queue` 只清理 VSP pending queue item，保留 active turn 和已发送 queue item。
- 发送消息时如果 session 正在 `running`、`waiting_approval` 或存在 `currentTurnId`，消息进入 VSP pending queue；active turn 完成后自动取下一条 pending message 发送到 `turn/start`。
- `thread/read includeTurns` 现在会从 `inProgress` turn 还原 `currentTurnId`，页面刷新后仍可执行 Interrupt。
- app-server `crashed`、`unavailable`、`stopped` 时，active Codex sessions 标记为 `error`，open request cards 标记为 failed，pending queue 保留。
- app-server `ready` 后会 invalidate discovery cache，并刷新 cached active/error sessions 以重新对齐 Codex canonical state。

## 修改文件

- `apps/server/src/index.ts`
- `apps/server/src/codexDiscovery.ts`
- `apps/server/src/codexQueue.ts`
- `apps/server/src/codexQueue.test.ts`
- `.pipeline/knowledge/reference/vsp-provider-protocol.md`
- `.pipeline/knowledge/reference/codex-adapter-mapping.md`

## 自动验证

- `npm run typecheck` 通过。
- `npm test -w @vsp-coder/server` 通过，39 个 server tests 全部通过。
- `npm test` 通过。
- `npm run build` 通过。

## 手工验证建议

1. 在 tmp workspace 创建或选择一个 Codex session，发送一个需要运行几秒的请求。
2. 立刻再发送 2 条消息，确认 queue 计数增加。
3. 点击 Clear Queue，确认 pending queue 被清空，但当前 turn 仍在运行。
4. 再启动一个长 turn，点击 Interrupt 并确认；确认状态变为 interrupted，服务不掉线。
5. 打开两个浏览器窗口，重复 queue/interrupt，确认两边 Activity/session 状态同步。
6. 可选：从 Settings stop/start Codex app-server，确认断开时 active session 显示 error，ready 后刷新恢复可理解状态。

## 限制和后续

- M08 采用 VSP server queue + 后续 `turn/start` draining；暂不使用 `turn/steer`，因为 Codex 对部分 active turns 会拒绝 same-turn steering。
- Pending queue 当前是进程内状态，符合 C2 手工测试需要；后续若需要跨 server restart 保留 pending outbound queue，可再引入持久化队列表。

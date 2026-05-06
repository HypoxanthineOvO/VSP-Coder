# C2 Release Brief

状态: ready_for_push  
版本: v0.2.0  
时间: 2026-05-06 15:00 Asia/Shanghai

## 发布范围

C2 将 VSP-Coder 从 C1 mock workbench 推进到真实 Codex Session Adapter：

- 前端接入真实 Codex project/session/thread discovery。
- 后端接入 Codex app-server stdio JSON-RPC，并完成 provider-neutral 协议沉淀。
- 支持 new/resume/send/interrupt/queue/rename/approval/full-auto/file artifact/command output/preview。
- 支持 Markdown、公式、安全 HTML、工具折叠、简易/详细模式、Subagent trace 提示和弹出详情。
- 新增 `npm run deploy:local`，自动选择可用端口并写入 ignored runtime metadata。

## 发布校验

- Subagent hardcode audit: completed；生产源码未发现用户路径 hardcode。
- Release hardcode scan: passed；发布范围未发现本机 home、旧 LAN IP、旧 tmp fixture 或旧固定 URL。
- Sync: `hypo-workflow sync --repair --platform opencode --project <repo-root>` 后复查 `derived=fresh`。
- Docs: README、user guide、developer guide、API reference、CHANGELOG 均已更新部署与 C2 contract。
- Regression: `npm run typecheck` passed。
- Regression: `npm test` passed，52 tests。
- Regression: `npm run build` passed。
- Hygiene: `git diff --check` passed。
- Deployment smoke: `npm run deploy:local -- --no-build --start-port=4180` selected available port 4181 and `/api/health` returned `dataMode=codex`, `deploymentMode=local`, `automationProfile=full_auto`。
- Codex smoke: `POST /api/providers/codex/start` returned `status=ready` and user agent included `vsp-coder; 0.2.0`。

## 非阻塞备注

- 仓库当前没有 `LICENSE` 文件；本次 release 不新增 license authority。
- OpenCode 与 Claude Code 仍是后续 adapter scope；C2 已保留共享协议与 knowledge entry。
- 移动端软键盘体验仍可继续打磨，但不阻塞 C2 Codex adapter release。

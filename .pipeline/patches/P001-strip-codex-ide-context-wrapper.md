# P001: 过滤 Codex IDE 上下文包装文本
- 严重级: minor
- 状态: closed
- 发现于: C2 follow-up
- 创建时间: 2026-05-06T15:23:51+08:00
- 修复时间: 2026-05-06T15:29:00+08:00
- 改动: `apps/server/src/codexDiscovery.ts` — 仅在 Codex userMessage 以 IDE context 包装开头且包含 `My request for Codex:` 时剥离包装文本。
- 测试: ✅ `npm test -w @vsp-coder/server`；✅ `npm run typecheck`；✅ `git diff --check`
- commit: `(this commit)`
- 关联: (无)
- resolved_by: null
- related: []
- supersedes: []

## 问题

右侧预览/查看真实 Codex 会话时，部分用户消息会显示 IDE 注入的包装文本：

```text
Context from my IDE setup:
Open tabs:
...
My request for Codex:
真实的会话
```

预期只显示用户真实请求内容。

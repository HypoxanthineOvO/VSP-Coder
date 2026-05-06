# P002: 右侧预览过滤 IDE 上下文包装文本
- 严重级: minor
- 状态: closed
- 发现于: C2 follow-up
- 创建时间: 2026-05-06T15:35:00+08:00
- 修复时间: 2026-05-06T15:42:05+08:00
- 改动: 抽出 Codex IDE context wrapper 过滤器，并接入消息发现、artifact preview、文件/skill preview 路径
- 测试: ✅ npm test -w @vsp-coder/server；✅ npm run typecheck；✅ git diff --check
- 关联: P001
- resolved_by: (this commit)
- related: [P001]
- supersedes: []

## 问题

P001 只过滤了会话消息流。右侧查看/预览路径仍可能直接渲染 Codex/VSCode 写入 session history 的 IDE context wrapper：

```text
Context from my IDE setup:
Open tabs:
...
My request for Codex:
真实的会话
```

预期右侧预览也只显示真实请求内容。

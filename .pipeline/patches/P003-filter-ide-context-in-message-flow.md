# P003: 消息流过滤 IDE 上下文包装文本
- 严重级: minor
- 状态: closed
- 发现于: C2 follow-up
- 创建时间: 2026-05-06T15:55:16+08:00
- 修复时间: 2026-05-06T15:58:07+08:00
- 改动: apps/web/src/main.tsx：在 state/detail/live patch 合并与消息渲染前统一清洗 IDE context wrapper
- 测试: ✅ npm run typecheck；✅ npm test -w @vsp-coder/server；✅ npm run build；✅ git diff --check
- 关联: P001, P002
- resolved_by: (this commit)
- related: [P001, P002]
- supersedes: []

## 问题

消息流历史中仍可能显示 Codex/VSCode 写入 session history 的 IDE context wrapper：

```text
Context from my IDE setup:
Open tabs:
...
My request for Codex:
真实的会话
```

P001/P002 已覆盖后端历史读取与右侧预览，但前端 live/cache 合并逻辑可能保留更长的旧消息内容，导致 wrapper 在对话框历史里继续显示。

## 预期

消息流中隐藏 wrapper 正文，只展示真实请求内容；如需要来源提示，只能以极小的来源标记显示，不能渲染成正文。

# 开发者指南

VSP-Coder 是一个 TypeScript npm workspace。

## Workspace 布局

| 路径 | 作用 |
|---|---|
| `packages/protocol` | 共享的 provider-neutral 协议类型和辅助函数。 |
| `apps/server` | Node HTTP server、Codex app-server client、SSE event stream、本地 store 和静态 web 服务。 |
| `apps/web` | React/Vite 工作台 UI。 |
| `scripts` | 本地部署辅助脚本。 |
| `.pipeline` | Hypo-Workflow 规划、进度、报告和知识文件。 |

## 运行时契约

服务端暴露本地 API：

- `/api/state` 返回工作台状态。
- `/api/models` 在可用时从 Codex `model/list` 返回 Codex 模型选项。
- `/api/workflow` 返回 Hypo-Workflow 项目状态。
- `/api/sessions` 在已发现项目目录中创建 Codex threads。
- `/api/sessions/:id` 为 Codex 会话补全历史或发送消息。
- `/api/sessions/:id/actions` 处理重命名、中断、队列、设置和 workflow 动作。
- `/api/events` 流式输出 provider-neutral live patches 和生命周期事件。

本地运行时文件位于 `.vsp-coder/`，并已被 git 忽略。

## 部署辅助命令

`npm run deploy:local` 会构建 workspace、寻找可用端口、启动构建后的服务、等待 `/api/health`，然后写入 `.vsp-coder/deployment.json`。

支持的参数：

- `--start-port=<port>`
- `--port=<port>`
- `--host=<host>`
- `--no-build`

## 端口配置

构建后的 server 按以下顺序读取端口：

1. `PORT`
2. `VSP_CODER_PORT`
3. 默认值 `4180`

host 按顺序读取 `HOST`、`VSP_CODER_HOST`，最后回退到 `0.0.0.0`。

Vite dev proxy 会读取 `VITE_API_TARGET`，未设置时回退到同一组端口变量。

## 验证

发布前运行完整本地 gate：

```bash
npm run typecheck
npm test
npm run build
git diff --check
```

## Provider 说明

C2 发布包含真实 Codex adapter。OpenCode 和 Claude Code 在当前版本中不是活动 adapter；后续集成应使用 `.pipeline/knowledge/reference/` 下记录的 provider protocol。

## 安全说明

- 不要硬编码用户路径或机器专属的局域网 URL。
- 重启本地服务时不要只按端口杀进程。
- 停止本地部署前，必须验证 PID、命令和工作目录。

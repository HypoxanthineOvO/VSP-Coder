# VSP-Coder

![版本](https://img.shields.io/badge/version-v0.2.1-1f6feb)
![许可证](https://img.shields.io/badge/license-AGPL--3.0--or--later-2da44e)
![Node.js](https://img.shields.io/badge/Node.js-20%2B-43853d)
![状态](https://img.shields.io/badge/status-Codex%20adapter%20ready-8250df)

VSP-Coder 是一个本地 Codex 工作台，用来在多个项目之间监督真实 Codex 编码会话、历史记录、待发送队列、审批、模型选择、产物预览和 Hypo-Workflow 项目状态。

当前版本：`v0.2.1`

## 适合谁

- 想把本地 Codex 会话整理成可浏览、可排队、可审批工作台的开发者。
- 需要同时查看项目、会话、工具输出、文件变更和工作流状态的 Codex 重度用户。
- 希望在 Codex 之外保留 provider-neutral 协议，后续继续接入 OpenCode 或 Claude Code 的团队。

## 亮点

| 能力 | 说明 |
|---|---|
| 真实 Codex 会话 | 从 Codex thread 元数据发现项目和会话，并补全完整消息历史。 |
| 发送与排队 | 支持新建 thread、发送消息、忙碌时排队，以及中断正在运行的 turn。 |
| 实时状态 | 通过 SSE live patch 展示助手消息、工具调用、审批和生命周期事件。 |
| 产物预览 | 展示命令输出、文件变更、Markdown、表格、安全 HTML 和数学公式。 |
| 自动化档位 | 支持本地 full-auto、workspace-auto 和 manual confirmation。 |
| Workflow 面板 | 展示 Hypo-Workflow 进度、compact plan、配置、architecture 和 knowledge 入口。 |

## 快速开始

```bash
npm install
npm run build
npm start
```

默认情况下，构建后的服务绑定到 `0.0.0.0`，优先读取 `${PORT}`，其次读取 `${VSP_CODER_PORT}`；二者都未设置时使用 `4180`。

```bash
PORT=4300 npm start
```

服务启动后会打印本机和局域网访问地址。

## 本地部署

如果希望 VSP-Coder 自动选择可用端口，可以使用部署辅助命令：

```bash
npm run deploy:local
```

常用参数：

```bash
npm run deploy:local -- --start-port=4300
npm run deploy:local -- --port=4301
npm run deploy:local -- --host=127.0.0.1
npm run deploy:local -- --no-build
```

部署辅助命令会把运行时文件写入 `.vsp-coder/`，该目录已被 git 忽略：

- `.vsp-coder/deployment.json`
- `.vsp-coder/server.pid`
- `.vsp-coder/deploy-<port>.log`

停止部署实例前，请读取 `.vsp-coder/server.pid`，并确认进程命令是 `node apps/server/dist/index.js`，且工作目录是当前仓库根目录。

## 使用界面

- 左侧全局栏用于切换最近 Sessions、最近 Projects 和 Activity。
- Session 栏用于浏览当前项目会话或创建新的 Codex thread。
- 顶部状态栏用于切换 Codex 模型、reasoning 强度和简单/详细工具展示。
- 右侧栏用于查看 Workflow、Artifacts、Skill/Command 预览和 Settings。
- 移动端会把导航、模型选择和待审批项压缩为更适合小屏的菜单与底部抽屉。

## 项目结构

| 路径 | 说明 |
|---|---|
| `packages/protocol` | 共享 provider-neutral 协议类型和辅助函数。 |
| `apps/server` | Node HTTP server、Codex app-server client、SSE、local store 和静态资源服务。 |
| `apps/web` | React/Vite 工作台 UI。 |
| `scripts` | 本地部署辅助脚本。 |
| `.pipeline` | Hypo-Workflow 规划、进度、报告和知识文件。 |

## 脚本

| 命令 | 用途 |
|---|---|
| `npm run typecheck` | 对所有 workspace 执行 TypeScript 类型检查。 |
| `npm test` | 运行 protocol、server 和 web 测试。 |
| `npm run build` | 构建 protocol、server 和 web 产物。 |
| `npm start` | 启动构建后的服务。 |
| `npm run deploy:local` | 构建并部署到一个可用本地端口。 |
| `npm run qa` | 组合运行测试和构建。 |

## 配置

运行时配置保存在 `.vsp-coder/config.json`，该文件会被 git 忽略。本地部署默认使用 Codex 数据模式和 full automation；发布部署可以在 Settings 面板中选择自动化档位。

重要环境变量：

| 变量 | 用途 |
|---|---|
| `PORT` | 服务端口。 |
| `VSP_CODER_PORT` | `PORT` 未设置时的服务端口。 |
| `HOST` | 服务绑定地址。 |
| `VSP_CODER_HOST` | `HOST` 未设置时的服务绑定地址。 |
| `CODEX_HOME` | 可选的 Codex home 覆盖值。 |
| `VITE_API_TARGET` | Vite 开发代理目标。 |

## 文档

- [用户指南](docs/user-guide.md)
- [开发者指南](docs/developer.md)
- [API 参考](docs/reference/api.md)
- [变更日志](CHANGELOG.md)

## 发布状态

`v0.2.1` 是文档中文化、README 美化、AGPL 许可证和规则同步发布。`v0.2.0` 是已接受的 C2 Codex Session Adapter 发布；OpenCode 和 Claude Code 仍是未来 provider adapter，当前共享协议和知识记录已为后续集成预留。

## 许可证

本项目采用 GNU Affero General Public License v3.0 or later，SPDX 标识为 `AGPL-3.0-or-later`。详见 [LICENSE](LICENSE)。

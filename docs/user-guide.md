# 用户指南

VSP-Coder 会直接打开 Codex 工作台。它没有单独的 landing page；第一屏就是实际工作界面。

## 桌面端

- 使用左侧全局栏切换最近 Sessions、最近 Projects，并查看 Activity。
- 使用 Session 栏浏览当前项目中的会话，或创建新的 Codex thread。
- 拖动列之间的垂直分隔条来调整面板宽度。
- 使用顶部状态栏切换 Codex 模型、reasoning 强度，以及简单/详细工具展示模式。
- 使用右侧栏标签页查看 Workflow、Artifacts、Skill/Command 预览和 Settings。

## 移动端

- 点击左上角菜单打开 Project、Session 和 Activity 导航。
- Recent Sessions 默认会收起为较短列表，避免 Activity 被挤出可访问区域。
- 模型、reasoning 和简单/详细展示控制位于移动端标题栏下方的紧凑 dock。
- 待审批项会以底部抽屉打开，让对话上下文保持可读。

## Codex 会话

在 Codex 模式下，VSP-Coder 会从 Codex app-server 元数据发现 Codex threads。

C2 起支持的操作：

- 打开已有 Codex 会话并补全完整消息历史；
- 在已发现项目目录中创建新的 Codex 会话；
- 向已有会话发送消息；
- 当 turn 正忙时把待发送消息加入队列；
- 中断正在运行的 turn；
- 使用 Codex canonical thread naming 重命名 Codex 会话；
- 预览命令和文件变更产物。

## 展示模式

简单模式会隐藏工具和文件变更细节，但保留正在思考/工作的活动指示。

详细模式会展示工具 trace、文件变更提示、命令输出折叠区，以及 Codex 暴露时的 subagent trace 行。

## Workflow 面板

当项目包含 `.pipeline/` 文件时，Workflow 标签页会展示：

- milestone 进度；
- 当前计划的 compact Markdown；
- 具有清晰用户行为说明的可编辑配置项；
- 只读 Architecture 和 Knowledge 入口。

当项目没有 Hypo-Workflow 文件时，该面板会回退为通用项目状态。

## 部署

普通本地使用：

```bash
npm install
npm run build
npm start
```

自动选择空闲端口：

```bash
npm run deploy:local
```

部署辅助命令会打印本机和局域网 URL，并把运行时细节写入 `.vsp-coder/`。

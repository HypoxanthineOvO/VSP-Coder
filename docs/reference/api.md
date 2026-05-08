# API 参考

VSP-Coder 暴露一组本地 HTTP API，供 web 工作台使用。C2 已用真实 Codex provider 替换旧 mock session 契约，同时保留小而清晰的 adapter 边界，方便后续接入其他 provider。

所有端点都以 local-first 为前提。默认服务端口可以通过 `PORT` 或 `VSP_CODER_PORT` 配置。

## Health

`GET /api/health`

返回服务就绪状态。

```json
{ "ok": true }
```

## State

`GET /api/state`

返回完整 UI 快照：

- provider 运行时状态和自动化策略；
- 已发现的 Codex projects 和 sessions；
- 最近会话；
- 当前选中会话的 transcript；
- 队列项；
- 模型和 reasoning 选择；
- artifacts、command events、file edits、approvals 和 diagnostics。

UI 会把该响应当作可缓存快照，并通过 SSE refresh signals 更新它。

状态消费者必须按消息 identity 合并 session transcript，不能按纯文本去重。刷新响应可能比本地 live patch 更旧，前端需要保留 pending outbound、live-only provider 消息和当前输入草稿。

## Events

`GET /api/events`

打开 Server-Sent Events stream。事件以 `vsp` event 形式发送，携带小型刷新提示，而不是完整 session payload。

消费者应从 `GET /api/state` 刷新受影响状态，并尽量保留本地滚动位置和输入状态。

短暂断线属于正常 reconnect 路径。UI 只有在持续断开后才应显示错误卡；连接恢复后应清理对应的 SSE disconnect error。

## Models

`GET /api/models`

返回当前 provider 可用的模型和 reasoning 选项。对 Codex 来说，列表来自 provider capability surface，而不是前端固定 enum。

每个条目包含：

- `provider`
- `model`
- `label`
- `reasoning`
- `status`
- `note`

模型和 reasoning 切换失败时，server 会返回结构化错误；前端应回滚到已确认选择，并显示可重试的错误卡。

## Provider Actions

`POST /api/provider/start`

当配置的 provider runner 尚未运行时启动它。

`POST /api/provider/stop`

停止由当前 server 拥有的 provider runner。

`POST /api/provider/restart`

仅重启由当前 server 拥有的 provider runner。

## Sessions

`POST /api/sessions`

为已发现或显式选择的项目创建新 session。

请求体：

```json
{
  "projectId": "project-id",
  "message": "optional first message",
  "model": "gpt-5.5",
  "reasoning": "xhigh"
}
```

`POST /api/sessions/:id`

为已有 session 排队一条用户消息。server 会把该项加入本地队列，并驱动真实 Codex runner。

请求体：

```json
{
  "message": "Please run npm test",
  "model": "gpt-5.5",
  "reasoning": "high"
}
```

`POST /api/sessions/:id/actions`

执行 session 级动作。C2 支持的动作包括：

- `switch_model`
- `rename`
- `refresh_state`
- `interrupt`
- `clear_queue`
- `approve`
- `decline`
- `card_action`
- `workflow_check`
- `workflow_sync`
- `config_update`

重命名会通过 provider adapter 暴露的 Codex session storage path 持久化；刷新后用户看到的持久行为与 Codex 保持一致。

### Message blocks

`Message.blocks` 支持文本、工具、产物和结构化 trace。Subagent 使用 `subagent_trace` block：

```json
{
  "type": "subagent_trace",
  "trace": {
    "id": "subagent-trace-id",
    "status": "running",
    "agentName": "Gauss",
    "agentType": "explorer",
    "interaction": {
      "supported": false,
      "reason": "当前 provider 只暴露 Subagent trace，未暴露可进入的交互 channel。",
      "actions": [
        { "id": "view_trace", "label": "查看 trace", "enabled": true }
      ]
    }
  }
}
```

Codex adapter 会同时附加 legacy text block，供旧 UI 或日志工具读取。新 UI 应优先渲染结构化 block。

## Workflow

`GET /api/workflow?projectId=<id>`

当选中项目包含 `.pipeline/` workspace 时，返回 Hypo-Workflow 项目信息：

- milestone 进度；
- compact plan 文本；
- config items；
- architecture references；
- knowledge root；
- `hasWorkflow`。

## Preview

`GET /api/preview/:id`

返回受支持 skills、commands 和 files 的安全预览内容。preview surface 有意保持边界，不应被当作通用 filesystem read endpoint 使用。

## Temporary QA

`POST /api/qa/tmp-session`

仅用于开发环境的辅助端点，服务于 C2 acceptance flow。它会在操作系统临时目录下创建一个临时 Codex-style session，并返回生成的 project/session 元数据。

该端点不得硬编码用户路径，也不应成为正常部署所需条件。

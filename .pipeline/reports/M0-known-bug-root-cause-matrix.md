# C3 M0 已知 Bug 根因矩阵

## 根因矩阵

| Bug | 证据 | 根因判断 | 风险 | 修复计划入口 |
|---|---|---|---|---|
| 默认加载到很老的会话 | `apps/web/src/main.tsx:572-582` 首次 bootstrap 只选 default project 的第一条 session；`541-542` 找不到 active session 时静默 fallback 到 `projectSessions[0]`；没有 active session localStorage。 | 没有“上次选中会话”模型，当前选择由 provider/session 排序和 fallback 决定。刷新后 `sessionSortTimesRef` 也会重建。 | 高 | M2：持久化 last selected project/session；恢复前校验存在；失效时显示 fallback 原因；E2E 覆盖刷新恢复。 |
| reasoning/xhigh 切换慢且概率失败 | `apps/web/src/main.tsx:721-733` `act` 无错误捕获；`1252-1268`/`1321-1339` select 无 pending/disabled；`apps/server/src/index.ts:360-382` 只改 cache；`400-413` model/list 失败静默 fallback。 | 控制面不是状态机，没有 pending、rollback、retry，也没有 provider capability 来源说明。切换成功只是本地 cache 成功，不一定代表 provider 已确认。 | 高 | M2：switch state machine、失败回滚、重试入口、provider capability 校验结果可见；补测试覆盖成功/失败。 |
| 发送动画巨卡 | `apps/web/src/main.tsx:661-681` 发送触发 `sendingMessage`、run state、session 更新；`1718` 按钮文本改变；`apps/web/src/styles.css:14` 全局按钮 hover transition；`717-728` thinking pulse；无 reduced-motion。 | 发送反馈由多处状态和分散动画叠加，按钮尺寸不稳定，且 active session 轮询/scroll 可能放大重渲染。 | 中高 | M5：motion tokens、固定 send button 尺寸、低成本 transform/opacity、reduced-motion、发送流程 E2E/截图。 |
| PC 窄宽度 Project/session 列表看不见 | `apps/web/src/main.tsx:77-99` 窄桌面 global rail 变 72px；`apps/web/src/styles.css:1171-1201` 隐藏 project/session 文本；`1248-1280` 只有 <=1100 才进入 mobile drawer。 | 1101-1540px 断点把导航过早压成图标栏，且桌面没有替代 drawer/label 展开。 | 高 | M4：重设 desktop-narrow 策略，保证 Project/session 入口可读或可一键展开；多视口截图验收。 |
| Subagent 识别不到，无法进入交互 | `packages/protocol/src/index.ts:69-72` 无结构化 Subagent block；`apps/server/src/codexDiscovery.ts:176-184` 和 `apps/server/src/codexEvents.ts:201-204` 只靠字符串启发；`apps/web/src/main.tsx:1171-1174` simple mode 过滤 tool message；`1457-1499` modal 只有文本详情。 | Subagent 是文本 notice，不是协议对象；默认展示模式会隐藏；没有交互动作模型。 | 高 | M6：结构化 Subagent trace，兼容旧文本；simple mode 下显示入口；可交互/不可交互状态明确。 |
| 502、429 等错误捕捉不到 | `apps/web/src/main.tsx:171-177` API 丢 HTTP status；`458-459` 等只存字符串；`721-733` action 无 catch；`apps/server/src/index.ts:86-92` 响应只有 `{error}`；`codex.ts:127` 丢 JSON-RPC code/data；没有 SSE onerror。 | 错误没有统一协议，也没有 retry policy、source、status、details redaction。UI 只能显示局部 inline error。 | 高 | M3：统一错误模型、底部错误卡片、重试卡片、429 冷却、502/SSE 重连、发送失败保留草稿。 |
| 前端动画不统一 | `apps/web/src/styles.css:14`、`107-113`、`717-728`、`796-817`、`1422-1424` 动效分散；未发现 `prefers-reduced-motion`。 | 没有 motion token 和组件状态规范，动画成本与语义不统一。 | 中 | M5：统一 duration/easing/token、reduced-motion，覆盖 send/panel/list/loading/error。 |

## M0 后补充 Plan 建议

- M1 仍然必须先做，但要明确“红灯测试允许存在”：先把当前 Bug 复现为 E2E/截图失败，再在 M2-M6 逐项转绿。
- M3 应新增安全验收：错误详情脱敏、HTTP status 保留、body size limit、CORS/host 风险记录。
- M4 和 M5 的文件重叠很高，建议在 M0 plan-review 时决定是否并行会冲突；保守做法是 M4 先定布局可达性，M5 再统一动效。
- M6 需要 protocol-first，不建议只调前端正则。

## 验收状态

- 根因矩阵已覆盖用户列出的 7 个 Bug。
- 当前只是根因解释和修复计划，不代表 Bug 已修复。
- 下一步必须进行 `/hw:plan:review` 或 `/hw:plan:extend`，再开始 M1/M2。

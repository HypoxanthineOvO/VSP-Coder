# M5 响应式与效果设计讨论草案

- 时间：2026-05-07T23:37:52+08:00
- 状态：M4.5 已完成后的 M5 讨论草案
- 前置审计：`.pipeline/audits/audit-002.md`
- M4.5 结果：`.pipeline/reports/M4.5-audit-debt-hardening.md`

## 已完成的 M5 前置修复门禁

在正式大改响应式布局前，已通过 M4.5 修掉：

1. optimistic message 生命周期收敛：clear queue 后取消/移除对应 optimistic；provider final 后确认/替换 optimistic。
2. error event 统一脱敏：Codex stderr/protocol/provider event 均走 AppError 安全摘要。
3. retry target 显式化：发送重试绑定 sessionId/text/tokens，非 send 操作不要假装重放。
4. SSE error dedupe/cooldown：重复断连只更新一张卡；429 按 cooldown 禁用按钮。
5. 旧 session detail error 不污染当前 session。

## 用户确认的 M5 体验方向

1. 按钮色调做亮一点，尤其是主操作、当前选中和可重试操作，需要比普通面板更容易被扫到。
2. 交互提示做明显一点：hover/focus/active/disabled/loading 都要能被肉眼区分，关键 icon button 需要 tooltip 或状态文案。
3. 移动端输入框进入对话时自动聚焦，尽量触发键盘；同时需要尊重用户刚关闭键盘或切换抽屉的场景，避免反复抢焦点。
4. 移动端和 PC 端长输入都要支持 composer 展开：短输入保持紧凑，长输入逐步增高，超过阈值后进入可滚动/展开模式。

## M5 要修复的响应式细节

### Desktop 窄宽度：1280-1440

- 当前三 rail + right panel 同时存在时，中间消息区容易被压缩。
- 建议策略：
  - `global-rail` 在 1540 以下只保留品牌、最近 session 入口和 project 图标/短名。
  - `session-rail` 保留当前 Project Session，但宽度限制在 220-260。
  - `right` 面板默认收窄为 tab rail + 可展开 panel，避免挤掉主 conversation。
  - resize handle 只允许在剩余主区不小于 520px 时继续拖动。

### Tablet：768-1024

- Project/session 入口应统一进可打开的 workbench drawer。
- 主屏优先级：
  1. mobile topbar
  2. session status/model dock
  3. message pane
  4. pending/error/queue dock
  5. composer
- 右侧 workflow/artifacts/settings 变成底部或抽屉 tab，不占常驻列。

### Mobile：390x844

- 顶部只显示当前 session、状态点、drawer 按钮、provider 状态。
- model/reasoning dock 保持一行，必要时第二行，不允许横向溢出。
- error dock 最多显示一张展开卡，其余折叠成计数。
- queue dock 只显示第一条和数量，避免压缩 composer。
- composer 固定底部，键盘打开时使用 `visualViewport` 变量避让。

## M5 效果与动效方向

这部分不做花哨动效，目标是“工作台稳、可预期、轻量”：

- Button tone：主按钮使用更亮的蓝绿/青色强调，danger/error retry 使用暖色但不占满界面；普通 icon button 保持低饱和背景，只在 hover/focus 时提亮。
- Interaction hints：所有可点击 icon button 增加清晰 hover/focus ring；active tab/card 用 border + 背景 + 左侧/顶部细强调线表达，不靠大面积同色块。
- Composer expand：textarea 使用 `min-height`、`max-height` 和内容高度同步；达到上限后内部滚动，提供展开/收起按钮。
- Mobile keyboard：使用 `visualViewport` 写入 CSS var，让 composer 避开软键盘；移动端自动 focus 只在首次进入可输入会话或发送后继续输入时触发。
- Drawer：160-200ms ease-out，从左侧滑入；背景 scrim 淡入 120ms。
- Rail collapse：宽度变化使用 CSS transition，但在用户拖拽 resize 时关闭 transition，避免跟手迟滞。
- Error/queue/pending dock：进入时轻微 translateY(6px) + opacity，120-160ms；更新内容不重新弹跳。
- Session card active 状态：只做 border/background 过渡，不做位移。
- Composer send：发送中仅按钮内 spinner/opacity，不移动整个 composer。
- 遵守 `prefers-reduced-motion`：关闭 transform 动画，只保留 opacity 或无动画。

## M5 测试建议

- 截图 smoke 扩展为 `responsive shell` 专用：
  - 1440x900、1280x800、1024x768、768x900、390x844。
  - 断言 Project/session 入口可见或 drawer 可一键打开。
  - 断言 composer、error dock、queue dock 不互相遮挡。
- 增加截图像素/布局检查：
  - `.message-pane` 宽度不低于阈值。
  - `.composer` 可见且 bottom 在 viewport 内。
  - 移动端 drawer 打开后有 Project/session 列表。

## 讨论问题

1. 1280 宽度时右侧 panel 默认保留窄栏，还是默认折叠成 tab rail？
2. 移动端 error dock 是优先显示在 composer 上方，还是进入 pending/error 统一 bottom sheet？
3. Composer 展开按钮放在输入框右上角，还是放在发送按钮旁边？
4. M5 先做按钮/提示的响应式可用性增强，M6 再统一完整 motion token 与发送性能动画，是否按这个边界推进？

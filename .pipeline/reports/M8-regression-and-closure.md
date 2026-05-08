# M8 全量回归、扩展性硬化与文档同步报告

- 时间：2026-05-08T00:32:39+08:00
- 状态：完成，release-ready
- Prompt：`.pipeline/prompts/08-regression-hardening-docs.md`
- 发布版本：`v0.3.0`

## 完成内容

1. 对照 M0 已知 Bug 根因矩阵、M0 补充审计和 M4.5 Subagent 审计逐项收口。
2. 更新中文 README、用户指南、开发者指南、API 参考和 CHANGELOG，覆盖消息恢复、错误卡、上次选中、Subagent trace、响应式行为、统一动效和 reduced-motion。
3. 版本号从 `0.2.1` 更新到 `0.3.0`，同步 root、workspace package 和 lockfile。
4. Playwright 全量回归改为单 worker，避免 Chromium 并发截图导致 `Page.captureScreenshot` 偶发 protocol error。
5. 执行 Hypo-Workflow sync repair/check，派生上下文状态为 `derived=fresh`。
6. 重新本地部署到 `http://127.0.0.1:4180`，切回 `codex` 数据模式并完成 health/state/models smoke。

## 已知 Bug 关闭表

| Bug | 状态 | 关闭证据 |
|---|---|---|
| 默认加载到很老的会话 | fixed | M3 持久化并恢复上次选中 project/session，E2E 覆盖 reload 恢复。 |
| reasoning/xhigh 切换慢且概率失败 | fixed | M3 增加切换 pending、失败回滚、provider capability 校验和错误卡；E2E 覆盖成功/失败/unsupported。 |
| 发送动画巨卡 | fixed | M6 统一 motion token、轻量发送状态、memo/message segmentation、reduced-motion；E2E 覆盖长输入和 reduced-motion。 |
| PC 窄宽 Project/Session 列表不可见 | fixed | M5 右侧栏收拢为 rail，移动端 drawer，1280 截图检查覆盖 composer/nav 可达。 |
| Subagent 识别不到、无法进入详情 | fixed | M7 协议级 `subagent_trace` block、simple mode 可见入口、详情弹窗和 E2E 覆盖。 |
| 502/429 等错误捕捉不到 | fixed | M4/M4.5 AppError、底部错误卡、retry target、429 cooldown、SSE 断连错误；E2E 覆盖。 |
| 前端动画不统一 | fixed | M6 motion token、按钮/错误卡/面板统一反馈、reduced-motion 降级。 |

## 补充审计关闭表

| 发现 | 状态 | 关闭证据 |
|---|---|---|
| provider refresh 丢 live-only messages | fixed | M2 `mergeProviderRefresh` 保留 live-only messages，单测覆盖。 |
| `/api/state` 旧快照覆盖新 live message | fixed | M2 前端 stale request guard 和 identity-first merge，E2E 覆盖。 |
| 按内容去重吞重复消息 | fixed | M2 改为 provider/client identity 合并，E2E 覆盖相同文本不同 provider item。 |
| 发送后缺少 optimistic user message | fixed | M2/M4.5 queue item 与 optimistic message 配对、失败保留 draft。 |
| 队列 sent/confirmed 生命周期不清 | fixed | M4.5 补齐 sent/confirmed convergence 和 retry target。 |
| refresh/SSE/轮询无顺序边界 | fixed | M2 请求 generation guard；M6 refresh Activity 降噪。 |
| 502/429/SSE/provider 错误不可见 | fixed | M4 AppError 与 ErrorDock；M7 SSE 持续断开延迟显示和恢复清理。 |
| 长会话渲染性能风险 | fixed | M6 memo、`content-visibility` 和长消息分段渲染。 |
| freshness/source metadata 不完整 | deferred | 当前已通过 identity 和 generation 解决用户可见吞消息问题；完整 provider freshness metadata 留到下一 Cycle 做跨 provider 扩展。 |

## M4.5 审计债务关闭表

| 发现 | 状态 | 关闭证据 |
|---|---|---|
| optimistic message 被误清理 | fixed | M4.5 保留 failed/pending outbound 并提供 retry target。 |
| 非 HTTP 错误未统一脱敏 | fixed | `AppError` 和 server error sanitizer 覆盖 runtime/provider 错误。 |
| stale profile 覆盖当前 profile | fixed | M3/M4.5 session merge 使用当前 provider profile。 |
| 旧 session 错误污染当前错误卡 | fixed | 错误 target/dedupe key 限定 session/action。 |
| SSE 断连重复刷卡 | fixed | M7 延迟确认和 onopen 清理。 |
| workflow refresh 初始 project 边界 | deferred | 当前主流程已有目标 project/session guard；更完整的 workflow adapter source metadata 留到下一 Cycle。 |

## 验证结果

```bash
npm run typecheck
npm run test
npm run e2e -- --project=chromium
npm run screenshots -- --project=chromium
npm run build
git diff --check
hypo-workflow sync --repair --platform opencode --project /home/heyx/VSP-Coder
hypo-workflow sync --check-only --platform opencode --project /home/heyx/VSP-Coder
npm run deploy:local -- --start-port=4180
curl -fsS http://127.0.0.1:4180/api/health
curl -fsS http://127.0.0.1:4180/api/state
curl -fsS http://127.0.0.1:4180/api/models
```

结果：

- Typecheck：通过。
- Unit tests：protocol 4 passed；server 61 passed；web typecheck passed。
- Chromium E2E：24 passed。
- Screenshot smoke：7 passed。
- Build：通过。
- Diff check：通过。
- Sync：repair/check 均为 `derived=fresh`。
- Deployment smoke：`http://127.0.0.1:4180/api/health` 返回 `dataMode=codex`、`deploymentMode=local`、`automationProfile=full_auto`。

## Release 状态

`v0.3.0` 已完成本地 release 准备、文档同步、回归验证和本地上线。当前未执行远端 `git push` 或 tag publish；仓库内仍保留本 Cycle 的未提交变更，适合先人工检查 diff 后再创建正式远端 release。

## 下一 Cycle 候选

1. 为跨 provider 引入正式 freshness/source metadata，而不只依赖当前 identity/generation guard。
2. 设计真实 Subagent 双向交互 adapter；当前 Codex 仅可只读展示 trace。
3. 将 Playwright 截图检查拆成独立稳定 CI job，避免和普通 E2E 共享浏览器资源。
4. 扩展 workflow adapter 的 project/source metadata，减少未来多项目面板边界风险。

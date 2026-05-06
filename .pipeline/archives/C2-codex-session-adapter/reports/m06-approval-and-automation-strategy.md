# M06 Approval And Automation Strategy

Status: manual validation

Updated: 2026-05-05 22:51 Asia/Shanghai

## Summary

M06 connects Codex server-initiated approval and input requests to VSP-Coder
RequestCards. The backend now distinguishes JSON-RPC responses from
server-to-client requests, maps supported Codex request methods to
provider-neutral cards, records pending request state, and returns Codex-shaped
responses when the frontend resolves a card.

## Implemented

- Added server-to-client JSON-RPC request handling in `LineJsonRpcClient`.
- Added `codexRequests` mapper for:
  - `item/commandExecution/requestApproval`
  - `item/fileChange/requestApproval`
  - `item/permissions/requestApproval`
  - `item/tool/requestUserInput`
  - `mcpServer/elicitation/request`
  - legacy `execCommandApproval`
  - legacy `applyPatchApproval`
- Routed frontend `card_action` decisions back through JSON-RPC responses.
- Added request-card statuses: `open`, `resolved`, `denied`, `failed`,
  `expired`.
- Added session cache updates so open cards appear in `/api/state` and active
  sessions.
- Added profile-specific Codex request params:
  - `thread/start`: `approvalPolicy`, `approvalsReviewer`, `sandbox`
  - `turn/start`: `approvalPolicy`, `approvalsReviewer`, `sandboxPolicy`
- Full-auto profile auto-resolves approval cards server-side; manual and
  workspace profiles surface frontend cards.
- Updated frontend card status labels and disabled resolved card actions.

## Validation

- `npm run typecheck` passed.
- `npm run build` passed.
- `npm test -w @vsp-coder/server` passed.
- `npm test` passed.
- Local server restarted safely on port 4180 with cwd/cmdline-checked process
  replacement only.
- Codex provider health is ready through `POST /api/providers/codex/start`.
- Post-QA fix: existing discovered threads are now resumed with `thread/resume`
  before `turn/start`; this fixes `thread not found` when sending to sessions
  that can be listed/read but are not loaded in the current app-server runtime.
- Post-QA fix: manual profile now uses Codex `approvalPolicy=untrusted`.
  `on-request` allowed sandbox-safe commands such as `pwd` to execute without a
  frontend approval card, which did not satisfy M06 manual-card validation.
- Post-QA observation: `pwd` is not a valid command-approval trigger even in
  manual mode, because Codex runs sandbox-safe read-only commands directly. Use
  a non-mutating sandbox escape probe such as reading a root-only path to trigger
  the approval request.

## Manual QA Needed

Use only a disposable tmp/test Codex thread before accepting M06.

1. Switch Settings automation profile to `manual`.
2. Create/select a disposable tmp project/session.
3. Send: `请运行 cat /root/definitely-not-readable-vsp-coder-m06；如果需要审批，请等待我在前端处理。不要修改任何文件。`
4. Confirm a pending command approval card appears after the sandboxed read
   fails and Codex asks to retry without sandbox.
5. Click approve and confirm the Codex turn continues.
6. Repeat with denial and confirm the card resolves as denied.
7. Switch automation profile back to `full_auto`.
8. Send a safe message and confirm no frontend approval card blocks normal
   operation.

## Notes

Permission denial uses a valid `PermissionsRequestApprovalResponse` with empty
permissions, `scope: "turn"`, and `strictAutoReview: true`, because the generated
Codex response schema does not expose a separate denial enum for permission
requests.

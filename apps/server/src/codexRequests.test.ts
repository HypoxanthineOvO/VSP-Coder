import assert from "node:assert/strict";
import test from "node:test";
import {
  autoResolutionFor,
  codexResponseForAction,
  mapCodexServerRequest,
  sandboxPolicy,
  shouldAutoResolveRequest,
  threadStartOverrides,
  turnStartOverrides
} from "./codexRequests.js";
import { automationProfiles } from "./store.js";

test("maps command approval requests into VSP approval cards", () => {
  const pending = mapCodexServerRequest({
    id: "req-1",
    method: "item/commandExecution/requestApproval",
    params: { threadId: "thread-1", turnId: "turn-1", itemId: "item-1", command: "npm test", cwd: "/tmp/vsp-coder-m06" }
  }, new Date("2026-05-05T00:00:00.000Z"));

  assert.equal(pending?.sessionId, "thread-1");
  assert.equal(pending?.card.kind, "approval");
  assert.equal(pending?.card.status, "open");
  assert.match(pending?.card.body || "", /npm test/);
  assert.deepEqual(codexResponseForAction(pending!, { actionId: "accept_session" }), {
    result: { decision: "acceptForSession" },
    status: "resolved",
    label: "本会话允许"
  });
  assert.deepEqual(codexResponseForAction(pending!, { actionId: "decline" }).result, { decision: "decline" });
});

test("maps legacy exec approval response shape", () => {
  const pending = mapCodexServerRequest({
    id: 7,
    method: "execCommandApproval",
    params: { conversationId: "thread-1", callId: "call-1", approvalId: null, command: ["npm", "test"], cwd: "/tmp", reason: null }
  });

  assert.equal(pending?.card.id, "codex-request-7");
  assert.deepEqual(codexResponseForAction(pending!, { actionId: "accept_session" }).result, { decision: "approved_for_session" });
  assert.deepEqual(codexResponseForAction(pending!, { actionId: "cancel" }).result, { decision: "abort" });
});

test("maps file change and permission approvals", () => {
  const file = mapCodexServerRequest({
    id: "file-1",
    method: "item/fileChange/requestApproval",
    params: { threadId: "thread-1", turnId: "turn-1", itemId: "item-1", reason: "write outside root", grantRoot: "/tmp/vsp" }
  });
  assert.match(file?.card.body || "", /\/tmp\/vsp/);
  assert.deepEqual(codexResponseForAction(file!, { actionId: "decline" }).result, { decision: "decline" });

  const permissions = mapCodexServerRequest({
    id: "perm-1",
    method: "item/permissions/requestApproval",
    params: {
      threadId: "thread-1",
      turnId: "turn-1",
      itemId: "item-1",
      cwd: "/tmp/vsp",
      reason: "network",
      permissions: { network: { enabled: true }, fileSystem: null }
    }
  });
  assert.deepEqual(codexResponseForAction(permissions!, { actionId: "grant_session" }).result, {
    permissions: { network: { enabled: true }, fileSystem: null },
    scope: "session"
  });
  assert.deepEqual(codexResponseForAction(permissions!, { actionId: "deny" }).result, {
    permissions: {},
    scope: "turn",
    strictAutoReview: true
  });
});

test("maps tool user input and MCP elicitation responses", () => {
  const input = mapCodexServerRequest({
    id: "input-1",
    method: "item/tool/requestUserInput",
    params: {
      threadId: "thread-1",
      turnId: "turn-1",
      itemId: "item-1",
      questions: [{ id: "scope", header: "Scope", question: "Pick scope", isOther: false, isSecret: false, options: [{ label: "Small", description: "" }] }]
    }
  });
  assert.equal(input?.card.kind, "user_input");
  assert.deepEqual(codexResponseForAction(input!, { actionId: "answer:Small" }).result, { answers: { scope: { answers: ["Small"] } } });

  const mcp = mapCodexServerRequest({
    id: "mcp-1",
    method: "mcpServer/elicitation/request",
    params: { threadId: "thread-1", turnId: null, serverName: "docs", mode: "url", message: "Open URL?", url: "https://example.com", elicitationId: "e1", _meta: null }
  });
  assert.match(mcp?.card.body || "", /https:\/\/example.com/);
  assert.deepEqual(codexResponseForAction(mcp!, { actionId: "decline" }).result, { action: "decline", content: null, _meta: null });
});

test("automation profiles select Codex request routing and sandbox payloads", () => {
  const fullAuto = automationProfiles.find((profile) => profile.id === "full_auto");
  const manual = automationProfiles.find((profile) => profile.id === "manual");
  const pending = mapCodexServerRequest({
    id: "req-1",
    method: "item/commandExecution/requestApproval",
    params: { threadId: "thread-1", turnId: "turn-1", itemId: "item-1", command: "date" }
  })!;

  assert.equal(shouldAutoResolveRequest(pending, fullAuto), true);
  assert.equal(shouldAutoResolveRequest(pending, manual), false);
  assert.deepEqual(autoResolutionFor(pending)?.result, { decision: "acceptForSession" });
  assert.deepEqual(threadStartOverrides(manual), { approvalPolicy: "untrusted", approvalsReviewer: "user", sandbox: "workspace-write" });
  assert.deepEqual(turnStartOverrides(manual, "/tmp/vsp").sandboxPolicy, {
    type: "workspaceWrite",
    writableRoots: ["/tmp/vsp"],
    networkAccess: true,
    excludeTmpdirEnvVar: false,
    excludeSlashTmp: false
  });
  assert.deepEqual(sandboxPolicy("danger-full-access", undefined), { type: "dangerFullAccess" });
});

import assert from "node:assert/strict";
import test from "node:test";
import type { Session } from "@vsp-coder/protocol";
import { mergeProviderRefresh } from "./codexSessionMerge.js";

const session = (overrides: Partial<Session> = {}): Session => ({
  id: "thread-1",
  projectId: "project-1",
  provider: "codex",
  title: "Local title",
  status: "idle",
  model: "codex-default",
  reasoning: "xhigh",
  cwd: "/tmp/vsp",
  runnerOwner: "codex-app-server",
  automationProfile: "manual",
  sandbox: "workspace-write",
  approvalPolicy: "untrusted",
  queue: [],
  messages: [],
  cards: [],
  artifacts: [],
  metric: {
    inputTokens: 0,
    outputTokens: 0,
    costUsdEstimate: 0,
    updatedAt: "2026-05-05T00:00:00.000Z"
  },
  createdAt: "2026-05-05T00:00:00.000Z",
  updatedAt: "2026-05-05T00:00:00.000Z",
  ...overrides
});

test("mergeProviderRefresh lets Codex canonical title win over local metadata", () => {
  const merged = mergeProviderRefresh(
    session({ title: "Local temporary title", queue: [{ id: "q1", text: "pending", tokens: [], createdAt: "2026-05-05T00:00:01.000Z", state: "pending" }] }),
    session({ title: "Canonical Codex title", messages: [{ id: "m1", sessionId: "thread-1", role: "assistant", createdAt: "2026-05-05T00:00:02.000Z", blocks: [{ type: "text", text: "ok" }] }] })
  );

  assert.equal(merged.title, "Canonical Codex title");
  assert.equal(merged.queue.length, 1);
  assert.equal(merged.messages.length, 1);
});

test("mergeProviderRefresh lets current provider profile replace stale session profile", () => {
  const merged = mergeProviderRefresh(
    session({ automationProfile: "manual", sandbox: "workspace-write", approvalPolicy: "untrusted" }),
    session({ automationProfile: "full_auto", sandbox: "danger-full-access", approvalPolicy: "never" })
  );

  assert.equal(merged.automationProfile, "full_auto");
  assert.equal(merged.sandbox, "danger-full-access");
  assert.equal(merged.approvalPolicy, "never");
});

test("mergeProviderRefresh preserves live-only messages during provider refresh", () => {
  const liveOnly = {
    id: "live-1",
    sessionId: "thread-1",
    role: "assistant" as const,
    providerItemRef: "live-1",
    createdAt: "2026-05-05T00:00:01.000Z",
    blocks: [{ type: "text" as const, text: "streaming response" }]
  };
  const merged = mergeProviderRefresh(
    session({ status: "running", currentTurnId: "turn-1", messages: [liveOnly] }),
    session({ status: "running", currentTurnId: "turn-1", messages: [] })
  );

  assert.deepEqual(merged.messages.map((message) => message.id), ["live-1"]);
});

test("mergeProviderRefresh does not content-dedupe distinct provider messages", () => {
  const merged = mergeProviderRefresh(
    session({
      messages: [{
        id: "u-1",
        sessionId: "thread-1",
        role: "user",
        providerItemRef: "u-1",
        createdAt: "2026-05-05T00:00:01.000Z",
        blocks: [{ type: "text", text: "继续" }]
      }]
    }),
    session({
      messages: [{
        id: "u-2",
        sessionId: "thread-1",
        role: "user",
        providerItemRef: "u-2",
        createdAt: "2026-05-05T00:00:02.000Z",
        blocks: [{ type: "text", text: "继续" }]
      }]
    })
  );

  assert.deepEqual(merged.messages.map((message) => message.id), ["u-2", "u-1"]);
});

test("mergeProviderRefresh replaces matching optimistic outbound with provider final message", () => {
  const merged = mergeProviderRefresh(
    session({
      messages: [{
        id: "queue-1",
        sessionId: "thread-1",
        role: "user",
        providerItemRef: "queue-1",
        clientMutationId: "queue-1",
        deliveryState: "sent",
        createdAt: "2026-05-05T00:00:01.000Z",
        blocks: [{ type: "text", text: "queued text" }]
      }]
    }),
    session({
      messages: [{
        id: "provider-user-1",
        sessionId: "thread-1",
        role: "user",
        providerItemRef: "provider-user-1",
        createdAt: "2026-05-05T00:00:02.000Z",
        blocks: [{ type: "text", text: "queued text" }]
      }]
    })
  );

  assert.deepEqual(merged.messages.map((message) => message.id), ["provider-user-1"]);
  assert.equal(merged.messages[0].clientMutationId, "queue-1");
  assert.equal(merged.messages[0].deliveryState, "confirmed");
});

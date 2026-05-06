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

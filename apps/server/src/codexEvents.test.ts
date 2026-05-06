import test from "node:test";
import assert from "node:assert/strict";
import { mapCodexNotification } from "./codexEvents.js";

test("maps assistant deltas into provider-neutral live message patches", () => {
  const [mapped] = mapCodexNotification({
    method: "item/agentMessage/delta",
    params: { threadId: "thread-1", turnId: "turn-1", itemId: "item-1", delta: "hello" }
  });
  assert.equal(mapped.sessionId, "thread-1");
  assert.equal(mapped.persistent, false);
  assert.equal(mapped.event.type, "message_added");
  assert.deepEqual(mapped.patch?.messageDelta, {
    id: "item-1",
    role: "assistant",
    text: "hello",
    providerItemRef: "item-1"
  });
});

test("maps completed Codex items into finalized VSP messages", () => {
  const [mapped] = mapCodexNotification({
    method: "item/completed",
    params: {
      threadId: "thread-1",
      turnId: "turn-1",
      item: { type: "agentMessage", id: "item-1", text: "final", phase: null, memoryCitation: null }
    }
  }, new Date("2026-05-05T00:00:00Z"));
  assert.equal(mapped.event.type, "message_added");
  assert.equal(mapped.patch?.finalMessages?.[0]?.blocks[0]?.type, "text");
  assert.equal(mapped.patch?.finalMessages?.[0]?.providerItemRef, "item-1");
  assert.deepEqual(mapped.patch?.finalMessages?.[0]?.blocks, [{ type: "text", text: "final" }]);
});

test("maps turn lifecycle notifications into status patches", () => {
  const [started] = mapCodexNotification({
    method: "turn/started",
    params: { threadId: "thread-1", turn: { id: "turn-1", status: "inProgress", startedAt: 1777777777 } }
  });
  assert.equal(started.patch?.status, "running");
  assert.equal(started.patch?.currentTurnId, "turn-1");

  const [completed] = mapCodexNotification({
    method: "turn/completed",
    params: { threadId: "thread-1", turn: { id: "turn-1", status: "completed", durationMs: 1234, completedAt: 1777777788 } }
  });
  assert.equal(completed.patch?.status, "idle");
  assert.equal(completed.patch?.currentTurnId, null);
  assert.equal(completed.patch?.metric?.durationMs, 1234);
});

test("maps token usage and rate limits into metric events", () => {
  const [usage] = mapCodexNotification({
    method: "thread/tokenUsage/updated",
    params: {
      threadId: "thread-1",
      turnId: "turn-1",
      tokenUsage: {
        total: { inputTokens: 11, outputTokens: 7, totalTokens: 18 },
        modelContextWindow: 200000
      }
    }
  });
  assert.equal(usage.event.type, "metric_updated");
  assert.equal(usage.patch?.metric?.inputTokens, 11);
  assert.equal(usage.patch?.metric?.outputTokens, 7);
  assert.equal(usage.patch?.metric?.contextWindow, 200000);

  const [limit] = mapCodexNotification({
    method: "account/rateLimits/updated",
    params: {
      rateLimits: {
        limitName: "primary",
        primary: { usedPercent: 50, resetsAt: 1777777799 },
        secondary: { usedPercent: 20 },
        credits: { balance: "10.00" }
      }
    }
  });
  assert.equal(limit.event.type, "rate_limit_updated");
  assert.equal((limit.event.payload as { rateLimits: { primaryUsedPercent: number } }).rateLimits.primaryUsedPercent, 50);
});

test("maps Codex thread name updates into canonical title patch", () => {
  const [mapped] = mapCodexNotification({
    method: "thread/name/updated",
    params: { threadId: "thread-1", threadName: "Canonical name" }
  });
  assert.equal(mapped.sessionId, "thread-1");
  assert.equal(mapped.event.type, "session_updated");
  assert.equal(mapped.patch?.title, "Canonical name");
  assert.equal(mapped.refreshSession, true);
});

test("maps warnings and errors into user-facing events", () => {
  const [warning] = mapCodexNotification({
    method: "warning",
    params: { threadId: "thread-1", message: "Heads up" }
  });
  assert.equal(warning.event.type, "warning");
  assert.equal(warning.event.message, "Heads up");

  const [error] = mapCodexNotification({
    method: "error",
    params: { threadId: "thread-1", error: { message: "Nope" }, willRetry: true }
  });
  assert.equal(error.event.type, "error");
  assert.equal(error.event.message, "Nope");
});

test("suppresses known non-blocking warning spam", () => {
  const mapped = mapCodexNotification({
    method: "warning",
    params: { message: "failed to warm featured plugin ids cache error=network" }
  });
  assert.equal(mapped.length, 0);
});

test("maps subagent-like notifications into trace tool messages", () => {
  const [mapped] = mapCodexNotification({
    method: "subagent/status",
    params: {
      threadId: "thread-1",
      turnId: "turn-1",
      agentType: "explorer",
      agentId: "agent-1",
      status: "running",
      summary: "Scanning files"
    }
  });
  assert.equal(mapped.sessionId, "thread-1");
  assert.equal(mapped.event.type, "session_updated");
  assert.equal(mapped.patch?.messageDelta?.role, "tool");
  assert.match(mapped.patch?.messageDelta?.text || "", /Subagent trace: running/);
  assert.match(mapped.patch?.messageDelta?.text || "", /agent: agent-1/);
});

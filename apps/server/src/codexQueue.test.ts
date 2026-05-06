import test from "node:test";
import assert from "node:assert/strict";
import type { Session } from "@vsp-coder/protocol";
import {
  clearPendingQueue,
  codexSessionIsBusy,
  enqueuePendingMessage,
  markActiveSessionUnavailable,
  markQueueItemPending,
  markQueueItemSent,
  nextPendingQueueItem
} from "./codexQueue.js";

const baseSession = (overrides: Partial<Session> = {}): Session => ({
  id: "thread-1",
  projectId: "project-1",
  provider: "codex",
  title: "Thread",
  status: "idle",
  model: "codex-default",
  reasoning: "xhigh",
  cwd: "/tmp/vsp-coder-test",
  runnerOwner: "codex-app-server",
  automationProfile: "manual",
  sandbox: "workspace-write",
  approvalPolicy: "untrusted",
  currentTurnId: undefined,
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

test("detects active Codex turns as busy", () => {
  assert.equal(codexSessionIsBusy(baseSession()), false);
  assert.equal(codexSessionIsBusy(baseSession({ status: "running" })), true);
  assert.equal(codexSessionIsBusy(baseSession({ status: "waiting_approval" })), true);
  assert.equal(codexSessionIsBusy(baseSession({ currentTurnId: "turn-1" })), true);
});

test("enqueues outbound messages without marking them sent", () => {
  const queued = enqueuePendingMessage(baseSession({ status: "running", currentTurnId: "turn-1" }), "second");
  assert.equal(queued.status, "running");
  assert.equal(queued.queue.length, 1);
  assert.equal(queued.queue[0].text, "second");
  assert.equal(queued.queue[0].state, "pending");
  assert.equal(nextPendingQueueItem(queued)?.id, queued.queue[0].id);
});

test("clearPendingQueue only clears pending VSP queue items", () => {
  const session = baseSession({
    queue: [
      { id: "q1", text: "active already sent", tokens: [], createdAt: "2026-05-05T00:00:00.000Z", state: "sent" },
      { id: "q2", text: "pending", tokens: [], createdAt: "2026-05-05T00:00:01.000Z", state: "pending" },
      { id: "q3", text: "old cleared", tokens: [], createdAt: "2026-05-05T00:00:02.000Z", state: "cleared" }
    ],
    currentTurnId: "turn-1",
    status: "running"
  });
  const { session: cleared, cleared: count } = clearPendingQueue(session);
  assert.equal(count, 1);
  assert.deepEqual(cleared.queue.map((item) => item.state), ["sent", "cleared", "cleared"]);
  assert.equal(cleared.currentTurnId, "turn-1");
  assert.equal(cleared.status, "running");
});

test("marks queued item as sent before draining to Codex turn/start", () => {
  const queued = enqueuePendingMessage(baseSession(), "next");
  const sent = markQueueItemSent(queued, queued.queue[0].id);
  assert.equal(sent.queue[0].state, "sent");
  const pending = markQueueItemPending(sent, sent.queue[0].id);
  assert.equal(pending.queue[0].state, "pending");
});

test("app-server loss marks active sessions failed without clearing pending queue", () => {
  const unavailable = markActiveSessionUnavailable(baseSession({
    status: "waiting_approval",
    currentTurnId: "turn-1",
    queue: [{ id: "q1", text: "next", tokens: [], createdAt: "2026-05-05T00:00:01.000Z", state: "pending" }],
    cards: [{
      id: "card-1",
      sessionId: "thread-1",
      kind: "approval",
      title: "Approval",
      body: "body",
      actions: [],
      status: "open",
      createdAt: "2026-05-05T00:00:02.000Z"
    }]
  }));
  assert.equal(unavailable.status, "error");
  assert.equal(unavailable.currentTurnId, undefined);
  assert.equal(unavailable.queue[0].state, "pending");
  assert.equal(unavailable.cards[0].status, "failed");
});

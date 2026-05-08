import { expect, test } from "@playwright/test";
import type { Message, Session, VspState } from "@vsp-coder/protocol";
import { mergeProviderRefresh } from "../apps/server/src/codexSessionMerge";
import { clearPendingQueue, enqueuePendingMessage, markQueueItemSent } from "../apps/server/src/codexQueue";
import { mergeStatePreservingDetails, patchSession } from "../apps/web/src/sessionMerge";

const at = "2026-05-07T00:00:00.000Z";

function message(id: string, sessionId: string, role: Message["role"], text: string): Message {
  return {
    id,
    sessionId,
    role,
    createdAt: at,
    providerItemRef: id,
    blocks: [{ type: "text", text }]
  };
}

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: "thread-1",
    projectId: "project-1",
    provider: "codex",
    title: "Thread",
    status: "idle",
    model: "codex-default",
    reasoning: "xhigh",
    cwd: "/tmp/vsp",
    runnerOwner: "codex-app-server",
    automationProfile: "full_auto",
    sandbox: "danger-full-access",
    approvalPolicy: "never",
    queue: [],
    messages: [],
    cards: [],
    artifacts: [],
    metric: {
      inputTokens: 0,
      outputTokens: 0,
      costUsdEstimate: 0,
      updatedAt: at
    },
    createdAt: at,
    updatedAt: at,
    ...overrides
  };
}

function state(current: Session): VspState {
  return {
    config: {
      deploymentMode: "local",
      dataMode: "codex",
      automationProfile: "full_auto",
      profiles: [],
      configPath: ".vsp-coder/config.json",
      updatedAt: at
    },
    projects: [{ id: "project-1", name: "Project", path: "/tmp/vsp", color: "#65d6ff", status: "active" }],
    sessions: [current],
    events: [],
    qaRuns: []
  };
}

test.describe("message lifecycle cache consistency", () => {
  test("server refresh should preserve previous live-only messages until provider confirms them", () => {
    const liveOnly = message("live-1", "thread-1", "assistant", "streaming response");
    const merged = mergeProviderRefresh(
      session({ messages: [liveOnly], status: "running", currentTurnId: "turn-1" }),
      session({ messages: [], status: "running", currentTurnId: "turn-1" })
    );

    expect(merged.messages.map((item) => item.id)).toContain("live-1");
  });

  test("frontend state refresh should not overwrite newer live messages with stale nonempty state", () => {
    const newer = session({ messages: [message("m-live", "thread-1", "assistant", "new live text")] });
    const stale = session({ messages: [message("m-old", "thread-1", "assistant", "old cached text")] });

    const merged = mergeStatePreservingDetails(state(newer), state(stale));

    expect(merged.sessions[0]?.messages.map((item) => item.id)).toContain("m-live");
  });

  test("same-role same-text messages from different provider items should both survive final merge", () => {
    const base = session({ messages: [message("u-1", "thread-1", "user", "继续")] });
    const patched = patchSession(base, {
      kind: "live_session_patch",
      finalMessages: [message("u-2", "thread-1", "user", "继续")]
    });

    expect(patched.messages.filter((item) => item.role === "user" && item.blocks[0]?.type === "text").map((item) => item.id)).toEqual(["u-1", "u-2"]);
  });

  test("busy queue pending outbound should have a paired visible optimistic message", () => {
    const queued = enqueuePendingMessage(session({ status: "running", currentTurnId: "turn-1" }), "queued text");

    expect(queued.messages.some((item) => item.role === "user" && item.blocks.some((block) => block.type === "text" && block.text === "queued text"))).toBe(true);
  });

  test("clearing queue should remove pending optimistic outbound message", () => {
    const queued = enqueuePendingMessage(session({ status: "running", currentTurnId: "turn-1" }), "queued text");
    const cleared = clearPendingQueue(queued).session;

    expect(cleared.messages.some((item) => item.clientMutationId === queued.queue[0]?.id)).toBe(false);
  });

  test("provider final user message should confirm matching optimistic outbound", () => {
    const pending = enqueuePendingMessage(session(), "queued text");
    const queueId = pending.queue[0]?.id || "";
    const queued = markQueueItemSent(pending, queueId);
    const patched = patchSession(queued, {
      kind: "live_session_patch",
      finalMessages: [message("provider-user", "thread-1", "user", "queued text")]
    });

    expect(patched.messages.map((item) => item.id)).toEqual(["provider-user"]);
    expect(patched.messages[0]?.clientMutationId).toBe(queueId);
    expect(patched.messages[0]?.deliveryState).toBe("confirmed");
  });
});

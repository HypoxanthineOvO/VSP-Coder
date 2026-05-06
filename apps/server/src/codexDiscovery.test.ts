import assert from "node:assert/strict";
import test from "node:test";
import { mapThreadsToVsp, messagesFromTurns, type CodexThread } from "./codexDiscovery.js";

const baseThread: CodexThread = {
  id: "thread-1",
  preview: "Fix the widget",
  modelProvider: "openai",
  createdAt: 1_700_000_000,
  updatedAt: 1_700_000_100,
  status: "idle",
  path: null,
  cwd: "/tmp/vsp-a",
  cliVersion: "0.128.0",
  name: null
};

test("mapThreadsToVsp aggregates projects from cwd", () => {
  const snapshot = mapThreadsToVsp([
    baseThread,
    { ...baseThread, id: "thread-2", cwd: "/tmp/vsp-a", name: "Named" },
    { ...baseThread, id: "thread-3", cwd: "/tmp/vsp-b" }
  ]);
  assert.equal(snapshot.projects.length, 2);
  assert.equal(snapshot.sessions.length, 3);
  assert.equal(snapshot.sessions[1]?.title, "Named");
  assert.equal(snapshot.sessions[0]?.projectId, snapshot.sessions[1]?.projectId);
});

test("mapThreadsToVsp ignores threads without cwd", () => {
  const snapshot = mapThreadsToVsp([{ ...baseThread, cwd: "" }]);
  assert.equal(snapshot.projects.length, 0);
  assert.equal(snapshot.sessions.length, 0);
});

test("messagesFromTurns maps Codex thread items into VSP messages", () => {
  const messages = messagesFromTurns("thread-1", [
    {
      id: "turn-1",
      status: "completed",
      startedAt: 1_700_000_000,
      completedAt: 1_700_000_010,
      durationMs: 10_000,
      items: [
        { type: "userMessage", id: "item-user", content: [{ type: "text", text: "hello" }] },
        { type: "agentMessage", id: "item-agent", text: "hi there" },
        { type: "commandExecution", id: "item-cmd", command: "npm test", aggregatedOutput: "ok", status: "completed" },
        { type: "subagent", id: "item-subagent", agentName: "worker", status: "completed", summary: "done" }
      ]
    }
  ]);
  assert.deepEqual(messages.map((message) => message.role), ["user", "assistant", "tool", "tool"]);
  assert.equal(messages[1]?.blocks[0]?.type, "text");
  assert.match(messages[3]?.blocks[0]?.type === "text" ? messages[3].blocks[0].text : "", /Subagent trace/);
});

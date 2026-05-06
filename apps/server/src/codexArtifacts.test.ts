import assert from "node:assert/strict";
import test from "node:test";
import { artifactUpdatesFromNotification, artifactsFromCodexItem, mergeArtifactUpdates } from "./codexArtifacts.js";

test("maps completed command execution into a command artifact", () => {
  const artifacts = artifactsFromCodexItem("thread-1", {
    type: "commandExecution",
    id: "cmd-1",
    command: "npm test",
    cwd: "/tmp/project",
    status: "completed",
    aggregatedOutput: "ok",
    exitCode: 0,
    durationMs: 42
  });

  assert.equal(artifacts.length, 1);
  assert.equal(artifacts[0]?.kind, "command");
  assert.equal(artifacts[0]?.status, "completed");
  assert.match(artifacts[0]?.body || "", /npm test/);
  assert.match(artifacts[0]?.body || "", /ok/);
});

test("maps file changes into diff artifacts", () => {
  const artifacts = artifactsFromCodexItem("thread-1", {
    type: "fileChange",
    id: "patch-1",
    status: "completed",
    changes: [{ path: "src/app.ts", kind: "update", diff: "@@\\n-old\\n+new" }]
  });

  assert.equal(artifacts.length, 2);
  assert.equal(artifacts[0]?.kind, "diff");
  assert.equal(artifacts[0]?.path, "src/app.ts");
  assert.match(artifacts[0]?.body || "", /new/);
  assert.equal(artifacts[1]?.status, "completed");
});

test("appends live command output deltas", () => {
  const updates = artifactUpdatesFromNotification("item/commandExecution/outputDelta", {
    threadId: "thread-1",
    turnId: "turn-1",
    itemId: "cmd-1",
    delta: "hello"
  });
  const merged = mergeArtifactUpdates([], updates);
  const next = mergeArtifactUpdates(merged, artifactUpdatesFromNotification("item/commandExecution/outputDelta", {
    threadId: "thread-1",
    turnId: "turn-1",
    itemId: "cmd-1",
    delta: " world"
  }));

  assert.equal(next[0]?.body, "hello world");
  assert.equal(next[0]?.status, "running");
});

test("preserves file change output body when completion updates status", () => {
  const existing = mergeArtifactUpdates([], artifactUpdatesFromNotification("item/fileChange/outputDelta", {
    threadId: "thread-1",
    turnId: "turn-1",
    itemId: "patch-1",
    delta: "Success"
  }));
  const next = mergeArtifactUpdates(existing, artifactsFromCodexItem("thread-1", {
    type: "fileChange",
    id: "patch-1",
    status: "completed",
    changes: []
  }));

  assert.equal(next.find((artifact) => artifact.id.endsWith(":file-output"))?.body, "Success");
  assert.equal(next.find((artifact) => artifact.id.endsWith(":file-output"))?.status, "completed");
});

test("maps patch updated notifications into diff artifacts", () => {
  const artifacts = artifactUpdatesFromNotification("item/fileChange/patchUpdated", {
    threadId: "thread-1",
    turnId: "turn-1",
    itemId: "patch-1",
    changes: [{ path: "README.md", kind: "add", diff: "+hello" }]
  });

  assert.equal(artifacts[0]?.kind, "diff");
  assert.equal(artifacts[0]?.path, "README.md");
});

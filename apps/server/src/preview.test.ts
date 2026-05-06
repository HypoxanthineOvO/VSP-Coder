import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { Artifact, Session } from "@vsp-coder/protocol";
import { previewArtifact, resolveArtifactPath } from "./preview.js";

function session(cwd: string): Session {
  return {
    id: "thread-1",
    projectId: "project-1",
    provider: "codex",
    title: "Preview test",
    status: "idle",
    model: "codex-default",
    reasoning: "xhigh",
    cwd,
    runnerOwner: "test",
    queue: [],
    messages: [],
    cards: [],
    artifacts: [],
    metric: { inputTokens: 0, outputTokens: 0, costUsdEstimate: 0, updatedAt: new Date().toISOString() },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

test("resolveArtifactPath keeps preview reads inside the project root", () => {
  const root = mkdtempSync(join(tmpdir(), "vsp-preview-"));
  mkdirSync(join(root, "src"));
  assert.equal(resolveArtifactPath(root, "src/app.ts"), join(root, "src/app.ts"));
  assert.throws(() => resolveArtifactPath(root, "../outside.txt"), /escapes/);
});

test("previewArtifact returns inline artifact bodies before reading files", () => {
  const root = mkdtempSync(join(tmpdir(), "vsp-preview-"));
  const artifact: Artifact = {
    id: "artifact-1",
    sessionId: "thread-1",
    kind: "diff",
    title: "Diff",
    body: "+hello",
    previewStatus: "renderable"
  };

  assert.equal(previewArtifact(session(root), artifact).body, "+hello");
});

test("previewArtifact reads small text files inside the session cwd", () => {
  const root = mkdtempSync(join(tmpdir(), "vsp-preview-"));
  writeFileSync(join(root, "README.md"), "# hello", "utf8");
  const artifact: Artifact = {
    id: "artifact-1",
    sessionId: "thread-1",
    kind: "file",
    title: "README",
    path: "README.md",
    mime: "text/markdown",
    previewStatus: "renderable"
  };

  assert.equal(previewArtifact(session(root), artifact).body, "# hello");
});

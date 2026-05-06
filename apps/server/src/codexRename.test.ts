import assert from "node:assert/strict";
import test from "node:test";
import { normalizeThreadName, setCodexThreadName, type CodexRenameClient } from "./codexRename.js";

test("setCodexThreadName routes to Codex thread/name/set with canonical params", async () => {
  const calls: Array<{ method: string; params: unknown; timeoutMs?: number }> = [];
  const client: CodexRenameClient = {
    async request<T = unknown>(method: string, params?: unknown, timeoutMs?: number) {
      calls.push({ method, params, timeoutMs });
      return {} as T;
    }
  };

  const name = await setCodexThreadName(client, "thread-1", "  M09 rename smoke  ");

  assert.equal(name, "M09 rename smoke");
  assert.deepEqual(calls, [{
    method: "thread/name/set",
    params: { threadId: "thread-1", name: "M09 rename smoke" },
    timeoutMs: 10_000
  }]);
});

test("setCodexThreadName rejects empty canonical names", async () => {
  const client: CodexRenameClient = {
    async request<T = unknown>() {
      throw new Error("must not call Codex");
    }
  };

  await assert.rejects(() => setCodexThreadName(client, "thread-1", "  "), /Rename title is required/);
  assert.equal(normalizeThreadName("  kept  "), "kept");
});

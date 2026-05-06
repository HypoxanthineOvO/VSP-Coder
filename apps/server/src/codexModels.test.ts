import assert from "node:assert/strict";
import test from "node:test";
import { fallbackCodexModelOptions, listCodexModelOptions, type CodexModelListClient } from "./codexModels.js";

test("listCodexModelOptions maps Codex model/list response into Codex-only options", async () => {
  const client: CodexModelListClient = {
    async request<T = unknown>(method: string, params?: unknown, timeoutMs?: number) {
      assert.equal(method, "model/list");
      assert.deepEqual(params, { includeHidden: false });
      assert.equal(timeoutMs, 10_000);
      return {
        data: [
          { model: "gpt-5.5", displayName: "GPT-5.5", hidden: false, supportedReasoningEfforts: [{ reasoningEffort: "xhigh" }, { reasoningEffort: "high" }] },
          { model: "hidden", displayName: "Hidden", hidden: true, supportedReasoningEfforts: [{ reasoningEffort: "medium" }] }
        ]
      } as T;
    }
  };

  const options = await listCodexModelOptions(client);

  assert.deepEqual(options.map((item) => item.model), ["gpt-5.5"]);
  assert.deepEqual(options[0]?.reasoning, ["xhigh", "high"]);
  assert.equal(options[0]?.provider, "codex");
});

test("fallbackCodexModelOptions covers expected C2 Codex model pool", () => {
  assert.deepEqual(fallbackCodexModelOptions().map((item) => item.model), [
    "gpt-5.5",
    "gpt-5.4",
    "gpt-5.3-codex",
    "gpt-5.2",
    "gpt-5.4-mini"
  ]);
});

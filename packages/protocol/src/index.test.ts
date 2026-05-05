import assert from "node:assert/strict";
import test from "node:test";
import { textMessage, type StructuredToken } from "./index.js";

test("textMessage creates a serializable message", () => {
  const message = textMessage("s1", "user", "hello", "m1", "2026-05-04T00:00:00.000Z");
  assert.equal(message.blocks[0]?.type, "text");
  assert.equal(JSON.parse(JSON.stringify(message)).sessionId, "s1");
});

test("structured token metadata survives JSON roundtrip", () => {
  const token: StructuredToken = {
    id: "tok-1",
    kind: "skill",
    label: "$hypo-workflow:plan",
    value: "hypo-workflow:plan",
    path: "/home/heyx/.codex/skills/hypo-workflow/skills/plan/SKILL.md",
    risk: "confirm"
  };
  const parsed = JSON.parse(JSON.stringify(token)) as StructuredToken;
  assert.equal(parsed.kind, "skill");
  assert.equal(parsed.path?.endsWith("SKILL.md"), true);
});

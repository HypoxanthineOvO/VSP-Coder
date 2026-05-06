import assert from "node:assert/strict";
import test from "node:test";
import { textMessage, type AppConfig, type StructuredToken } from "./index.js";

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
    path: ".codex/skills/hypo-workflow/skills/plan/SKILL.md",
    risk: "confirm"
  };
  const parsed = JSON.parse(JSON.stringify(token)) as StructuredToken;
  assert.equal(parsed.kind, "skill");
  assert.equal(parsed.path?.endsWith("SKILL.md"), true);
});

test("app config exposes deployment and automation profile state", () => {
  const config: AppConfig = {
    deploymentMode: "local",
    dataMode: "codex",
    automationProfile: "full_auto",
    configPath: ".vsp-coder/config.json",
    updatedAt: "2026-05-05T00:00:00.000Z",
    profiles: [
      {
        id: "full_auto",
        label: "全自动",
        description: "本地全自动运行",
        approvalPolicy: "never",
        sandbox: "danger-full-access",
        approvalsReviewer: "user"
      }
    ]
  };
  assert.equal(config.profiles[0]?.sandbox, "danger-full-access");
});

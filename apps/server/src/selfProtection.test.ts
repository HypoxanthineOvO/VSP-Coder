import assert from "node:assert/strict";
import test from "node:test";
import type { AutomationProfile } from "@vsp-coder/protocol";
import { profileForCwd, selfProtectionOverrides } from "./selfProtection.js";

const fullAuto: AutomationProfile = {
  id: "full_auto",
  label: "全自动",
  description: "",
  approvalPolicy: "never",
  sandbox: "danger-full-access",
  approvalsReviewer: "user"
};

test("profileForCwd downgrades full_auto sandbox only for the VSP server root", () => {
  assert.equal(profileForCwd(fullAuto, "/tmp/vsp", "/tmp/vsp")?.sandbox, "workspace-write");
  assert.equal(profileForCwd(fullAuto, "/tmp/other", "/tmp/vsp")?.sandbox, "danger-full-access");
});

test("selfProtectionOverrides adds runtime-derived server guard instructions", () => {
  const guarded = selfProtectionOverrides("/tmp/vsp", "/tmp/vsp", 4180);
  assert.match(String(guarded.developerInstructions), /port 4180/);
  assert.deepEqual(selfProtectionOverrides("/tmp/other", "/tmp/vsp", 4180), {});
});

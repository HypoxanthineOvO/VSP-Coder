import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { automationProfiles, MockStore, projectRoot, safeJoin } from "./store.js";

test("safeJoin allows project-relative paths", () => {
  assert.ok(safeJoin("/tmp/project", ".pipeline/config.yaml").endsWith("/tmp/project/.pipeline/config.yaml"));
});

test("safeJoin rejects path traversal", () => {
  assert.throws(() => safeJoin("/tmp/project", "../secret"), /escapes/);
});

test("safeJoin rejects absolute paths", () => {
  assert.throws(() => safeJoin("/tmp/project", "/etc/passwd"), /Invalid/);
});

test("profile defaults include local full automation with danger-full-access", () => {
  new MockStore().updateConfig({ deploymentMode: "local", dataMode: "codex", automationProfile: "full_auto" });
  const store = new MockStore();
  const config = store.getConfig();
  assert.equal(config.deploymentMode, "local");
  const fullAuto = config.profiles.find((profile) => profile.id === "full_auto");
  assert.equal(fullAuto?.approvalPolicy, "never");
  assert.equal(fullAuto?.sandbox, "danger-full-access");
});

test("local config forces full automation and preserves dev-test visibility", () => {
  new MockStore().updateConfig({ deploymentMode: "local", dataMode: "codex", automationProfile: "full_auto" });
  const store = new MockStore();
  const config = store.updateConfig({ automationProfile: "manual", dataMode: "dev-test" });
  assert.equal(config.automationProfile, "full_auto");
  assert.equal(config.dataMode, "dev-test");
  assert.ok(store.snapshot().sessions.some((session) => session.id.startsWith("mock-")));
  store.updateConfig({ automationProfile: "full_auto", dataMode: "codex" });
});

test("release config can keep manual profile for packaged deployments", () => {
  const store = new MockStore();
  const config = store.updateConfig({ deploymentMode: "release", automationProfile: "manual" });
  assert.equal(config.deploymentMode, "release");
  assert.equal(config.automationProfile, "manual");
  store.updateConfig({ deploymentMode: "local", dataMode: "codex", automationProfile: "full_auto" });
});

test("automation profile ids stay stable for frontend settings", () => {
  assert.deepEqual(automationProfiles.map((profile) => profile.id), ["full_auto", "workspace_auto", "manual"]);
});

test("production source avoids hardcoded local user paths", () => {
  const forbidden = `/home/${"heyx"}`;
  const files = [
    "apps/server/src/store.ts",
    "apps/server/src/index.ts",
    "apps/server/src/tmpQa.ts",
    "apps/web/src/main.tsx",
    "packages/protocol/src/index.ts",
    "packages/protocol/src/index.test.ts"
  ];
  for (const file of files) {
    assert.equal(readFileSync(join(projectRoot, file), "utf8").includes(forbidden), false, `${file} contains a hardcoded user path`);
  }
});

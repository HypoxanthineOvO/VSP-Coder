import assert from "node:assert/strict";
import test from "node:test";
import { safeJoin } from "./store.js";

test("safeJoin allows project-relative paths", () => {
  assert.ok(safeJoin("/tmp/project", ".pipeline/config.yaml").endsWith("/tmp/project/.pipeline/config.yaml"));
});

test("safeJoin rejects path traversal", () => {
  assert.throws(() => safeJoin("/tmp/project", "../secret"), /escapes/);
});

test("safeJoin rejects absolute paths", () => {
  assert.throws(() => safeJoin("/tmp/project", "/etc/passwd"), /Invalid/);
});

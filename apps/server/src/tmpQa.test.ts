import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createTmpQaFixture } from "./tmpQa.js";

test("createTmpQaFixture creates an isolated disposable tmp project", () => {
  const base = mkdtempSync(join(tmpdir(), "vsp-coder-fixture-test-"));
  const fixture = createTmpQaFixture(base);

  assert.ok(fixture.path.startsWith(base));
  assert.ok(fixture.path.includes("vsp-coder-c2-"));
  assert.ok(fixture.files.every((file) => existsSync(file)));
  assert.match(readFileSync(join(fixture.path, "README.md"), "utf8"), /Disposable QA Fixture/);
  assert.match(fixture.prompt, /m10-codex-smoke\.txt/);
});

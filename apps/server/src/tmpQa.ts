import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export type TmpQaFixture = {
  path: string;
  files: string[];
  prompt: string;
};

export function createTmpQaFixture(baseDir = tmpdir()): TmpQaFixture {
  const root = mkdtempSync(join(baseDir, "vsp-coder-c2-"));
  const files = [
    write(root, "README.md", [
      "# VSP-Coder C2 Disposable QA Fixture",
      "",
      "This directory is disposable and exists only for final C2 Codex adapter QA.",
      "Do not use it for real project data.",
      ""
    ].join("\n")),
    write(root, "qa-notes.md", [
      "# QA Notes",
      "",
      "- Create a Codex thread in this directory.",
      "- Run a harmless command.",
      "- Create and read back a smoke artifact.",
      "- Rename the thread and verify persistence across refresh/restart.",
      ""
    ].join("\n")),
    write(root, ".gitignore", [
      "node_modules/",
      "m10-codex-smoke.txt",
      ""
    ].join("\n"))
  ];
  return {
    path: root,
    files,
    prompt: [
      "M10 final QA smoke: please run pwd, create m10-codex-smoke.txt with content hello-m10, then show the file content.",
      "Do not modify files outside this disposable tmp QA directory."
    ].join(" ")
  };
}

function write(root: string, relativePath: string, content: string) {
  const path = join(root, relativePath);
  writeFileSync(path, content, "utf8");
  return path;
}

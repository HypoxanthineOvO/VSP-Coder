# M07 File Changes, Command Output, And Preview

Status: manual validation

Updated: 2026-05-05 23:34 Asia/Shanghai

## Summary

M07 adds provider-neutral artifacts for Codex command output, file-change diffs,
and previewable artifact bodies. The UI now has an Artifacts tab, and the server
exposes a session-scoped artifact preview endpoint with project-root confinement.

## Implemented

- Extended VSP `Artifact` with optional kind, status, body, and MIME metadata.
- Added `codexArtifacts` mapping for:
  - completed `commandExecution` items;
  - live `item/commandExecution/outputDelta` output;
  - completed `fileChange` items;
  - live `item/fileChange/patchUpdated`;
  - turn-level `turn/diff/updated`.
- Merged artifact updates into live session patches and preserved them across
  post-turn provider refreshes.
- Added `GET /api/sessions/:sessionId/artifacts/:artifactId/preview`.
- Added `previewArtifact` path confinement:
  - inline artifact bodies preview directly;
  - file reads must stay under the selected session cwd;
  - large/binary/unsupported files return unsupported preview state.
- Added right-sidebar Artifacts tab with command/diff cards and inline preview.

## Validation

- `npm run typecheck` passed.
- `npm run build` passed.
- `npm test -w @vsp-coder/server` passed.
- `npm test` passed.
- Smoke: a tmp Codex turn running `pwd` produced a command artifact and the
  preview endpoint returned the command output.
- Post-QA fixes:
  - Approval card buttons now use larger 44px hit targets in a responsive grid.
  - Artifact file paths display as session-relative paths where possible.
  - File-change output artifacts are marked completed when the file change
    completes instead of staying `running`.

## Manual QA Needed

Use a disposable tmp session.

1. Send: `M07 QA：请运行 pwd，然后创建 m07-artifact-smoke.txt，内容写入 hello-m07，再显示该文件内容。`
2. If approval cards appear in manual profile, approve only the tmp-file action.
3. Open the right sidebar `Artifacts` tab.
4. Confirm command output artifacts appear for `pwd` and/or `cat`.
5. Confirm a file-change/diff artifact appears for `m07-artifact-smoke.txt`.
6. Click artifacts and confirm preview text/diff is readable.
7. Confirm unrelated outside-root preview URLs fail rather than showing content.

## Limitations

- M07 does not implement a full terminal emulator.
- M07 does not implement a rich diff editor.
- Some older Codex sessions only persist assistant summaries rather than raw
  command/file-change items; artifacts are most reliable for new live turns and
  for sessions whose `thread/read` returns structured items.

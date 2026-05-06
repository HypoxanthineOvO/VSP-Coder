# M12 Observability, Event Coalescing, And Subagent Trace

## Objective

Finish the final C2 acceptance observability layer by reducing noisy event
refreshes, improving narrow desktop topbar layout, and making Codex subagent
activity visible through a focused trace surface.

## Dependencies

- M05 streaming/event mapping must be available.
- M07 command/file artifacts and tool rendering must be available.
- M10 final QA harness remains the acceptance gate.
- M11 frontend rendering polish must remain intact.

## Implementation Scope

- Event noise reduction:
  - Coalesce repeated persistent events before they flood Activity.
  - Treat common non-blocking Codex app-server warnings as health/debug details
    instead of red Activity errors.
  - Keep serious Codex errors visible.
  - Avoid triggering full frontend refreshes for non-actionable warning chatter.
- Subagent trace visibility:
  - Detect Codex app-server notifications or thread items that look like
    subagent activity.
  - Render subagent activity as a compact trace row in detailed mode.
  - Provide a click-open panel/modal that shows subagent type/name/status and
    raw detail text for debugging.
  - Keep simple mode quiet except for active thinking/working state.
- PC narrow-width topbar:
  - Revisit the desktop session statusbar for widths just above mobile.
  - Prevent status/model/reasoning/mode controls from overlapping.
  - Prefer explicit grid/flex constraints, truncation, and hiding low-priority
    metrics over wrapping or overflow.

## Test And Validation Spec

- Run automated checks:
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
  - `git diff --check`
- Add focused mapper tests for:
  - non-blocking warning classification;
  - subagent-like notification or item mapping.
- Manual QA:
  - Send a real Codex probe that triggers a subagent call.
  - Confirm the message stream shows subagent activity.
  - Confirm clicking the subagent row opens the detailed trace panel.
  - Confirm common warning spam does not repeatedly fill Activity.
  - Confirm the PC topbar does not overlap at narrow desktop widths.

## Expected Artifacts

- Updated Codex event/item mapping.
- Updated frontend subagent trace component and modal/panel styles.
- Updated topbar layout CSS.
- M12 report under `.pipeline/reports/`.

## Guardrails

- Do not hardcode local user paths.
- Do not hide real errors.
- Keep simple mode low-noise.
- Preserve existing M10 tmp QA session and acceptance gate semantics.

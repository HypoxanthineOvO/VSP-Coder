# M11 Frontend Message Rendering And Interaction Polish

## Objective

Improve the VSP-Coder frontend reading and interaction experience before
continuing C2 rename and final acceptance work. This milestone focuses on rich
message rendering, command-output presentation, visual polish, and fixed status
surfaces.

## Dependencies

- M05 streaming message/event mapping must already be available.
- M07 command/file-change artifacts and previews must already be available.
- M08 queue/interrupt/recovery semantics must already be accepted.
- This milestone is appended after M10 by plan extension rules, but it should be
  executed before returning to the original M09/M10 flow.

## Implementation Scope

- Add robust Markdown rendering for chat messages and workflow/status Markdown:
  - GFM lists, nested lists, tables, task lists, blockquotes, links.
  - Inline code and fenced code blocks.
  - Inline math and block math.
  - Safe HTML blocks through a sanitized allowlist.
- Use mature frontend dependencies for reliability:
  - `react-markdown`
  - `remark-gfm`
  - `remark-math`
  - `rehype-katex`
  - `rehype-raw`
  - `rehype-sanitize`
  - `katex`
- Separate command execution content from normal assistant/user messages:
  - Detect tool/command-style messages such as `$ /bin/zsh -lc ...` plus output.
  - Default command content to a subtle collapsed marker.
  - Collapsed marker should show a concrete summary, such as
    `正在运行 npm test` or `已运行 cat ...`.
  - Expanded content should show the full `$ /bin/zsh -lc '...'` command and
    command output in a terminal-style block.
- Brighten the current dark theme enough to improve readability while preserving
  the operational VSP-Coder aesthetic.
- Add hover, press, and focus-visible feedback to buttons and clickable rows.
- Fix the top status dock/statusbar so it remains visible at the top of the
  message pane and is not pushed out of view by the message stream.
- Ensure Project Status / Workflow markdown surfaces use the same Markdown,
  math, inline-code, and safe-HTML rendering path.

## Test And Validation Spec

- Run automated checks:
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
- Add focused tests where practical for:
  - command-message parsing or formatting helpers;
  - sanitizer behavior if helper code is introduced;
  - markdown rendering helper behavior if isolated enough for unit tests.
- Manual desktop validation:
  - A long Markdown response with nested lists renders correctly.
  - Inline code, fenced code blocks, tables, blockquotes, links, and task lists
    render correctly.
  - Inline and block math render in chat messages and Project Status.
  - Safe HTML blocks render only allowed markup; dangerous HTML is not executed.
  - Command execution messages are collapsed by default and expand to full
    command/output.
  - Status dock remains visible without scrolling upward.
  - Hover/press/focus feedback is visible on controls.
- Manual mobile validation:
  - Message Markdown does not overflow.
  - Code blocks and command output scroll horizontally inside their containers.
  - The fixed status dock and queue/composer surfaces do not create page
    over-width.

## Expected Artifacts

- Updated frontend rendering components and styles.
- Any new rendering/command parsing helper tests.
- Updated package dependencies and lockfile if new dependencies are installed.
- M11 report under `.pipeline/reports/`.

## Guardrails

- Do not hardcode local user paths.
- Keep provider protocol unchanged unless a clear rendering-only field is needed.
- Sanitize raw HTML; never allow script execution, inline event handlers, or
  unsafe URLs.
- Do not regress mobile layout width fixes from M04/M05/M08.

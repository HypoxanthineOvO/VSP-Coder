# C1R Round 3 Feedback

## PC

1. Main conversation composer is missing in the current PC layout. The input field and send button are not visible directly under the main session.
2. The right sidebar is too narrow on fullscreen desktop. It should be wider, while future responsive behavior must preserve a minimum main conversation width and progressively collapse the left rails.
3. The new-session action should move next to the refresh button on both PC and mobile, ideally placed to the left of refresh, instead of occupying a large rail row.

## Mobile

1. The mobile session dock exposes model selection but does not expose reasoning strength.
2. Mobile session cards are too tall. Timestamp should sit on the same row as status, right-aligned.

## Interaction Semantics

1. New-session flow has no mock behavior or visible feedback yet.
2. Refresh has no mock behavior or visible feedback yet.
3. QA Pass/Fail clicks do not provide clear feedback. Unlike approval cards disappearing, pass/fail state changes are visually ambiguous.

## Visual State

1. Button colors do not clearly distinguish enabled pending actions from disabled, already-clicked, or secondary actions.
2. Dark buttons currently read as disabled or completed, while some dark buttons are still actionable. Bright colors should be reserved for pending/primary actions.

## Discussion Notes

- Treat missing PC composer as a blocking bug.
- Treat right-sidebar width and progressive rail collapse as a responsive-layout policy decision.
- Treat new-session and refresh as mock interaction contracts that need explicit event/log feedback.
- Treat QA pass/fail as a state transition needing immediate visual confirmation and Activity/system-message feedback.

## Fix Pass Notes

- Composer visibility is handled as a layout bug: desktop workspace rows reserve the conversation area first, then pending strip and composer.
- New session, refresh, search, and resource-entry buttons are now connected to mock backend actions.
- QA pass/fail is now represented as a selected visual state and emits `qa_updated`.
- Right rail is widened on large desktop, with a compact global rail breakpoint before mobile collapse.
- Mobile model dock includes reasoning strength and session cards use a compact metadata row.

## Fix Pass Notes 2

- Desktop columns now support manual drag resizing for the global rail, session rail, and right rail; the main conversation column keeps the remaining width with a minimum content constraint.
- Mobile recent sessions now default to a shorter preview so Activity remains visible sooner; the existing "more" control expands the full session list.
- `Execution mode` was removed from the editable Workflow Config surface because it was not backed by a meaningful user-facing behavior in this mock.
- Provider/model switching is exposed through the current session model selector and calls the `switch_model` action with `provider`, `model`, and `reasoning`; OpenCode and Claude Code are still marked as mock mappings until real backend adapters are implemented.

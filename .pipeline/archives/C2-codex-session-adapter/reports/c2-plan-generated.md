# C2 Plan Generated

- Result: generated
- Cycle: C2 Codex Session Adapter
- Status: waiting for P4 confirmation

## Summary

C2 will deliver a complete Codex adapter for VSP-Coder. The adapter will use
Codex app-server behind the VSP-Coder backend, preserve the provider-independent
browser API, discover projects from Codex thread `cwd` metadata, route all user
input through the server queue, and verify a real tmp-project end-to-end flow
before user acceptance.

## Generated Artifacts

- `.pipeline/design-spec.md`
- `.pipeline/architecture.md`
- `.pipeline/PROGRESS.md`
- `.plan-state/discover.yaml`
- `.plan-state/decompose.yaml`
- `.plan-state/generate.yaml`
- `.pipeline/prompts/01-configuration-automation-profiles-and-no-hardcode-baseline.md`
- `.pipeline/prompts/02-codex-app-server-client-foundation.md`
- `.pipeline/prompts/03-codex-thread-and-project-discovery.md`
- `.pipeline/prompts/04-thread-start-resume-queue-and-steer.md`
- `.pipeline/prompts/05-streaming-event-and-metric-mapping.md`
- `.pipeline/prompts/06-approval-and-automation-strategy.md`
- `.pipeline/prompts/07-file-changes-command-output-and-preview.md`
- `.pipeline/prompts/08-interrupt-queue-controls-and-error-recovery.md`
- `.pipeline/prompts/09-rename-and-persistence-verification.md`
- `.pipeline/prompts/10-tmp-qa-harness-knowledge-finalization-and-acceptance-gate.md`
- `.pipeline/knowledge/reference/vsp-provider-protocol.md`
- `.pipeline/knowledge/reference/codex-adapter-mapping.md`

## Guardrails

- No production hardcoded user paths.
- No browser-to-Codex raw protocol exposure.
- Mock/tmp data only in dev/test after acceptance.
- Existing non-tmp Codex threads are read-only before final C2 acceptance.
- Rename must use Codex canonical storage and survive refresh/restart.

## Next Step

P4 confirmation must explicitly approve this generated plan before execution
starts.

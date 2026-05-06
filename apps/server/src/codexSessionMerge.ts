import type { RequestCard, Session } from "@vsp-coder/protocol";

export function mergeProviderRefresh(previous: Session, next: Session): Session {
  return {
    ...next,
    model: previous.model || next.model,
    reasoning: previous.reasoning || next.reasoning,
    automationProfile: next.automationProfile || previous.automationProfile,
    sandbox: next.sandbox || previous.sandbox,
    approvalPolicy: next.approvalPolicy || previous.approvalPolicy,
    queue: previous.queue.length ? previous.queue : next.queue,
    cards: mergeCards(previous.cards, next.cards),
    artifacts: previous.artifacts.length ? mergeArtifacts(previous.artifacts, next.artifacts) : next.artifacts,
    currentTurnId: next.currentTurnId || (next.status === "running" || next.status === "waiting_approval" ? previous.currentTurnId : undefined),
    status: previous.status === "waiting_approval" ? previous.status : next.status
  };
}

function mergeCards(previous: RequestCard[], next: RequestCard[]) {
  const providerIds = new Set(next.map((card) => card.id));
  return [...previous.filter((card) => card.status === "open" || !providerIds.has(card.id)), ...next];
}

function mergeArtifacts(previous: Session["artifacts"], next: Session["artifacts"]) {
  const providerIds = new Set(next.map((artifact) => artifact.id));
  return [...previous.filter((artifact) => !providerIds.has(artifact.id)), ...next];
}

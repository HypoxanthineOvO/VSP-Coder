import type { Message, RequestCard, Session } from "@vsp-coder/protocol";

export function mergeProviderRefresh(previous: Session, next: Session): Session {
  return {
    ...next,
    model: previous.model || next.model,
    reasoning: previous.reasoning || next.reasoning,
    automationProfile: next.automationProfile || previous.automationProfile,
    sandbox: next.sandbox || previous.sandbox,
    approvalPolicy: next.approvalPolicy || previous.approvalPolicy,
    queue: previous.queue.length ? previous.queue : next.queue,
    messages: mergeMessages(previous.messages, next.messages),
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

function mergeMessages(previous: Message[], next: Message[]) {
  const merged = [...next];
  for (const message of previous) {
    const matchIndex = merged.findIndex((item) => messageMatches(item, message));
    if (matchIndex === -1) {
      const optimisticIndex = merged.findIndex((item) => shouldConfirmOptimistic(message, item));
      if (optimisticIndex !== -1) {
        merged[optimisticIndex] = confirmOptimistic(message, merged[optimisticIndex]);
        continue;
      }
      merged.push(message);
      continue;
    }
    merged[matchIndex] = preferLongerLiveText(message, merged[matchIndex]);
  }
  return merged;
}

function messageMatches(a: Message, b: Message) {
  return a.id === b.id || Boolean(a.providerItemRef && b.providerItemRef && a.providerItemRef === b.providerItemRef);
}

function preferLongerLiveText(previous: Message, next: Message): Message {
  const previousText = messageText(previous);
  const nextText = messageText(next);
  if (previous.role === next.role && previousText && nextText && previousText.length > nextText.length) {
    return { ...next, blocks: previous.blocks };
  }
  return next;
}

function messageText(message: Message) {
  return message.blocks
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

function shouldConfirmOptimistic(previous: Message, providerMessage: Message) {
  if (previous.role !== "user" || providerMessage.role !== "user") return false;
  if (previous.deliveryState !== "pending" && previous.deliveryState !== "sent") return false;
  return normalizeText(previous) !== "" && normalizeText(previous) === normalizeText(providerMessage);
}

function confirmOptimistic(previous: Message, providerMessage: Message): Message {
  return {
    ...providerMessage,
    clientMutationId: previous.clientMutationId || previous.providerItemRef || previous.id,
    deliveryState: "confirmed"
  };
}

function normalizeText(message: Message) {
  return messageText(message).replace(/\s+/g, " ").trim();
}

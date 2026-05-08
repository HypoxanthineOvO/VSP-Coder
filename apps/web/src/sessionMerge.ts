import type { Artifact, Message, Session, VspState } from "@vsp-coder/protocol";

const IDE_CONTEXT_HEADER = "Context from my IDE setup:";
const IDE_REQUEST_MARKER = "My request for Codex:";

export type LiveSessionPatch = {
  kind: "live_session_patch";
  title?: string;
  messageDelta?: {
    id: string;
    role: "assistant" | "tool";
    text: string;
    providerItemRef: string;
  };
  finalMessages?: Message[];
  status?: Session["status"];
  currentTurnId?: string | null;
  metric?: Partial<Session["metric"]>;
  artifactUpdates?: ArtifactUpdate[];
};

export type ArtifactUpdate = Artifact & {
  appendBody?: boolean;
};

function stripIdeContextWrapper(text: string) {
  const normalized = text.trimStart();
  if (!normalized.startsWith(IDE_CONTEXT_HEADER)) return text;
  const markerIndex = normalized.indexOf(IDE_REQUEST_MARKER);
  if (markerIndex === -1) return text;
  const request = normalized.slice(markerIndex + IDE_REQUEST_MARKER.length).trim();
  return request || text;
}

export function sanitizeMessageText(message: Message): Message {
  let changed = false;
  const blocks = message.blocks.map((block) => {
    if (block.type !== "text") return block;
    const text = stripIdeContextWrapper(block.text);
    if (text === block.text) return block;
    changed = true;
    return { ...block, text };
  });
  return changed ? { ...message, blocks } : message;
}

function sanitizeMessages(messages: Message[]) {
  return messages.map(sanitizeMessageText);
}

export function sanitizeSessionMessages(session: Session): Session {
  return { ...session, messages: sanitizeMessages(session.messages) };
}

function sanitizeStateMessages(state: VspState): VspState {
  return { ...state, sessions: state.sessions.map(sanitizeSessionMessages) };
}

function sanitizeLivePatch(patch: LiveSessionPatch): LiveSessionPatch {
  return {
    ...patch,
    messageDelta: patch.messageDelta ? { ...patch.messageDelta, text: stripIdeContextWrapper(patch.messageDelta.text) } : undefined,
    finalMessages: patch.finalMessages ? sanitizeMessages(patch.finalMessages) : undefined
  };
}

export function mergeStatePreservingDetails(previous: VspState | null, next: VspState): VspState {
  previous = previous ? sanitizeStateMessages(previous) : previous;
  next = sanitizeStateMessages(next);
  if (!previous) return next;
  const previousById = new Map(previous.sessions.map((session) => [session.id, session]));
  const nextIds = new Set(next.sessions.map((session) => session.id));
  const localOnly = previous.sessions.filter((session) => !nextIds.has(session.id) && session.provider === "codex");
  return {
    ...next,
    sessions: [...localOnly, ...next.sessions.map((session) => {
      const existing = previousById.get(session.id);
      if (!existing) return session;
      const keepCards = !session.cards.length && existing.cards.length;
      const keepArtifacts = !session.artifacts.length && existing.artifacts.length;
      const messages = mergeDetailedMessages(existing.messages, session.messages);
      const changedMessages = messages.length !== session.messages.length;
      if (!changedMessages && !keepCards && !keepArtifacts) return session;
      return {
        ...session,
        model: existing.model || session.model,
        reasoning: existing.reasoning || session.reasoning,
        automationProfile: session.automationProfile || existing.automationProfile,
        sandbox: session.sandbox || existing.sandbox,
        approvalPolicy: session.approvalPolicy || existing.approvalPolicy,
        messages,
        cards: keepCards ? existing.cards : session.cards,
        artifacts: keepArtifacts ? existing.artifacts : session.artifacts
      };
    })]
  };
}

export function patchSession(session: Session, patch: LiveSessionPatch): Session {
  const cleanPatch = sanitizeLivePatch(patch);
  const cleanSession = sanitizeSessionMessages(session);
  return {
    ...cleanSession,
    title: cleanPatch.title || cleanSession.title,
    status: cleanPatch.status || cleanSession.status,
    currentTurnId: typeof cleanPatch.currentTurnId === "undefined" ? cleanSession.currentTurnId : cleanPatch.currentTurnId || undefined,
    metric: cleanPatch.metric ? { ...cleanSession.metric, ...cleanPatch.metric, updatedAt: cleanPatch.metric.updatedAt || new Date().toISOString() } : cleanSession.metric,
    messages: patchMessages(cleanSession.id, cleanSession.messages, cleanPatch),
    artifacts: cleanPatch.artifactUpdates ? mergeArtifactUpdates(cleanSession.artifacts, cleanPatch.artifactUpdates) : cleanSession.artifacts,
    updatedAt: new Date().toISOString()
  };
}

function mergeArtifactUpdates(existing: Artifact[], updates: ArtifactUpdate[]): Artifact[] {
  let next = existing;
  for (const update of updates) {
    const { appendBody: _appendBody, ...artifact } = update;
    const current = next.find((item) => item.id === artifact.id);
    if (!current) {
      next = [artifact, ...next];
      continue;
    }
    next = next.map((item) => item.id === artifact.id
      ? { ...item, ...artifact, body: update.appendBody ? `${item.body || ""}${artifact.body || ""}` : artifact.body }
      : item);
  }
  return next;
}

function patchMessages(sessionId: string, messages: Message[], patch: LiveSessionPatch): Message[] {
  let next = messages;
  if (patch.messageDelta) {
    const delta = patch.messageDelta;
    next = next.some((message) => message.id === delta.id)
      ? next.map((message) => message.id === delta.id ? appendMessageText(message, delta.text) : message)
      : [...next, {
        id: delta.id,
        sessionId,
        role: delta.role,
        providerItemRef: delta.providerItemRef,
        createdAt: new Date().toISOString(),
        blocks: [{ type: "text", text: delta.text }]
      }];
  }
  for (const finalMessage of patch.finalMessages || []) {
    const directMatch = next.find((message) => messageMatches(message, finalMessage));
    const optimisticMatch = directMatch ? null : next.find((message) => shouldConfirmOptimistic(message, finalMessage));
    if (directMatch) {
      next = next.map((message) => messageMatches(message, finalMessage) ? mergeMessagePreferLive(message, finalMessage) : message);
    } else if (optimisticMatch) {
      next = next.map((message) => message === optimisticMatch ? confirmOptimistic(message, finalMessage) : message);
    } else {
      next = [...next, finalMessage];
    }
  }
  return next;
}

export function mergeDetailedSession(existing: Session, detail: Session): Session {
  existing = sanitizeSessionMessages(existing);
  detail = sanitizeSessionMessages(detail);
  return {
    ...detail,
    model: existing.model || detail.model,
    reasoning: existing.reasoning || detail.reasoning,
    automationProfile: detail.automationProfile || existing.automationProfile,
    sandbox: detail.sandbox || existing.sandbox,
    approvalPolicy: detail.approvalPolicy || existing.approvalPolicy,
    queue: existing.queue.length ? existing.queue : detail.queue,
    messages: mergeDetailedMessages(existing.messages, detail.messages),
    artifacts: mergeDetailArtifacts(existing.artifacts, detail.artifacts),
    cards: existing.cards.some((card) => card.status === "open") ? existing.cards : detail.cards
  };
}

function mergeDetailedMessages(existing: Message[], detail: Message[]) {
  const merged = [...detail];
  for (const message of existing) {
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
    merged[matchIndex] = mergeMessagePreferLive(message, merged[matchIndex]);
  }
  return merged;
}

function mergeMessagePreferLive(existing: Message | undefined, detail: Message): Message {
  existing = existing ? sanitizeMessageText(existing) : existing;
  detail = sanitizeMessageText(detail);
  if (!existing) return detail;
  const existingText = messagePlainText(existing);
  const detailText = messagePlainText(detail);
  if (existing.role === detail.role && existingText && detailText && existingText.length > detailText.length) {
    return {
      ...detail,
      blocks: existing.blocks
    };
  }
  return detail;
}

function messagePlainText(message: Message) {
  return message.blocks
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

function messageMatches(a: Message, b: Message) {
  return a.id === b.id || Boolean(a.providerItemRef && b.providerItemRef && a.providerItemRef === b.providerItemRef);
}

function shouldConfirmOptimistic(optimistic: Message, providerMessage: Message) {
  if (optimistic.role !== "user" || providerMessage.role !== "user") return false;
  if (optimistic.deliveryState !== "pending" && optimistic.deliveryState !== "sent") return false;
  return normalizedMessageText(optimistic) !== "" && normalizedMessageText(optimistic) === normalizedMessageText(providerMessage);
}

function confirmOptimistic(optimistic: Message, providerMessage: Message): Message {
  return {
    ...providerMessage,
    clientMutationId: optimistic.clientMutationId || optimistic.providerItemRef || optimistic.id,
    deliveryState: "confirmed"
  };
}

function normalizedMessageText(message: Message) {
  return messagePlainText(message).replace(/\s+/g, " ").trim();
}

function mergeDetailArtifacts(existing: Artifact[], detail: Artifact[]) {
  const detailIds = new Set(detail.map((artifact) => artifact.id));
  return [...detail, ...existing.filter((artifact) => !detailIds.has(artifact.id))];
}

function appendMessageText(message: Message, delta: string): Message {
  return {
    ...message,
    blocks: message.blocks.map((block, index) => {
      if (index !== 0 || block.type !== "text") return block;
      return { ...block, text: `${block.text}${delta}` };
    })
  };
}

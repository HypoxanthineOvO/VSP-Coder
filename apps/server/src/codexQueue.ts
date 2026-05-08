import type { Message, QueueItem, Session } from "@vsp-coder/protocol";

const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function codexSessionIsBusy(session: Session | null | undefined) {
  if (!session) return false;
  return Boolean(session.currentTurnId) || session.status === "running" || session.status === "waiting_approval" || session.status === "queued";
}

export function enqueuePendingMessage(session: Session, text: string, createdAt = new Date().toISOString()): Session {
  const queueItem: QueueItem = {
    id: id("queue"),
    text,
    tokens: [],
    createdAt,
    state: "pending"
  };
  return {
    ...session,
    status: session.status === "idle" ? "queued" : session.status,
    queue: [...session.queue, queueItem],
    messages: upsertOutboundMessage(session.messages, optimisticMessageForQueueItem(session.id, queueItem)),
    updatedAt: createdAt
  };
}

export function clearPendingQueue(session: Session, updatedAt = new Date().toISOString()) {
  let cleared = 0;
  const queue = session.queue.map((item) => {
    if (item.state !== "pending") return item;
    cleared += 1;
    return { ...item, state: "cleared" as const };
  });
  const clearedIds = new Set(session.queue.filter((item) => item.state === "pending").map((item) => item.id));
  return {
    session: {
      ...session,
      queue,
      messages: session.messages.filter((message) => !isOutboundMessageFor(message, clearedIds, "pending")),
      updatedAt
    },
    cleared
  };
}

export function nextPendingQueueItem(session: Session) {
  return session.queue.find((item) => item.state === "pending") || null;
}

export function markQueueItemSent(session: Session, queueItemId: string, updatedAt = new Date().toISOString()): Session {
  return {
    ...session,
    queue: session.queue.map((item) => item.id === queueItemId ? { ...item, state: "sent" as const } : item),
    messages: markOutboundMessages(session.messages, queueItemId, "sent"),
    updatedAt
  };
}

export function appendOptimisticUserMessage(
  session: Session,
  text: string,
  providerItemRef = id("outbound"),
  createdAt = new Date().toISOString()
): Session {
  return {
    ...session,
    messages: upsertOutboundMessage(session.messages, {
      id: providerItemRef,
      sessionId: session.id,
      role: "user",
      providerItemRef,
      clientMutationId: providerItemRef,
      deliveryState: "sent",
      createdAt,
      blocks: [{ type: "text", text }]
    }),
    updatedAt: createdAt
  };
}

function optimisticMessageForQueueItem(sessionId: string, queueItem: QueueItem): Message {
  return {
    id: queueItem.id,
    sessionId,
    role: "user",
    providerItemRef: queueItem.id,
    clientMutationId: queueItem.id,
    deliveryState: "pending",
    createdAt: queueItem.createdAt,
    blocks: [{ type: "text", text: queueItem.text }]
  };
}

function upsertOutboundMessage(messages: Message[], message: Message) {
  return messages.some((item) => messageMatches(item, message))
    ? messages.map((item) => messageMatches(item, message) ? { ...item, ...message, blocks: message.blocks } : item)
    : [...messages, message];
}

function messageMatches(a: Message, b: Message) {
  return a.id === b.id || Boolean(a.providerItemRef && b.providerItemRef && a.providerItemRef === b.providerItemRef);
}

export function markQueueItemPending(session: Session, queueItemId: string, updatedAt = new Date().toISOString()): Session {
  return {
    ...session,
    queue: session.queue.map((item) => item.id === queueItemId ? { ...item, state: "pending" as const } : item),
    messages: markOutboundMessages(session.messages, queueItemId, "pending"),
    updatedAt
  };
}

function isOutboundMessageFor(messages: Message, ids: Set<string>, state?: NonNullable<Message["deliveryState"]>) {
  if (messages.role !== "user") return false;
  if (state && messages.deliveryState !== state) return false;
  return Boolean((messages.clientMutationId && ids.has(messages.clientMutationId)) || ids.has(messages.id) || (messages.providerItemRef && ids.has(messages.providerItemRef)));
}

function markOutboundMessages(messages: Message[], queueItemId: string, deliveryState: NonNullable<Message["deliveryState"]>) {
  return messages.map((message) => {
    if (!isOutboundMessageFor(message, new Set([queueItemId]))) return message;
    return { ...message, deliveryState };
  });
}

export function markActiveSessionUnavailable(session: Session, updatedAt = new Date().toISOString()): Session {
  if (!codexSessionIsBusy(session)) return session;
  return {
    ...session,
    status: "error",
    currentTurnId: undefined,
    cards: session.cards.map((card) => card.status === "open" ? { ...card, status: "failed", resolvedAt: updatedAt } : card),
    updatedAt
  };
}

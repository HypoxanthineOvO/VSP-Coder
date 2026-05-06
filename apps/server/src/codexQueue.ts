import type { QueueItem, Session } from "@vsp-coder/protocol";

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
  return {
    session: {
      ...session,
      queue,
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
    updatedAt
  };
}

export function markQueueItemPending(session: Session, queueItemId: string, updatedAt = new Date().toISOString()): Session {
  return {
    ...session,
    queue: session.queue.map((item) => item.id === queueItemId ? { ...item, state: "pending" as const } : item),
    updatedAt
  };
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

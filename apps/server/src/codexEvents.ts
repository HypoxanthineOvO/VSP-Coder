import type { Message, Metric, SessionStatus, SubagentTrace, VspEvent } from "@vsp-coder/protocol";
import { messageFromCodexItem } from "./codexDiscovery.js";
import { artifactUpdatesFromNotification, artifactsFromCodexItem, type ArtifactUpdate } from "./codexArtifacts.js";

type CodexNotification = {
  method: string;
  params?: unknown;
};

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
  status?: SessionStatus;
  currentTurnId?: string | null;
  metric?: Partial<Metric>;
  artifactUpdates?: ArtifactUpdate[];
};

export type CodexMappedNotification = {
  sessionId?: string;
  persistent: boolean;
  event: Omit<VspEvent, "id" | "createdAt">;
  patch?: LiveSessionPatch;
  refreshSession?: boolean;
};

export function mapCodexNotification(notification: CodexNotification, at = new Date()): CodexMappedNotification[] {
  const method = notification.method;
  const params = asRecord(notification.params);
  const threadId = stringValue(params.threadId);
  const turnId = stringValue(params.turnId);

  if (method === "item/agentMessage/delta" && threadId) {
    const itemId = stringValue(params.itemId) || `${turnId || threadId}:assistant`;
    const delta = stringValue(params.delta);
    if (!delta) return [];
    return [live(threadId, "message_added", "Assistant 正在回复", {
      messageDelta: { id: itemId, role: "assistant", text: delta, providerItemRef: itemId },
      status: "running",
      currentTurnId: turnId || null
    })];
  }

  if ((method === "item/commandExecution/outputDelta" || method === "item/fileChange/outputDelta") && threadId) {
    const itemId = stringValue(params.itemId) || `${turnId || threadId}:tool`;
    const delta = stringValue(params.delta);
    if (!delta) return [];
    return [live(threadId, "message_added", "工具输出正在更新", {
      messageDelta: { id: itemId, role: "tool", text: delta, providerItemRef: itemId },
      artifactUpdates: artifactUpdatesFromNotification(method, notification.params),
      status: "running",
      currentTurnId: turnId || null
    })];
  }

  if (isSubagentMethod(method) && threadId) {
    const itemId = stringValue(params.itemId) || stringValue(params.agentId) || `${turnId || threadId}:subagent:${stableHash(JSON.stringify(params))}`;
    return [live(threadId, "session_updated", "Subagent trace 已更新", {
      finalMessages: [subagentTraceMessage(threadId, itemId, method, params, at.toISOString())],
      status: "running",
      currentTurnId: turnId || null
    })];
  }

  if (method === "item/completed" && threadId) {
    const item = params.item;
    const finalMessages = item ? messageFromCodexItem(threadId, item as never, at.toISOString()) : [];
    const artifactUpdates = item ? artifactsFromCodexItem(threadId, item) : [];
    return [live(threadId, "message_added", "Codex item 已完成", {
      finalMessages,
      artifactUpdates,
      status: "running",
      currentTurnId: turnId || null
    })];
  }

  if ((method === "item/fileChange/patchUpdated" || method === "turn/diff/updated") && threadId) {
    const artifactUpdates = artifactUpdatesFromNotification(method, notification.params);
    if (!artifactUpdates.length) return [];
    return [live(threadId, "session_updated", "Artifact 已更新", {
      artifactUpdates,
      status: "running",
      currentTurnId: turnId || null
    })];
  }

  if (method === "rawResponseItem/completed" && threadId) {
    return [{
      sessionId: threadId,
      persistent: false,
      refreshSession: false,
      event: {
        sessionId: threadId,
        type: "message_added",
        message: "Codex raw response item 已完成",
        payload: { method }
      }
    }];
  }

  if (method === "turn/started" && threadId) {
    const turn = asRecord(params.turn);
    const id = stringValue(turn.id) || turnId;
    return [live(threadId, "session_updated", "Codex turn 已开始", {
      status: "running",
      currentTurnId: id || null,
      metric: { startedAt: unixSecondsToIso(numberValue(turn.startedAt)) || at.toISOString(), updatedAt: at.toISOString() }
    })];
  }

  if (method === "turn/completed" && threadId) {
    const turn = asRecord(params.turn);
    const status = stringValue(turn.status) === "failed" ? "error" : stringValue(turn.status) === "interrupted" ? "interrupted" : "idle";
    return [live(threadId, "session_updated", status === "idle" ? "Codex turn 已完成" : "Codex turn 已停止", {
      status,
      currentTurnId: null,
      metric: {
        durationMs: numberValue(turn.durationMs),
        updatedAt: unixSecondsToIso(numberValue(turn.completedAt)) || at.toISOString()
      }
    }, true, true)];
  }

  if (method === "thread/status/changed" && threadId) {
    const status = mapThreadStatus(params.status);
    return [live(threadId, "session_updated", `Codex session ${statusLabel(status)}`, {
      status,
      currentTurnId: status === "running" ? turnId || null : null
    })];
  }

  if (method === "thread/name/updated" && threadId) {
    const title = stringValue(params.threadName);
    return [live(threadId, "session_updated", title ? `Codex session 已重命名：${title}` : "Codex session 名称已更新", {
      title
    }, true, true)];
  }

  if (method === "thread/tokenUsage/updated" && threadId) {
    const tokenUsage = asRecord(params.tokenUsage);
    const total = asRecord(tokenUsage.total);
    return [live(threadId, "metric_updated", "Token usage 已更新", {
      metric: {
        inputTokens: numberValue(total.inputTokens) || 0,
        outputTokens: numberValue(total.outputTokens) || 0,
        contextWindow: numberValue(tokenUsage.modelContextWindow),
        updatedAt: at.toISOString()
      }
    })];
  }

  if (method === "account/rateLimits/updated") {
    const rateLimits = asRecord(params.rateLimits);
    const primary = asRecord(rateLimits.primary);
    const secondary = asRecord(rateLimits.secondary);
    const credits = asRecord(rateLimits.credits);
    return [{
      persistent: false,
      event: {
        type: "rate_limit_updated",
        message: "Codex rate limit 已更新",
        payload: {
          kind: "rate_limit",
          rateLimits: {
            limitName: nullableString(rateLimits.limitName),
            primaryUsedPercent: numberValue(primary.usedPercent),
            secondaryUsedPercent: numberValue(secondary.usedPercent),
            resetsAt: unixSecondsToIso(numberValue(primary.resetsAt)),
            creditsBalance: nullableString(credits.balance)
          }
        }
      }
    }];
  }

  if (method === "warning" || method === "guardianWarning" || method === "configWarning") {
    const message = stringValue(params.message) || stringValue(params.warning) || "Codex warning";
    if (isNonBlockingWarning(message)) return [];
    return [{
      sessionId: threadId || undefined,
      persistent: true,
      event: { sessionId: threadId || undefined, type: "warning", message, payload: { method } }
    }];
  }

  if (method === "error" && threadId) {
    const error = asRecord(params.error);
    return [persistent(threadId, "error", stringValue(error.message) || "Codex error", { method, willRetry: Boolean(params.willRetry) })];
  }

  return [];
}

function isSubagentMethod(method: string) {
  const normalized = method.toLowerCase();
  return normalized.includes("subagent") || normalized.includes("spawn_agent") || normalized.includes("wait_agent");
}

function subagentTraceText(method: string, params: Record<string, unknown>) {
  const agentType = stringValue(params.agentType) || stringValue(params.agent_type) || stringValue(params.type) || "subagent";
  const status = stringValue(params.status) || stringValue(params.state) || stringValue(params.phase) || "updated";
  const name = stringValue(params.name) || stringValue(params.agentName) || stringValue(params.agentId) || stringValue(params.id);
  const summary = stringValue(params.summary) || stringValue(params.message) || stringValue(params.delta) || stringValue(params.output);
  const lines = [
    `Subagent trace: ${status}`,
    `method: ${method}`,
    `agent: ${name || agentType}`,
    name && agentType !== name ? `type: ${agentType}` : null,
    summary ? `summary: ${summary}` : null,
    `raw: ${safeJson(params)}`
  ].filter(Boolean);
  return `${lines.join("\n")}\n`;
}

function subagentTraceMessage(sessionId: string, itemId: string, method: string, params: Record<string, unknown>, createdAt: string): Message {
  return {
    id: itemId,
    sessionId,
    role: "tool",
    createdAt,
    providerItemRef: itemId,
    blocks: [
      { type: "subagent_trace", trace: subagentTraceFromParams(itemId, method, params) },
      { type: "text", text: subagentTraceText(method, params) }
    ]
  };
}

function subagentTraceFromParams(itemId: string, method: string, params: Record<string, unknown>): SubagentTrace {
  const agentType = stringValue(params.agentType) || stringValue(params.agent_type) || stringValue(params.type) || "subagent";
  const name = stringValue(params.name) || stringValue(params.agentName) || stringValue(params.agentId) || stringValue(params.id) || agentType;
  return {
    id: itemId,
    status: stringValue(params.status) || stringValue(params.state) || stringValue(params.phase) || "updated",
    agentName: name,
    agentId: stringValue(params.agentId) || stringValue(params.id) || undefined,
    agentType,
    method,
    summary: stringValue(params.summary) || stringValue(params.message) || stringValue(params.delta) || stringValue(params.output) || undefined,
    raw: params,
    interaction: {
      supported: false,
      reason: "当前 Codex provider 只提供 Subagent trace 通知；继续交互需要 provider 暴露 Subagent channel 或 continuation API。",
      actions: [{ id: "open_detail", label: "查看详情", enabled: true }]
    }
  };
}

function isNonBlockingWarning(message: string) {
  const normalized = message.toLowerCase();
  return [
    "failed to warm featured plugin ids cache",
    "failed to send remote plugin sync request",
    "failed to open state db",
    "table threads already exists"
  ].some((pattern) => normalized.includes(pattern));
}

function safeJson(value: unknown) {
  try {
    const text = JSON.stringify(value);
    return text.length > 4000 ? `${text.slice(0, 4000)}...` : text;
  } catch {
    return "{}";
  }
}

function live(
  sessionId: string,
  type: VspEvent["type"],
  message: string,
  patch: Omit<LiveSessionPatch, "kind">,
  persistent = false,
  refreshSession = false
): CodexMappedNotification {
  return {
    sessionId,
    persistent,
    refreshSession,
    event: {
      sessionId,
      type,
      message,
      payload: { kind: "live_session_patch", ...patch }
    },
    patch: { kind: "live_session_patch", ...patch }
  };
}

function persistent(sessionId: string, type: VspEvent["type"], message: string, payload: Record<string, unknown>): CodexMappedNotification {
  return {
    sessionId,
    persistent: true,
    event: { sessionId, type, message, payload }
  };
}

function mapThreadStatus(value: unknown): SessionStatus {
  const status = asRecord(value);
  const type = stringValue(status.type);
  if (type === "active") return "running";
  if (type === "systemError") return "error";
  if (type === "idle" || type === "notLoaded") return "idle";
  return "idle";
}

function statusLabel(status: SessionStatus) {
  const labels: Record<SessionStatus, string> = {
    idle: "空闲",
    running: "运行中",
    queued: "排队",
    waiting_approval: "等待审批",
    interrupted: "已中断",
    done: "已完成",
    error: "错误"
  };
  return labels[status];
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function nullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function unixSecondsToIso(value: number | undefined) {
  return typeof value === "number" && value > 0 ? new Date(value * 1000).toISOString() : null;
}

function stableHash(value: string) {
  let hash = 5381;
  for (const char of value) hash = ((hash << 5) + hash + char.charCodeAt(0)) >>> 0;
  return hash.toString(36);
}

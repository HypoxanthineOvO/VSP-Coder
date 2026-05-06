import { basename } from "node:path";
import type { Message, Metric, Project, Role, Session, SessionStatus } from "@vsp-coder/protocol";
import type { CodexAppServerManager } from "./codex.js";
import { artifactsFromCodexItem } from "./codexArtifacts.js";

type CodexThreadStatus = "idle" | "running" | "waiting_for_input" | "archived" | "unknown" | string;

export type CodexThread = {
  id: string;
  preview: string;
  modelProvider: string;
  createdAt: number;
  updatedAt: number;
  status: CodexThreadStatus;
  path: string | null;
  cwd: string;
  cliVersion: string;
  name: string | null;
  turns?: unknown[];
};

type CodexTurn = {
  id: string;
  items: CodexThreadItem[];
  status: "completed" | "interrupted" | "failed" | "inProgress";
  startedAt: number | null;
  completedAt: number | null;
  durationMs: number | null;
};

export type CodexThreadItem =
  | { type: "userMessage"; id: string; content: Array<{ type: "text"; text: string } | Record<string, unknown>> }
  | { type: "agentMessage"; id: string; text: string }
  | { type: "plan"; id: string; text: string }
  | { type: "reasoning"; id: string; summary: string[]; content: string[] }
  | { type: "commandExecution"; id: string; command: string; aggregatedOutput: string | null; status: string }
  | { type: "fileChange"; id: string; status: string }
  | { type: "subagent"; id: string; agentName?: string; agentId?: string; status?: string; summary?: string }
  | { type: "unknownItem"; id: string };

type ThreadListResponse = {
  data: CodexThread[];
  nextCursor: string | null;
};

export type CodexDiscoverySnapshot = {
  projects: Project[];
  sessions: Session[];
};

export async function discoverCodexState(codex: CodexAppServerManager, limit = 50): Promise<CodexDiscoverySnapshot> {
  const response = await codex.request<ThreadListResponse>("thread/list", {
    limit,
    sortKey: "updated_at",
    sortDirection: "desc",
    archived: false
  }, 10_000);
  return mapThreadsToVsp(response.data || []);
}

export async function readCodexSession(codex: CodexAppServerManager, threadId: string): Promise<Session> {
  const response = await codex.request<{ thread: CodexThread }>("thread/read", {
    threadId,
    includeTurns: true
  }, 20_000);
  const snapshot = mapThreadsToVsp([response.thread]);
  const session = snapshot.sessions[0];
  if (!session) throw new Error(`Codex thread has no cwd: ${threadId}`);
  const turns = response.thread.turns as CodexTurn[] | undefined;
  session.messages = messagesFromTurns(response.thread.id, turns);
  session.artifacts = artifactsFromTurns(response.thread.id, turns);
  session.currentTurnId = activeTurnId(turns);
  return session;
}

export function mapThreadToVspSession(thread: CodexThread): Session {
  const snapshot = mapThreadsToVsp([thread]);
  const session = snapshot.sessions[0];
  if (!session) throw new Error(`Codex thread has no cwd: ${thread.id}`);
  return session;
}

export function mapThreadsToVsp(threads: CodexThread[]): CodexDiscoverySnapshot {
  const projectMap = new Map<string, Project>();
  const sessions = threads
    .filter((thread) => typeof thread.cwd === "string" && thread.cwd.length > 0)
    .map((thread) => {
      const project = projectFromCwd(thread.cwd);
      projectMap.set(project.id, project);
      return sessionFromThread(thread, project.id);
    });

  const projects = [...projectMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  return { projects, sessions };
}

function projectFromCwd(cwd: string): Project {
  const name = basename(cwd) || cwd;
  return {
    id: `codex-${stableHash(cwd)}`,
    name,
    path: cwd,
    color: colorFrom(cwd),
    status: "active"
  };
}

function sessionFromThread(thread: CodexThread, projectId: string): Session {
  const createdAt = fromUnixSeconds(thread.createdAt);
  const updatedAt = fromUnixSeconds(thread.updatedAt);
  return {
    id: thread.id,
    projectId,
    provider: "codex",
    title: thread.name || firstLine(thread.preview) || `Codex ${thread.id.slice(0, 8)}`,
    status: mapStatus(thread.status),
    model: "codex-default",
    reasoning: "xhigh",
    cwd: thread.cwd,
    runnerOwner: "codex-app-server",
    automationProfile: "full_auto",
    sandbox: "danger-full-access",
    approvalPolicy: "never",
    queue: [],
    messages: [],
    cards: [],
    artifacts: [],
    metric: emptyMetric(createdAt, updatedAt),
    createdAt,
    updatedAt
  };
}

export function messagesFromTurns(sessionId: string, turns: CodexTurn[] = []): Message[] {
  return turns.flatMap((turn) => {
    const createdAt = fromUnixSeconds(turn.startedAt || turn.completedAt || 0);
      return (turn.items || []).flatMap((item) => messageFromCodexItem(sessionId, item, createdAt));
  });
}

export function artifactsFromTurns(sessionId: string, turns: CodexTurn[] = []) {
  return turns.flatMap((turn) => (turn.items || []).flatMap((item) => artifactsFromCodexItem(sessionId, item)));
}

export function messageFromCodexItem(sessionId: string, item: unknown, createdAt: string): Message[] {
  const record = asRecord(item);
  const type = stringValue(record.type);
  const id = itemId(record);
  if (isSubagentItem(record)) return [textMessage(sessionId, "tool", subagentItemText(record), id, createdAt)];
  if (type === "userMessage") {
    const text = arrayValue(record.content)
      .map((content) => {
        const contentRecord = asRecord(content);
        return stringValue(contentRecord.type) === "text" ? stringValue(contentRecord.text) : "";
      })
      .filter(Boolean)
      .join("\n");
    return text ? [textMessage(sessionId, "user", text, id, createdAt)] : [];
  }
  if (type === "agentMessage") return [textMessage(sessionId, "assistant", stringValue(record.text), id, createdAt)];
  if (type === "plan") return [textMessage(sessionId, "assistant", stringValue(record.text), id, createdAt)];
  if (type === "reasoning") {
    const text = [...arrayValue(record.summary), ...arrayValue(record.content)].map(String).join("\n");
    return text ? [textMessage(sessionId, "assistant", text, id, createdAt)] : [];
  }
  if (type === "commandExecution") {
    const output = stringValue(record.aggregatedOutput) ? `\n\n${stringValue(record.aggregatedOutput)}` : "";
    return [textMessage(sessionId, "tool", `$ ${stringValue(record.command)}\n${stringValue(record.status)}${output}`, id, createdAt)];
  }
  if (type === "fileChange") return [textMessage(sessionId, "tool", `File change: ${stringValue(record.status)}`, id, createdAt)];
  return [];
}

function isSubagentItem(item: Record<string, unknown>) {
  const text = [
    stringValue(item.type),
    stringValue(item.name),
    stringValue(item.toolName),
    stringValue(item.title)
  ].join(" ").toLowerCase();
  return text.includes("subagent") || text.includes("spawn_agent") || text.includes("wait_agent");
}

function subagentItemText(item: Record<string, unknown>) {
  const type = stringValue(item.type) || "subagent";
  const name = stringValue(item.name) || stringValue(item.agentName) || stringValue(item.agentId) || itemId(item);
  const status = stringValue(item.status) || stringValue(item.state) || "completed";
  const summary = stringValue(item.summary) || stringValue(item.text) || stringValue(item.output);
  return [
    `Subagent trace: ${status}`,
    `item: ${type}`,
    `agent: ${name}`,
    summary ? `summary: ${summary}` : null,
    `raw: ${safeJson(item)}`
  ].filter(Boolean).join("\n");
}

function itemId(item: Record<string, unknown>) {
  return stringValue(item.id) || `subagent-${stableHash(safeJson(item))}`;
}

function textMessage(sessionId: string, role: Role, text: string, id: string, createdAt: string): Message {
  return {
    id,
    sessionId,
    role,
    createdAt,
    providerItemRef: id,
    blocks: [{ type: "text", text }]
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function safeJson(value: unknown) {
  try {
    const text = JSON.stringify(value);
    return text.length > 4000 ? `${text.slice(0, 4000)}...` : text;
  } catch {
    return "{}";
  }
}

function mapStatus(status: CodexThreadStatus): SessionStatus {
  if (status === "running") return "running";
  if (status === "waiting_for_input") return "waiting_approval";
  if (status === "archived") return "done";
  if (status === "idle") return "idle";
  return "idle";
}

function activeTurnId(turns: CodexTurn[] = []) {
  return turns.find((turn) => turn.status === "inProgress")?.id;
}

function emptyMetric(startedAt: string, updatedAt: string): Metric {
  return {
    inputTokens: 0,
    outputTokens: 0,
    costUsdEstimate: 0,
    startedAt,
    updatedAt
  };
}

function fromUnixSeconds(value: number) {
  if (!Number.isFinite(value) || value <= 0) return new Date().toISOString();
  return new Date(value * 1000).toISOString();
}

function firstLine(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "";
}

function stableHash(value: string) {
  let hash = 5381;
  for (const char of value) hash = ((hash << 5) + hash + char.charCodeAt(0)) >>> 0;
  return hash.toString(36);
}

function colorFrom(value: string) {
  const palette = ["#65d6ff", "#6ee7b7", "#f2bd4b", "#ff8da0", "#a7c7ff", "#c4b5fd", "#5eead4"];
  return palette[parseInt(stableHash(value), 36) % palette.length];
}

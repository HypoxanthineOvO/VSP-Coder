import type { AppError } from "@vsp-coder/protocol";

const secretPatterns = [
  /(authorization|cookie|set-cookie|x-api-key)\s*[:=]\s*(?:Bearer\s+)?[^\s,;]+/gi,
  /(api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,;]+/gi,
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /\/home\/[^\s]+/g
];

export function appErrorFromUnknown(error: unknown, input: {
  statusCode?: number;
  type?: AppError["type"];
  title?: string;
  message?: string;
  requestPath?: string;
  sessionId?: string;
  projectId?: string;
  queueItemId?: string;
  dedupeKey?: string;
  operation?: NonNullable<AppError["target"]>["operation"];
} = {}): AppError {
  const statusCode = input.statusCode || statusFromError(error);
  const rawMessage = error instanceof Error ? error.message : String(error || input.message || "Unknown error");
  const type = input.type || typeForStatus(statusCode);
  return {
    kind: "app_error",
    id: `err-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title: input.title || titleFor(type, statusCode),
    message: input.message || userMessageFor(type, statusCode),
    statusCode,
    technicalDetail: sanitizeErrorDetail(rawMessage),
    retry: retryFor(type, statusCode),
    dedupeKey: input.dedupeKey,
    target: {
      sessionId: input.sessionId,
      projectId: input.projectId,
      queueItemId: input.queueItemId,
      requestPath: input.requestPath,
      operation: input.operation
    },
    createdAt: new Date().toISOString()
  };
}

export function sanitizeErrorDetail(value: string) {
  return value
    .replace(secretPatterns[0], "$1: [redacted]")
    .replace(secretPatterns[1], "$1: [redacted]")
    .replace(secretPatterns[2], "Bearer [redacted]")
    .replace(secretPatterns[3], "[path]")
    .slice(0, 2_000);
}

function statusFromError(error: unknown) {
  if (typeof error === "object" && error && "status" in error) return Number((error as { status: number }).status) || 500;
  return 500;
}

function typeForStatus(statusCode: number): AppError["type"] {
  if (statusCode === 429) return "rate_limit";
  if (statusCode >= 500) return "provider";
  if (statusCode >= 400) return "http";
  return "unknown";
}

function titleFor(type: AppError["type"], statusCode: number) {
  if (type === "rate_limit") return "请求过于频繁";
  if (statusCode === 502) return "上游服务暂不可用";
  if (type === "provider") return "Provider 请求失败";
  if (type === "sse") return "实时连接已断开";
  if (type === "send") return "消息发送失败";
  if (type === "refresh") return "刷新失败";
  return "请求失败";
}

function userMessageFor(type: AppError["type"], statusCode: number) {
  if (type === "rate_limit") return "请求触发限流，请稍后重试。";
  if (statusCode === 502) return "Codex app-server 或上游 provider 暂时不可用，可以稍后重试。";
  if (type === "provider") return "Provider 返回错误，当前页面会保留已有状态。";
  if (type === "sse") return "实时事件流断开，页面会尝试重新连接，也可以手动刷新。";
  if (type === "send") return "消息没有成功发送，草稿已保留。";
  if (type === "refresh") return "刷新没有完成，当前数据可能不是最新。";
  return "请求没有成功完成。";
}

function retryFor(type: AppError["type"], statusCode: number): AppError["retry"] {
  if (type === "rate_limit") return { kind: "retry_request", label: "稍后重试", cooldownMs: 30_000 };
  if (type === "sse") return { kind: "reconnect_sse", label: "重新连接" };
  if (type === "send") return { kind: "retry_send", label: "重试发送" };
  if (type === "refresh") return { kind: "refresh_state", label: "重新刷新" };
  if (statusCode >= 500) return { kind: "retry_request", label: "重试请求" };
  return { kind: "none", label: "无需重试" };
}

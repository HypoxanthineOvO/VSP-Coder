import type {
  AutomationProfile,
  CodexSandboxMode,
  RequestCard,
  SessionActionRequest
} from "@vsp-coder/protocol";

export type JsonRpcId = string | number;

export type CodexServerRequest = {
  id: JsonRpcId;
  method: string;
  params?: unknown;
};

export type CodexRequestStatus = RequestCard["status"];

export type PendingCodexRequest = {
  requestId: JsonRpcId;
  method: string;
  sessionId: string;
  card: RequestCard;
  params: Record<string, unknown>;
};

export type CodexCardResolution = {
  result: unknown;
  status: Exclude<CodexRequestStatus, "open">;
  label: string;
};

export function mapCodexServerRequest(request: CodexServerRequest, at = new Date()): PendingCodexRequest | null {
  const params = asRecord(request.params);
  const sessionId = threadIdFor(request.method, params);
  if (!sessionId) return null;
  const createdAt = at.toISOString();
  const id = cardId(request.id);

  if (request.method === "item/commandExecution/requestApproval") {
    const command = stringValue(params.command) || commandFromArray(params.command) || "(unknown command)";
    const cwd = stringValue(params.cwd);
    const reason = stringValue(params.reason);
    return pending(request, sessionId, {
      id,
      sessionId,
      kind: "approval",
      title: "Codex 请求运行命令",
      body: lines([`命令：${command}`, cwd ? `目录：${cwd}` : null, reason ? `原因：${reason}` : null, actionSummary(params.commandActions)]),
      actions: approvalActions("accept_session"),
      status: "open",
      createdAt
    });
  }

  if (request.method === "execCommandApproval") {
    const command = commandFromArray(params.command) || "(unknown command)";
    const cwd = stringValue(params.cwd);
    const reason = stringValue(params.reason);
    return pending(request, sessionId, {
      id,
      sessionId,
      kind: "approval",
      title: "Codex 请求运行命令",
      body: lines([`命令：${command}`, cwd ? `目录：${cwd}` : null, reason ? `原因：${reason}` : null]),
      actions: approvalActions("accept_session"),
      status: "open",
      createdAt
    });
  }

  if (request.method === "item/fileChange/requestApproval") {
    const reason = stringValue(params.reason);
    const grantRoot = stringValue(params.grantRoot);
    return pending(request, sessionId, {
      id,
      sessionId,
      kind: "approval",
      title: "Codex 请求文件写入权限",
      body: lines([reason ? `原因：${reason}` : null, grantRoot ? `授权目录：${grantRoot}` : "Codex 需要继续当前文件变更。"]),
      actions: approvalActions("accept_session"),
      status: "open",
      createdAt
    });
  }

  if (request.method === "applyPatchApproval") {
    const fileChanges = asRecord(params.fileChanges);
    const files = Object.keys(fileChanges);
    const reason = stringValue(params.reason);
    const grantRoot = stringValue(params.grantRoot);
    return pending(request, sessionId, {
      id,
      sessionId,
      kind: "approval",
      title: "Codex 请求应用文件补丁",
      body: lines([
        files.length ? `文件：${files.slice(0, 6).join(", ")}${files.length > 6 ? ` 等 ${files.length} 个` : ""}` : "文件：未提供",
        grantRoot ? `授权目录：${grantRoot}` : null,
        reason ? `原因：${reason}` : null
      ]),
      actions: approvalActions("accept_session"),
      status: "open",
      createdAt
    });
  }

  if (request.method === "item/permissions/requestApproval") {
    const cwd = stringValue(params.cwd);
    const reason = stringValue(params.reason);
    return pending(request, sessionId, {
      id,
      sessionId,
      kind: "approval",
      title: "Codex 请求额外权限",
      body: lines([cwd ? `目录：${cwd}` : null, reason ? `原因：${reason}` : null, permissionSummary(params.permissions)]),
      actions: [
        { id: "grant_turn", label: "允许本轮", tone: "primary" },
        { id: "grant_session", label: "允许本会话", tone: "neutral" },
        { id: "deny", label: "拒绝", tone: "danger" }
      ],
      status: "open",
      createdAt
    });
  }

  if (request.method === "item/tool/requestUserInput") {
    const questions = arrayValue(params.questions).map(asRecord);
    const first = questions[0];
    const actions = userInputActions(first);
    return pending(request, sessionId, {
      id,
      sessionId,
      kind: "user_input",
      title: stringValue(first?.header) || "Codex 请求用户输入",
      body: lines(questions.map((question) => questionText(question))),
      actions,
      status: "open",
      createdAt
    });
  }

  if (request.method === "mcpServer/elicitation/request") {
    const mode = stringValue(params.mode);
    const message = stringValue(params.message) || "MCP server 请求用户确认。";
    const serverName = stringValue(params.serverName);
    const url = stringValue(params.url);
    return pending(request, sessionId, {
      id,
      sessionId,
      kind: "user_input",
      title: serverName ? `MCP 请求：${serverName}` : "MCP 请求用户输入",
      body: lines([message, mode === "url" && url ? `URL：${url}` : null]),
      actions: [
        { id: "accept", label: "接受", tone: "primary" },
        { id: "decline", label: "拒绝", tone: "danger" },
        { id: "cancel", label: "取消", tone: "neutral" }
      ],
      status: "open",
      createdAt
    });
  }

  return null;
}

export function codexResponseForAction(pending: PendingCodexRequest, action: Pick<SessionActionRequest, "actionId">): CodexCardResolution {
  const actionId = action.actionId || "cancel";
  const status = statusForAction(actionId);
  if (pending.method === "item/commandExecution/requestApproval") {
    return { result: { decision: commandDecision(actionId) }, status, label: labelForAction(actionId) };
  }
  if (pending.method === "execCommandApproval") {
    return { result: { decision: legacyDecision(actionId) }, status, label: labelForAction(actionId) };
  }
  if (pending.method === "item/fileChange/requestApproval") {
    return { result: { decision: fileDecision(actionId) }, status, label: labelForAction(actionId) };
  }
  if (pending.method === "applyPatchApproval") {
    return { result: { decision: legacyDecision(actionId) }, status, label: labelForAction(actionId) };
  }
  if (pending.method === "item/permissions/requestApproval") {
    return { result: permissionsResponse(pending.params, actionId), status, label: labelForAction(actionId) };
  }
  if (pending.method === "item/tool/requestUserInput") {
    return { result: userInputResponse(pending.params, actionId), status, label: labelForAction(actionId) };
  }
  if (pending.method === "mcpServer/elicitation/request") {
    const result = { action: mcpAction(actionId), content: actionId === "accept" ? {} : null, _meta: null };
    return { result, status, label: labelForAction(actionId) };
  }
  return { result: null, status: "failed", label: "不支持" };
}

export function autoResolutionFor(pending: PendingCodexRequest): CodexCardResolution | null {
  if (pending.card.kind !== "approval") return null;
  const actionId = pending.method === "item/permissions/requestApproval" ? "grant_session" : "accept_session";
  return codexResponseForAction(pending, { actionId });
}

export function shouldAutoResolveRequest(pending: PendingCodexRequest, profile: AutomationProfile | undefined) {
  return profile?.id === "full_auto" && pending.card.kind === "approval";
}

export function threadStartOverrides(profile: AutomationProfile | undefined) {
  return {
    approvalPolicy: profile?.approvalPolicy || "never",
    approvalsReviewer: profile?.approvalsReviewer || "user",
    sandbox: profile?.sandbox || "danger-full-access"
  };
}

export function turnStartOverrides(profile: AutomationProfile | undefined, cwd: string | undefined) {
  return {
    approvalPolicy: profile?.approvalPolicy || "never",
    approvalsReviewer: profile?.approvalsReviewer || "user",
    sandboxPolicy: sandboxPolicy(profile?.sandbox || "danger-full-access", cwd)
  };
}

export function sandboxPolicy(mode: CodexSandboxMode, cwd: string | undefined) {
  if (mode === "danger-full-access") return { type: "dangerFullAccess" };
  if (mode === "read-only") return { type: "readOnly", networkAccess: true };
  return {
    type: "workspaceWrite",
    writableRoots: cwd ? [cwd] : [],
    networkAccess: true,
    excludeTmpdirEnvVar: false,
    excludeSlashTmp: false
  };
}

function pending(request: CodexServerRequest, sessionId: string, card: RequestCard): PendingCodexRequest {
  return {
    requestId: request.id,
    method: request.method,
    sessionId,
    card,
    params: asRecord(request.params)
  };
}

function approvalActions(sessionActionId: string): RequestCard["actions"] {
  return [
    { id: "accept", label: "允许一次", tone: "primary" },
    { id: sessionActionId, label: "本会话允许", tone: "neutral" },
    { id: "decline", label: "拒绝", tone: "danger" },
    { id: "cancel", label: "取消", tone: "neutral" }
  ];
}

function userInputActions(question: Record<string, unknown> | undefined): RequestCard["actions"] {
  const options = arrayValue(question?.options).map(asRecord);
  if (options.length) {
    return [
      ...options.slice(0, 3).map((option) => ({
        id: `answer:${encodeURIComponent(stringValue(option.label) || "")}`,
        label: stringValue(option.label) || "选择",
        tone: "primary" as const
      })),
      { id: "cancel", label: "取消", tone: "neutral" as const }
    ];
  }
  return [
    { id: "submit", label: "提交默认回答", tone: "primary" },
    { id: "cancel", label: "取消", tone: "neutral" }
  ];
}

function commandDecision(actionId: string) {
  if (actionId === "accept_session") return "acceptForSession";
  if (actionId === "decline" || actionId === "deny") return "decline";
  if (actionId === "cancel") return "cancel";
  return "accept";
}

function fileDecision(actionId: string) {
  if (actionId === "accept_session") return "acceptForSession";
  if (actionId === "decline" || actionId === "deny") return "decline";
  if (actionId === "cancel") return "cancel";
  return "accept";
}

function legacyDecision(actionId: string) {
  if (actionId === "accept_session") return "approved_for_session";
  if (actionId === "decline" || actionId === "deny") return "denied";
  if (actionId === "cancel") return "abort";
  return "approved";
}

function permissionsResponse(params: Record<string, unknown>, actionId: string) {
  if (actionId === "grant_turn" || actionId === "grant_session" || actionId === "accept") {
    return {
      permissions: asRecord(params.permissions),
      scope: actionId === "grant_session" ? "session" : "turn"
    };
  }
  return {
    permissions: {},
    scope: "turn",
    strictAutoReview: true
  };
}

function userInputResponse(params: Record<string, unknown>, actionId: string) {
  const selected = actionId.startsWith("answer:") ? decodeURIComponent(actionId.slice("answer:".length)) : null;
  const answers: Record<string, { answers: string[] }> = {};
  for (const question of arrayValue(params.questions).map(asRecord)) {
    const id = stringValue(question.id);
    if (!id) continue;
    const options = arrayValue(question.options).map(asRecord);
    const fallback = stringValue(options[0]?.label) || "";
    answers[id] = { answers: actionId === "cancel" ? [] : [selected || fallback] };
  }
  return { answers };
}

function mcpAction(actionId: string) {
  if (actionId === "decline" || actionId === "deny") return "decline";
  if (actionId === "cancel") return "cancel";
  return "accept";
}

function statusForAction(actionId: string): Exclude<CodexRequestStatus, "open"> {
  if (actionId === "decline" || actionId === "deny") return "denied";
  if (actionId === "cancel") return "expired";
  return "resolved";
}

function labelForAction(actionId: string) {
  if (actionId === "accept_session") return "本会话允许";
  if (actionId === "grant_turn") return "允许本轮";
  if (actionId === "grant_session") return "允许本会话";
  if (actionId === "decline" || actionId === "deny") return "拒绝";
  if (actionId === "cancel") return "取消";
  if (actionId.startsWith("answer:")) return "已回答";
  return "允许";
}

function threadIdFor(method: string, params: Record<string, unknown>) {
  if (method === "execCommandApproval" || method === "applyPatchApproval") return stringValue(params.conversationId);
  return stringValue(params.threadId);
}

function cardId(id: JsonRpcId) {
  return `codex-request-${String(id).replace(/[^a-zA-Z0-9_.:-]/g, "_")}`;
}

function commandFromArray(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value.map((item) => String(item)).join(" ");
}

function actionSummary(value: unknown) {
  const actions = arrayValue(value).map(asRecord);
  if (!actions.length) return null;
  return `动作：${actions.map((action) => stringValue(action.type) || "unknown").join(", ")}`;
}

function permissionSummary(value: unknown) {
  const permissions = asRecord(value);
  const network = asRecord(permissions.network);
  const fileSystem = asRecord(permissions.fileSystem);
  const parts = [
    typeof network.enabled === "boolean" ? `网络：${network.enabled ? "启用" : "禁用"}` : null,
    arraySummary("读", fileSystem.read),
    arraySummary("写", fileSystem.write)
  ].filter(Boolean);
  return parts.length ? `权限：${parts.join("；")}` : "权限：未提供详细项";
}

function arraySummary(label: string, value: unknown) {
  const values = arrayValue(value).map(String);
  if (!values.length) return null;
  return `${label} ${values.slice(0, 3).join(", ")}${values.length > 3 ? ` 等 ${values.length} 项` : ""}`;
}

function questionText(question: Record<string, unknown>) {
  const prompt = stringValue(question.question) || stringValue(question.header) || "需要输入";
  const options = arrayValue(question.options).map(asRecord).map((option) => stringValue(option.label)).filter(Boolean);
  return options.length ? `${prompt} 选项：${options.join(" / ")}` : prompt;
}

function lines(parts: Array<string | null | undefined>) {
  return parts.filter((part): part is string => Boolean(part)).join("\n");
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : "";
}

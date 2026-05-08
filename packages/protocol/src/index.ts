export type ProviderKind = "mock" | "codex" | "opencode" | "claude";

export type DeploymentMode = "local" | "release";

export type DataMode = "codex" | "dev-test";

export type AutomationProfileId = "full_auto" | "workspace_auto" | "manual";

export type CodexApprovalPolicy = "never" | "on-failure" | "on-request" | "untrusted";

export type CodexSandboxMode = "read-only" | "workspace-write" | "danger-full-access";

export type CodexApprovalsReviewer = "user" | "auto_review" | "guardian_subagent";

export type ProviderHealthStatus = "stopped" | "starting" | "ready" | "unavailable" | "crashed";

export type CodexProviderHealth = {
  provider: "codex";
  status: ProviderHealthStatus;
  transport: "stdio";
  pid?: number;
  userAgent?: string;
  codexHome?: string;
  platformFamily?: string;
  platformOs?: string;
  initializedAt?: string;
  lastError?: string;
  lastExit?: {
    code: number | null;
    signal: string | null;
    at: string;
  };
};

export type AutomationProfile = {
  id: AutomationProfileId;
  label: string;
  description: string;
  approvalPolicy: CodexApprovalPolicy;
  sandbox: CodexSandboxMode;
  approvalsReviewer: CodexApprovalsReviewer;
};

export type AppConfig = {
  deploymentMode: DeploymentMode;
  dataMode: DataMode;
  automationProfile: AutomationProfileId;
  profiles: AutomationProfile[];
  configPath: string;
  updatedAt: string;
};

export type SessionStatus = "idle" | "running" | "queued" | "waiting_approval" | "interrupted" | "done" | "error";

export type Role = "user" | "assistant" | "system" | "tool";

export type TokenKind = "skill" | "command" | "file";

export type StructuredToken = {
  id: string;
  kind: TokenKind;
  label: string;
  value: string;
  path?: string;
  description?: string;
  risk?: "safe" | "confirm" | "danger";
};

export type SubagentTrace = {
  id: string;
  status: "requested" | "running" | "completed" | "failed" | "not_observed" | "updated" | string;
  agentName: string;
  agentId?: string;
  agentType?: string;
  method?: string;
  summary?: string;
  raw?: unknown;
  interaction: {
    supported: boolean;
    reason: string;
    actions: Array<{ id: string; label: string; enabled: boolean }>;
  };
};

export type MessageBlock =
  | { type: "text"; text: string }
  | { type: "subagent_trace"; trace: SubagentTrace }
  | { type: "tokens"; tokens: StructuredToken[] }
  | { type: "attachment"; name: string; mime: string; status: "mocked" | "ready" };

export type Message = {
  id: string;
  sessionId: string;
  role: Role;
  blocks: MessageBlock[];
  createdAt: string;
  providerItemRef?: string;
  clientMutationId?: string;
  deliveryState?: "pending" | "sent" | "confirmed" | "cancelled" | "failed";
};

export type QueueItem = {
  id: string;
  text: string;
  tokens: StructuredToken[];
  createdAt: string;
  state: "pending" | "sent" | "cleared";
};

export type RequestCardKind = "approval" | "user_input" | "settings" | "danger_confirm";

export type RequestCard = {
  id: string;
  sessionId: string;
  kind: RequestCardKind;
  title: string;
  body: string;
  actions: Array<{ id: string; label: string; tone?: "primary" | "neutral" | "danger" }>;
  status: "open" | "resolved" | "denied" | "failed" | "expired";
  createdAt: string;
  resolvedAt?: string;
};

export type Artifact = {
  id: string;
  sessionId: string;
  kind?: "command" | "file" | "diff" | "preview";
  title: string;
  path?: string;
  mime?: string;
  status?: "running" | "completed" | "failed" | "declined" | "changed" | "unsupported";
  body?: string;
  previewStatus: "placeholder" | "renderable" | "unsupported";
};

export type Metric = {
  inputTokens: number;
  outputTokens: number;
  costUsdEstimate: number;
  startedAt?: string;
  durationMs?: number;
  contextWindow?: number | null;
  rateLimits?: {
    limitName?: string | null;
    primaryUsedPercent?: number | null;
    secondaryUsedPercent?: number | null;
    resetsAt?: string | null;
    creditsBalance?: string | null;
  };
  updatedAt: string;
};

export type VspEventType =
  | "session_updated"
  | "message_added"
  | "queue_updated"
  | "card_opened"
  | "card_resolved"
  | "runner_interrupt_requested"
  | "workflow_updated"
  | "qa_updated"
  | "metric_updated"
  | "rate_limit_updated"
  | "warning"
  | "error";

export type VspEvent = {
  id: string;
  sessionId?: string;
  projectId?: string;
  type: VspEventType;
  message: string;
  createdAt: string;
  payload?: unknown;
};

export type AppErrorType =
  | "http"
  | "rate_limit"
  | "provider"
  | "sse"
  | "send"
  | "refresh"
  | "queue"
  | "unknown";

export type AppErrorRetryKind = "none" | "retry_request" | "retry_send" | "refresh_state" | "reconnect_sse" | "retry_queue";

export type AppError = {
  kind: "app_error";
  id: string;
  type: AppErrorType;
  title: string;
  message: string;
  statusCode?: number;
  technicalDetail?: string;
  retry: {
    kind: AppErrorRetryKind;
    label: string;
    cooldownMs?: number;
  };
  dedupeKey?: string;
  target?: {
    sessionId?: string;
    projectId?: string;
    messageId?: string;
    queueItemId?: string;
    requestPath?: string;
    operation?: "send_message" | "switch_model" | "rename_session" | "create_session" | "refresh_state" | "reconnect_sse";
    text?: string;
    tokens?: StructuredToken[];
  };
  createdAt: string;
};

export type Session = {
  id: string;
  projectId: string;
  provider: ProviderKind;
  title: string;
  status: SessionStatus;
  model: string;
  reasoning: string;
  cwd: string;
  runnerOwner: string;
  automationProfile?: AutomationProfileId;
  sandbox?: CodexSandboxMode;
  approvalPolicy?: CodexApprovalPolicy;
  currentTurnId?: string;
  queue: QueueItem[];
  messages: Message[];
  cards: RequestCard[];
  artifacts: Artifact[];
  metric: Metric;
  createdAt: string;
  updatedAt: string;
};

export type Project = {
  id: string;
  name: string;
  path: string;
  color: string;
  status: "active" | "idle" | "missing";
};

export type ModelOption = {
  provider: ProviderKind;
  model: string;
  label: string;
  reasoning: string[];
  status: "available" | "mock" | "unavailable";
  note?: string;
};

export type CompletionItem = StructuredToken & {
  group: "Skills" | "Commands" | "Files";
};

export type WorkflowFile = {
  path: string;
  title: string;
  exists: boolean;
  summary: string;
  content?: string;
  error?: string;
};

export type WorkflowMilestone = {
  id: string;
  name: string;
  status: "pending" | "running" | "complete" | "blocked" | "unknown";
  promptFile?: string;
  current: boolean;
};

export type WorkflowConfigItem = {
  id: string;
  label: string;
  value: string;
  description: string;
  editable: boolean;
  choices?: string[];
};

export type WorkflowSnapshot = {
  project: Project;
  hasWorkflow: boolean;
  files: WorkflowFile[];
  phase?: string;
  currentPrompt?: string | null;
  milestoneCount: number;
  milestones: WorkflowMilestone[];
  configItems: WorkflowConfigItem[];
  compactPlan: string;
  architectureRef?: WorkflowFile;
  knowledgeRoot: string;
  knowledgeRefs: string[];
};

export type QaItem = {
  id: string;
  label: string;
  status: "pending" | "pass" | "fail";
  notes?: string;
};

export type QaRun = {
  id: string;
  sessionId: string;
  title: string;
  status: "idle" | "running" | "complete";
  items: QaItem[];
  createdAt: string;
  updatedAt: string;
};

export type VspState = {
  config: AppConfig;
  defaultProjectId?: string;
  projects: Project[];
  sessions: Session[];
  events: VspEvent[];
  qaRuns: QaRun[];
};

export type SendMessageRequest = {
  text: string;
  tokens?: StructuredToken[];
};

export type CreateSessionRequest = {
  projectId: string;
};

export type SessionActionRequest = {
  type:
    | "refresh_state"
    | "open_search"
    | "open_resource"
    | "clear_queue"
    | "interrupt"
    | "upload_image_mock"
    | "upload_file_mock"
    | "rename_session"
    | "switch_model"
    | "switch_model_mock"
    | "card_action"
    | "qa_item_update"
    | "qa_complete"
    | "workflow_check"
    | "workflow_sync"
    | "config_update";
  cardId?: string;
  actionId?: string;
  qaRunId?: string;
  qaItemId?: string;
  qaStatus?: QaItem["status"];
  provider?: ProviderKind;
  model?: string;
  reasoning?: string;
  configId?: string;
  value?: string;
};

export type UpdateAppConfigRequest = Partial<Pick<AppConfig, "deploymentMode" | "dataMode" | "automationProfile">>;

export function textMessage(sessionId: string, role: Role, text: string, id: string, createdAt: string): Message {
  return { id, sessionId, role, createdAt, blocks: [{ type: "text", text }] };
}

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  Artifact,
  CompletionItem,
  CreateSessionRequest,
  ModelOption,
  Project,
  ProviderKind,
  QaRun,
  RequestCard,
  SendMessageRequest,
  Session,
  SessionActionRequest,
  VspEvent,
  VspState,
  WorkflowConfigItem,
  WorkflowFile,
  WorkflowMilestone,
  WorkflowSnapshot
} from "@vsp-coder/protocol";

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const storeFile = join(projectRoot, ".vsp-coder", "mock-store", "state.json");

type Subscriber = (event: VspEvent) => void;

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const baseProject: Project = {
  id: "vsp-coder",
  name: "VSP-Coder",
  path: projectRoot,
  color: "#65d6ff",
  status: "active"
};

const otherProjects: Project[] = [
  { id: "hypo-workflow", name: "Hypo-Workflow", path: "/home/heyx/Hypo-Workflow", color: "#7c83ff", status: "idle" },
  { id: "vsp-framework", name: "VSP-Framework", path: "/home/heyx/VSP-Framework", color: "#f7b500", status: "idle" },
  { id: "hypo-agent", name: "Hypo-Agent", path: "/home/heyx/Hypo-Agent", color: "#45e0c2", status: "idle" }
];

const modelOptions: ModelOption[] = [
  { provider: "codex", model: "gpt-5.5", label: "Codex · gpt-5.5", reasoning: ["xhigh", "high", "medium"], status: "mock", note: "当前会话映射" },
  { provider: "codex", model: "codex-default", label: "Codex 默认", reasoning: ["xhigh", "high", "medium"], status: "mock", note: "沿用 Codex 默认配置" },
  { provider: "opencode", model: "opencode-default", label: "OpenCode 默认", reasoning: ["high", "medium"], status: "mock", note: "Provider 映射占位" },
  { provider: "claude", model: "claude-sonnet", label: "Claude Code · Sonnet", reasoning: ["high", "medium"], status: "mock", note: "Provider 映射占位" }
];

function seedState(): VspState {
  const createdAt = now();
  const session: Session = {
    id: "mock-main",
    projectId: baseProject.id,
    provider: "mock",
    title: "Saved Hypo-Workflow Mock Session",
    status: "idle",
    model: "Codex 默认",
    reasoning: "xhigh",
    cwd: projectRoot,
    runnerOwner: "mock-user",
    queue: [],
    messages: [
      {
        id: "msg-welcome",
        sessionId: "mock-main",
        role: "assistant",
        createdAt,
        blocks: [
          {
            type: "text",
            text: "欢迎来到 VSP-Coder 工作台。当前服务运行在本机 runtime，用于验证 Project、Session、Workflow 和待处理交互。"
          }
        ]
      }
    ],
    cards: [],
    artifacts: [
      {
        id: "artifact-arch",
        sessionId: "mock-main",
        title: "Architecture Baseline",
        path: ".pipeline/architecture.md",
        mime: "text/markdown",
        previewStatus: "placeholder"
      }
    ],
    metric: {
      inputTokens: 1280,
      outputTokens: 512,
      costUsdEstimate: 0.04,
      startedAt: createdAt,
      updatedAt: createdAt
    },
    createdAt,
    updatedAt: createdAt
  };

  return {
    projects: [baseProject, ...otherProjects],
    sessions: [session],
    events: [
      {
        id: "event-welcome",
        sessionId: session.id,
        projectId: baseProject.id,
        type: "session_updated",
        message: "VSP-Coder 会话已恢复",
        createdAt
      }
    ],
    qaRuns: []
  };
}

function ensureStore() {
  mkdirSync(dirname(storeFile), { recursive: true });
}

function loadState(): VspState {
  ensureStore();
  try {
    return JSON.parse(readFileSync(storeFile, "utf8")) as VspState;
  } catch {
    const seeded = seedState();
    saveState(seeded);
    return seeded;
  }
}

function saveState(state: VspState) {
  ensureStore();
  writeFileSync(storeFile, JSON.stringify(state, null, 2), "utf8");
}

export class MockStore {
  private state = loadState();
  private subscribers = new Set<Subscriber>();

  constructor() {
    this.normalizeState();
  }

  snapshot() {
    return this.state;
  }

  subscribe(subscriber: Subscriber) {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  private persist() {
    saveState(this.state);
  }

  private normalizeState() {
    const knownProjects = [baseProject, ...otherProjects];
    for (const project of knownProjects) {
      const existing = this.state.projects.find((item) => item.id === project.id);
      if (existing) Object.assign(existing, project);
      else this.state.projects.push(project);
    }
    const main = this.state.sessions.find((session) => session.id === "mock-main");
    if (main) {
      main.provider = main.provider === "mock" ? "codex" : main.provider;
      main.model = main.model === "Codex 默认" ? "codex-default" : main.model;
      main.reasoning ||= "xhigh";
      main.title = normalizeTitle(main.title, "VSP-Coder 工作台会话");
      main.messages = normalizeMessages(main.messages);
      main.cards = normalizeCards(main.cards);
    }
    if (!this.state.sessions.some((session) => session.id === "mock-mobile")) {
      this.state.sessions.push(mockSession("mock-mobile", baseProject.id, "移动端工作台调整", "waiting_approval", "gpt-5.5", "high", -1000 * 60 * 22));
    }
    if (!this.state.sessions.some((session) => session.id === "mock-workflow")) {
      this.state.sessions.push(mockSession("mock-workflow", baseProject.id, "Workflow 侧栏整理", "interrupted", "opencode-default", "medium", -1000 * 60 * 80));
    }
    this.ensureProjectSession("hypo-workflow", "mock-hypo-workflow", "Hypo-Workflow Cycle 规划", "done", "codex-default", "high", -1000 * 60 * 36);
    this.ensureProjectSession("vsp-framework", "mock-vsp-framework", "VSP Framework 接口梳理", "idle", "claude-sonnet", "medium", -1000 * 60 * 54);
    this.ensureProjectSession("hypo-agent", "mock-hypo-agent", "Hypo Agent Provider 接入", "running", "opencode-default", "medium", -1000 * 60 * 72);
    for (const session of this.state.sessions) {
      session.title = normalizeTitle(session.title, session.title);
      session.messages = normalizeMessages(session.messages);
      session.cards = normalizeCards(session.cards);
    }
    for (const run of this.state.qaRuns) {
      run.title = run.title.replace("C1 Manual QA - 开始测试", "当前会话验收清单");
      run.items = run.items.map((item) => ({
        ...item,
        label: item.label.replace("动作菜单 mock 均有确认消息", "动作菜单均有确认消息")
      }));
    }
    this.state.events = normalizeEvents(this.state.events, this.state.sessions);
    this.persist();
  }

  private ensureProjectSession(
    projectId: string,
    sessionId: string,
    title: string,
    status: Session["status"],
    model: string,
    reasoning: string,
    offsetMs: number
  ) {
    if (!this.state.sessions.some((session) => session.id === sessionId)) {
      this.state.sessions.push(mockSession(sessionId, projectId, title, status, model, reasoning, offsetMs));
    }
  }

  private emit(event: Omit<VspEvent, "id" | "createdAt">) {
    const full: VspEvent = { ...event, id: id("evt"), createdAt: now() };
    this.state.events.unshift(full);
    this.state.events = this.state.events.slice(0, 200);
    this.persist();
    for (const subscriber of this.subscribers) subscriber(full);
    return full;
  }

  private session(sessionId: string) {
    const session = this.state.sessions.find((item) => item.id === sessionId);
    if (!session) throw Object.assign(new Error("Session not found"), { status: 404 });
    return session;
  }

  getSession(sessionId: string) {
    return this.session(sessionId);
  }

  listSessions(projectId?: string) {
    return projectId ? this.state.sessions.filter((session) => session.projectId === projectId) : this.state.sessions;
  }

  modelOptions() {
    return modelOptions;
  }

  createSession(request: CreateSessionRequest) {
    const project = this.state.projects.find((item) => item.id === request.projectId) || baseProject;
    const createdAt = now();
    const session: Session = {
      id: id("session"),
      projectId: project.id,
      provider: "codex",
      title: `新建会话 ${new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      status: "idle",
      model: "codex-default",
      reasoning: "xhigh",
      cwd: project.path,
      runnerOwner: "mock-user",
      queue: [],
      messages: [
        {
          id: id("msg"),
          sessionId: "",
          role: "assistant",
          createdAt,
          blocks: [{ type: "text", text: `已为 ${project.name} 创建新的本机会话。` }]
        }
      ],
      cards: [],
      artifacts: [],
      metric: {
        inputTokens: 0,
        outputTokens: 0,
        costUsdEstimate: 0,
        startedAt: createdAt,
        updatedAt: createdAt
      },
      createdAt,
      updatedAt: createdAt
    };
    session.messages[0].sessionId = session.id;
    this.state.sessions.unshift(session);
    this.emit({ sessionId: session.id, projectId: project.id, type: "session_updated", message: `${session.title} 已创建` });
    this.persist();
    return session;
  }

  sendMessage(sessionId: string, request: SendMessageRequest) {
    const session = this.session(sessionId);
    const createdAt = now();
    session.queue.push({
      id: id("queue"),
      text: request.text,
      tokens: request.tokens || [],
      createdAt,
      state: session.status === "running" ? "pending" : "sent"
    });
    session.messages.push({
      id: id("msg"),
      sessionId,
      role: "user",
      createdAt,
      blocks: [
        { type: "text", text: request.text },
        ...(request.tokens?.length ? [{ type: "tokens" as const, tokens: request.tokens }] : [])
      ]
    });
    session.status = request.text.includes("开始测试") ? "waiting_approval" : "running";
    session.updatedAt = createdAt;

    if (request.text.includes("开始测试")) {
      this.emitTestScript(session);
    } else {
      session.messages.push({
        id: id("msg"),
        sessionId,
        role: "assistant",
        createdAt: now(),
        blocks: [{ type: "text", text: `本机 runtime 已收到：${request.text}` }]
      });
    }
    this.emit({ sessionId, projectId: session.projectId, type: "message_added", message: "消息已发送", payload: { sessionId } });
    return session;
  }

  applyAction(sessionId: string, action: SessionActionRequest) {
    const session = this.session(sessionId);
    const createdAt = now();
    let message = "Action handled";
    let emitted = false;

    if (action.type === "refresh_state") {
      message = "状态已刷新。";
      this.emit({ sessionId, projectId: session.projectId, type: "session_updated", message });
      emitted = true;
    }

    if (action.type === "open_search") {
      message = "搜索面板已打开：命令面板 UI 将在后续版本接入。";
      this.emit({ sessionId, projectId: session.projectId, type: "session_updated", message });
      emitted = true;
    }

    if (action.type === "open_resource") {
      const label = action.value || "resource";
      message = `已打开 ${label} 预览入口。`;
      this.emit({ sessionId, projectId: session.projectId, type: "workflow_updated", message, payload: { resource: label } });
      emitted = true;
    }

    if (action.type === "clear_queue") {
      session.queue = session.queue.map((item) => item.state === "pending" ? { ...item, state: "cleared" } : item);
      message = "已清空待发送队列，当前 runner 未被中断。";
      this.emit({ sessionId, projectId: session.projectId, type: "queue_updated", message });
      emitted = true;
    }

    if (action.type === "interrupt") {
      session.status = "interrupted";
      message = "已请求 Interrupt 当前 mock runner。";
      this.emit({ sessionId, projectId: session.projectId, type: "runner_interrupt_requested", message });
      emitted = true;
    }

    if (action.type === "upload_image_mock") message = "图片已加入当前会话。";
    if (action.type === "upload_file_mock") message = "文件已加入当前会话。";
    if (action.type === "switch_model" || action.type === "switch_model_mock") {
      const option = modelOptions.find((item) =>
        item.provider === (action.provider || session.provider) && item.model === (action.model || action.value)
      ) || modelOptions[0];
      session.provider = option.provider;
      session.model = option.model;
      session.reasoning = action.reasoning || option.reasoning[0] || session.reasoning;
      message = `当前会话模型已切换为 ${option.label} · ${session.reasoning}。`;
      this.emit({ sessionId, projectId: session.projectId, type: "session_updated", message, payload: { provider: session.provider, model: session.model, reasoning: session.reasoning } });
      emitted = true;
    }

    if (action.type === "card_action" && action.cardId) {
      const card = session.cards.find((item) => item.id === action.cardId);
      if (card) {
        card.status = "resolved";
        card.resolvedAt = createdAt;
        message = `卡片「${card.title}」已处理：${action.actionId || "unknown"}`;
        this.emit({ sessionId, projectId: session.projectId, type: "card_resolved", message, payload: { cardId: card.id, actionId: action.actionId } });
        emitted = true;
      }
    }

    if (action.type.startsWith("qa_")) {
      message = this.applyQaAction(sessionId, action);
      emitted = true;
    }

    if (action.type === "workflow_check") {
      message = "Workflow check 已完成：config/state/knowledge 诊断通过。";
      this.emit({ sessionId, projectId: session.projectId, type: "workflow_updated", message });
      emitted = true;
    }

    if (action.type === "workflow_sync") {
      message = "Workflow sync 已排入维护动作：将刷新 derived context、PROGRESS 和 compact 摘要。";
      this.emit({ sessionId, projectId: session.projectId, type: "workflow_updated", message, payload: { risk: "confirm" } });
      emitted = true;
    }

    if (action.type === "config_update") {
      message = `配置项 ${action.configId || "unknown"} 已更新为 ${action.value || "未设置"}。`;
      this.emit({ sessionId, projectId: session.projectId, type: "workflow_updated", message, payload: { configId: action.configId, value: action.value } });
      emitted = true;
    }

    session.messages.push({
      id: id("msg"),
      sessionId,
      role: "system",
      createdAt,
      blocks: [{ type: "text", text: message }]
    });
    session.updatedAt = createdAt;
    if (!emitted) this.emit({ sessionId, projectId: session.projectId, type: "session_updated", message, payload: action });
    this.persist();
    return session;
  }

  private emitTestScript(session: Session) {
    const cards: RequestCard[] = [
      {
        id: id("card"),
        sessionId: session.id,
        kind: "approval",
        title: "审批请求：运行命令",
        body: "当前 runner 请求执行一条本地命令。请确认是否允许继续。",
        actions: [
          { id: "approve", label: "批准", tone: "primary" },
          { id: "deny", label: "拒绝", tone: "danger" },
          { id: "ask", label: "追问", tone: "neutral" }
        ],
        status: "open",
        createdAt: now()
      },
      {
        id: id("card"),
        sessionId: session.id,
        kind: "user_input",
        title: "Ask Tool：选择后续动作",
        body: "模拟后端请求用户选择继续、总结或等待。",
        actions: [
          { id: "continue", label: "继续", tone: "primary" },
          { id: "summarize", label: "总结", tone: "neutral" },
          { id: "wait", label: "等待", tone: "neutral" }
        ],
        status: "open",
        createdAt: now()
      },
      {
        id: id("card"),
        sessionId: session.id,
        kind: "danger_confirm",
        title: "危险操作：Interrupt",
        body: "Kill 在 VSP-Coder 中表示 Interrupt 当前 runner，需要确认。",
        actions: [
          { id: "confirm_interrupt", label: "确认 Interrupt", tone: "danger" },
          { id: "cancel", label: "取消", tone: "neutral" }
        ],
        status: "open",
        createdAt: now()
      }
    ];
    session.cards.push(...cards);
    session.messages.push({
      id: id("msg"),
      sessionId: session.id,
      role: "assistant",
      createdAt: now(),
      blocks: [{ type: "text", text: "开始测试脚本已触发：请逐个处理审批卡片、Ask Tool、动作菜单、Skill/Command token 和 Workflow 侧栏。" }]
    });
    const qa = this.createQaRun(session.id);
    this.emit({ sessionId: session.id, projectId: session.projectId, type: "card_opened", message: "待处理事项已生成", payload: { cards, qaRunId: qa.id } });
  }

  private createQaRun(sessionId: string) {
    const existing = this.state.qaRuns.find((run) => run.sessionId === sessionId && run.status !== "complete");
    if (existing) return existing;
    const createdAt = now();
    const run: QaRun = {
      id: id("qa"),
      sessionId,
      title: "当前会话验收清单",
      status: "running",
      createdAt,
      updatedAt: createdAt,
      items: [
        { id: "qa-sync", label: "多窗口同步可见", status: "pending" },
        { id: "qa-mobile", label: "移动端切换和输入正常", status: "pending" },
        { id: "qa-cards", label: "审批/Ask/Interrupt 卡片可点击", status: "pending" },
        { id: "qa-actions", label: "动作菜单均有确认消息", status: "pending" },
        { id: "qa-tokens", label: "Skill/Command/File token 可补全、发送、预览", status: "pending" },
        { id: "qa-workflow", label: "Workflow 侧栏读取真实规划文件", status: "pending" }
      ]
    };
    this.state.qaRuns.unshift(run);
    return run;
  }

  private applyQaAction(sessionId: string, action: SessionActionRequest) {
    const run = this.state.qaRuns.find((item) => item.id === action.qaRunId) || this.createQaRun(sessionId);
    if (action.type === "qa_item_update" && action.qaItemId && action.qaStatus) {
      const item = run.items.find((entry) => entry.id === action.qaItemId);
      if (item) item.status = action.qaStatus;
      run.updatedAt = now();
      const message = `QA 项「${item?.label || action.qaItemId}」已标记为 ${action.qaStatus.toUpperCase()}。`;
      const session = this.session(sessionId);
      this.emit({ sessionId, projectId: session.projectId, type: "qa_updated", message, payload: { qaRunId: run.id, qaItemId: action.qaItemId, status: action.qaStatus } });
      return message;
    }
    if (action.type === "qa_complete") {
      run.status = "complete";
      run.updatedAt = now();
      const message = "QA 记录已完成并保存。";
      const session = this.session(sessionId);
      this.emit({ sessionId, projectId: session.projectId, type: "qa_updated", message, payload: { qaRunId: run.id } });
      return message;
    }
    return "QA action ignored.";
  }

  completions(): CompletionItem[] {
    return [
      {
        id: "skill-plan",
        kind: "skill",
        group: "Skills",
        label: "$hypo-workflow:plan",
        value: "hypo-workflow:plan",
        path: "/home/heyx/.codex/skills/hypo-workflow/skills/plan/SKILL.md",
        description: "进入 Hypo-Workflow 规划模式",
        risk: "confirm"
      },
      {
        id: "skill-start",
        kind: "skill",
        group: "Skills",
        label: "$hypo-workflow:start",
        value: "hypo-workflow:start",
        path: "/home/heyx/.codex/skills/hypo-workflow/skills/start/SKILL.md",
        description: "开始执行 pipeline",
        risk: "confirm"
      },
      {
        id: "cmd-hw-status",
        kind: "command",
        group: "Commands",
        label: "/hw:status",
        value: "/hw:status",
        description: "查看当前 workflow 状态",
        risk: "safe"
      },
      {
        id: "cmd-hw-sync",
        kind: "command",
        group: "Commands",
        label: "/hw:sync",
        value: "/hw:sync",
        description: "同步 derived workflow context",
        risk: "confirm"
      },
      {
        id: "file-design",
        kind: "file",
        group: "Files",
        label: ".pipeline/design-spec.md",
        value: ".pipeline/design-spec.md",
        path: ".pipeline/design-spec.md",
        description: "C1 设计规格",
        risk: "safe"
      },
      {
        id: "file-provider-notes",
        kind: "file",
        group: "Files",
        label: ".pipeline/knowledge/reference/provider-interface-notes.md",
        value: ".pipeline/knowledge/reference/provider-interface-notes.md",
        path: ".pipeline/knowledge/reference/provider-interface-notes.md",
        description: "三家 provider 本地接口备忘录",
        risk: "safe"
      }
    ];
  }

  preview(tokenId: string) {
    const item = this.completions().find((entry) => entry.id === tokenId || entry.value === tokenId);
    if (!item) throw Object.assign(new Error("Preview target not found"), { status: 404 });
    return {
      title: item.label,
      kind: item.kind,
      path: item.path,
      description: item.description,
      previewStatus: "placeholder",
      body: "C1 只要求打开明确的预览界面；完整 Markdown/PDF/HTML 渲染在后续实现。"
    };
  }

  workflow(projectId = "vsp-coder"): WorkflowSnapshot {
    const project = this.state.projects.find((entry) => entry.id === projectId) || baseProject;
    const files = [
      ".pipeline/config.yaml",
      ".pipeline/state.yaml",
      ".pipeline/cycle.yaml",
      ".pipeline/design-spec.md",
      ".pipeline/architecture.md",
      ".plan-state/discover.yaml",
      ".plan-state/decompose.yaml",
      ".plan-state/generate.yaml",
      ".pipeline/knowledge/reference/provider-interface-notes.md"
    ].map((file) => this.readWorkflowFile(project.path, file));
    const stateFile = files.find((file) => file.path.endsWith("state.yaml"));
    const configFile = files.find((file) => file.path.endsWith("config.yaml"));
    const architectureRef = files.find((file) => file.path.endsWith("architecture.md"));
    const hasWorkflow = Boolean(configFile?.exists && stateFile?.exists);
    const phase = stateFile?.content?.match(/phase:\s*(.+)/)?.[1]?.trim();
    const currentPrompt = stateFile?.content?.match(/prompt_file:\s*(.+)/)?.[1]?.trim() || null;
    const promptSummary = hasWorkflow && currentPrompt ? compactMarkdown(readMaybe(project.path, currentPrompt), 900) : "这个 Project 暂未检测到 Hypo-Workflow 配置。右侧栏会退回通用项目状态；可以继续使用会话、模型切换和 Activity。";
    return {
      project,
      hasWorkflow,
      files,
      phase,
      currentPrompt,
      milestoneCount: (stateFile?.content?.match(/status:\s*pending/g) || []).length,
      milestones: hasWorkflow ? parseMilestones(stateFile?.content || "", currentPrompt) : [],
      configItems: hasWorkflow ? parseConfigItems(configFile?.content || "") : [],
      compactPlan: promptSummary || "当前 Milestone compact plan 尚未生成。",
      architectureRef: architectureRef?.exists ? architectureRef : undefined,
      knowledgeRoot: hasWorkflow ? ".pipeline/knowledge/" : "",
      knowledgeRefs: [
        ".pipeline/knowledge/knowledge.compact.md",
        ".pipeline/knowledge/reference/provider-interface-notes.md",
        ".pipeline/knowledge/generated/codex-app-server/"
      ]
    };
  }

  private readWorkflowFile(root: string, relativePath: string): WorkflowFile {
    try {
      const safe = safeJoin(root, relativePath);
      const content = readFileSync(safe, "utf8");
      return {
        path: relativePath,
        title: relativePath.split("/").at(-1) || relativePath,
        exists: true,
        summary: summarize(content),
        content: content.slice(0, 4000)
      };
    } catch (error) {
      return {
        path: relativePath,
        title: relativePath.split("/").at(-1) || relativePath,
        exists: false,
        summary: "File missing or unreadable.",
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export function safeJoin(root: string, relativePath: string) {
  if (!relativePath || relativePath.startsWith("/") || relativePath.includes("\0")) {
    throw Object.assign(new Error("Invalid project-relative path"), { status: 400 });
  }
  const resolvedRoot = resolve(root);
  const target = resolve(resolvedRoot, relativePath);
  if (target !== resolvedRoot && !target.startsWith(`${resolvedRoot}/`)) {
    throw Object.assign(new Error("Path escapes project root"), { status: 403 });
  }
  return target;
}

function summarize(content: string) {
  return summarizeWithLimit(content, 220);
}

function summarizeWithLimit(content: string, limit: number) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("---"))
    .slice(0, 6)
    .join(" / ")
    .slice(0, limit);
}

function readMaybe(root: string, relativePath: string) {
  try {
    return readFileSync(safeJoin(root, relativePath), "utf8");
  } catch {
    return "";
  }
}

function parseMilestones(content: string, currentPrompt?: string | null): WorkflowMilestone[] {
  const milestones: WorkflowMilestone[] = [];
  const matches = content.matchAll(/-\s+id:\s*(\S+)\n\s+name:\s*(.+)\n\s+prompt_file:\s*(.+)\n\s+status:\s*(\S+)/g);
  for (const match of matches) {
    const promptFile = match[3].trim();
    milestones.push({
      id: match[1].trim(),
      name: match[2].trim(),
      promptFile,
      status: normalizeMilestoneStatus(match[4].trim()),
      current: currentPrompt === promptFile
    });
  }
  return milestones;
}

function normalizeMilestoneStatus(value: string): WorkflowMilestone["status"] {
  if (value === "pending" || value === "running" || value === "complete" || value === "blocked") return value;
  return "unknown";
}

function parseConfigItems(content: string): WorkflowConfigItem[] {
  const pick = (pattern: RegExp, fallback: string) => content.match(pattern)?.[1]?.trim() || fallback;
  return [
    {
      id: "plan.mode",
      label: "Planning mode",
      value: pick(/\nplan:\n\s+mode:\s*(\S+)/, "interactive"),
      description: "控制规划阶段是否需要交互确认。",
      editable: true,
      choices: ["interactive", "auto"]
    },
    {
      id: "evaluation.auto_continue",
      label: "Auto continue",
      value: pick(/\n\s+auto_continue:\s*(\S+)/, "true"),
      description: "通过检查后是否自动进入下一步。",
      editable: true,
      choices: ["true", "false"]
    }
  ];
}

function mockSession(
  idValue: string,
  projectId: string,
  title: string,
  status: Session["status"],
  model: string,
  reasoning: string,
  offsetMs: number
): Session {
  const createdAt = new Date(Date.now() + offsetMs).toISOString();
  const provider: ProviderKind = model.startsWith("opencode") ? "opencode" : "codex";
  return {
    id: idValue,
    projectId,
    provider,
    title,
    status,
    model,
    reasoning,
    cwd: projectRoot,
    runnerOwner: "mock-user",
    queue: [],
    messages: [
      {
        id: id("msg"),
        sessionId: idValue,
        role: "assistant",
        createdAt,
        blocks: [{ type: "text", text: `${title} 的会话记录。` }]
      }
    ],
    cards: [],
    artifacts: [],
    metric: {
      inputTokens: 720,
      outputTokens: 300,
      costUsdEstimate: 0.02,
      startedAt: createdAt,
      updatedAt: createdAt
    },
    createdAt,
    updatedAt: createdAt
  };
}

function normalizeTitle(title: string, fallback: string) {
  return title
    .replace("Saved Hypo-Workflow Mock Session", fallback)
    .replace("Mobile acceptance review", "移动端工作台调整")
    .replace("Workflow sidebar revision notes", "Workflow 侧栏整理");
}

function normalizeMessages(messages: Session["messages"]) {
  return messages.map((message) => ({
    ...message,
    blocks: message.blocks.map((block) => {
      if (block.type !== "text") return block;
      return {
        ...block,
        text: block.text
          .replace("欢迎来到 VSP-Coder C1 mock runtime。发送“开始测试”可以触发完整交互验收脚本。", "欢迎来到 VSP-Coder 工作台。当前服务运行在本机 runtime，用于验证 Project、Session、Workflow 和待处理交互。")
          .replace("开始测试脚本已触发：请逐个处理审批卡片、Ask Tool、动作菜单、Skill/Command token 和 Workflow 侧栏。", "待处理事项已生成：请在待处理面板中处理审批、Ask Tool、危险确认和验收清单。")
          .replaceAll("Mock runtime", "本机 runtime")
          .replaceAll("mock", "")
      };
    })
  }));
}

function normalizeCards(cards: RequestCard[]) {
  return cards.map((card) => ({
    ...card,
    title: card.title.replace("审批请求：运行测试命令", "审批请求：运行命令"),
    body: card.body.replace("Mock runner 想运行 npm test。请验证审批卡片交互。", "当前 runner 请求执行一条本地命令。请确认是否允许继续。")
  }));
}

function normalizeEvents(events: VspEvent[], sessions: Session[]) {
  const cleaned = events
    .map((event) => ({
      ...event,
      message: event.message
        .replace("Mock session initialized", "VSP-Coder 会话已恢复")
        .replace("Test cards opened", "待处理事项已生成")
        .replace("Message sent", "消息已发送")
        .replace("mock 诊断", "诊断")
        .replace("mock 更新", "更新")
        .replaceAll("mock", "")
        .replace(/\s{2,}/g, " ")
    }))
    .filter((event) => !/开始测试/i.test(event.message));
  const existingIds = new Set(cleaned.map((event) => event.id));
  for (const session of sessions) {
    const eventId = `activity-${session.id}`;
    if (!existingIds.has(eventId)) {
      cleaned.push({
        id: eventId,
        sessionId: session.id,
        projectId: session.projectId,
        type: "session_updated",
        message: `${session.title} · ${activityStatus(session.status)}`,
        createdAt: session.updatedAt
      });
    }
  }
  return dedupeEvents(cleaned)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 200);
}

function dedupeEvents(events: VspEvent[]) {
  const sorted = [...events].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const kept: VspEvent[] = [];
  for (const event of sorted) {
    const duplicate = kept.some((item) =>
      item.message === event.message &&
      item.sessionId === event.sessionId &&
      item.projectId === event.projectId &&
      Math.abs(new Date(item.createdAt).getTime() - new Date(event.createdAt).getTime()) < 30_000
    );
    if (!duplicate) kept.push(event);
  }
  return kept;
}

function activityStatus(status: Session["status"]) {
  const labels: Record<Session["status"], string> = {
    idle: "空闲",
    running: "运行中",
    queued: "排队中",
    waiting_approval: "等待审批",
    interrupted: "已中断",
    done: "已完成",
    error: "错误"
  };
  return labels[status];
}

function compactMarkdown(content: string, limit: number) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() && !line.trim().startsWith("---"));
  const picked: string[] = [];
  for (const line of lines) {
    if (picked.join("\n").length > limit) break;
    if (/^#{1,3}\s/.test(line) || /^[-*]\s/.test(line) || /^\d+\.\s/.test(line) || picked.length < 12) {
      picked.push(line);
    }
  }
  return picked.join("\n").slice(0, limit);
}

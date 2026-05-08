import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import {
  Bot,
  Check,
  ChevronDown,
  CircleStop,
  Clock3,
  FileText,
  Image,
  Maximize2,
  Menu,
  Minimize2,
  MoreHorizontal,
  Paperclip,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Play,
  RefreshCw,
  Search,
  Send,
  SlidersHorizontal,
  Smartphone,
  Trash2,
  Workflow,
  X
} from "lucide-react";
import type {
  AppConfig,
  AppError,
  Artifact,
  AutomationProfileId,
  CodexProviderHealth,
  CompletionItem,
  DataMode,
  DeploymentMode,
  Message,
  ModelOption,
  Project,
  ProviderKind,
  QaRun,
  RequestCard,
  QueueItem,
  Session,
  SubagentTrace,
  StructuredToken,
  VspEvent,
  VspState,
  WorkflowConfigItem,
  WorkflowSnapshot
} from "@vsp-coder/protocol";
import { parseCommandOutput, type ParsedCommandOutput } from "./rendering.js";
import {
  mergeDetailedSession,
  mergeStatePreservingDetails,
  patchSession,
  sanitizeMessageText,
  type LiveSessionPatch
} from "./sessionMerge.js";
import {
  readPersistedSelection,
  resolveSessionSelection,
  writePersistedSelection
} from "./sessionSelection.js";
import "katex/dist/katex.min.css";
import "./styles.css";

type Preview = {
  title: string;
  kind: string;
  path?: string;
  description?: string;
  previewStatus: string;
  body: string;
};

type RightTab = "workflow" | "artifacts" | "skills" | "settings";
type ActivityScope = "all" | "project" | "session";
type ResizableColumn = "global" | "session" | "right";
type ToolDisplayMode = "simple" | "detailed";
type ModelSwitchState = {
  sessionId: string;
  status: "pending" | "success" | "failed";
  target: { provider: ProviderKind; model: string; reasoning: string };
  previous: { provider: ProviderKind; model: string; reasoning: string };
  error?: string;
};

const columnBounds: Record<ResizableColumn, { min: number; max: number }> = {
  global: { min: 72, max: 300 },
  session: { min: 220, max: 380 },
  right: { min: 300, max: 620 }
};

const mobileBreakpoint = 1100;
const compactRightRailBreakpoint = 1380;
const collapsedRightRailWidth = 76;
const minConversationWidth = 520;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const initialLayout = (): Record<ResizableColumn, number> => {
  if (typeof window !== "undefined" && window.innerWidth <= 1540 && window.innerWidth > mobileBreakpoint) {
    if (window.innerWidth <= 1280) return { global: 72, session: 240, right: 330 };
    return { global: 72, session: 260, right: 380 };
  }
  return { global: 220, session: 280, right: 480 };
};
function fitLayoutToViewport(layout: Record<ResizableColumn, number>, viewportWidth: number): Record<ResizableColumn, number> {
  if (viewportWidth <= 1280) {
    return {
      global: 72,
      session: clamp(layout.session, 220, 250),
      right: clamp(layout.right, 300, 340)
    };
  }
  if (viewportWidth <= 1540) {
    return {
      global: 72,
      session: clamp(layout.session, 240, 280),
      right: clamp(layout.right, 340, 400)
    };
  }
  return layout;
}
const initialToolDisplayMode = (): ToolDisplayMode => {
  if (typeof window === "undefined") return "simple";
  return window.localStorage.getItem("vsp-coder-tool-display-mode") === "detailed" ? "detailed" : "simple";
};

function insertCompletionText(draft: string, item: CompletionItem) {
  const insert = completionInsertText(item);
  const next = draft.replace(/\S*$/, insert);
  return /\s$/.test(next) ? next : `${next} `;
}

function completionInsertText(item: CompletionItem) {
  if (item.kind === "skill") return item.label.startsWith("$") ? item.label : `$${item.value}`;
  return item.value || item.label;
}

function syncViewportVars() {
  const viewport = window.visualViewport;
  const height = viewport?.height || window.innerHeight;
  const offsetTop = viewport?.offsetTop || 0;
  const inset = Math.max(0, window.innerHeight - height - offsetTop);
  document.documentElement.style.setProperty("--visual-viewport-height", `${Math.round(height)}px`);
  document.documentElement.style.setProperty("--keyboard-inset", `${Math.round(inset)}px`);
  document.documentElement.classList.toggle("keyboard-open", inset > 40);
}

function shouldCollapseRightRail() {
  if (typeof window === "undefined") return false;
  return window.innerWidth <= compactRightRailBreakpoint && window.innerWidth > mobileBreakpoint;
}

const api = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) }
  });
  if (!res.ok) {
    const text = await res.text();
    throw apiErrorFromResponse(res.status, path, text);
  }
  return res.json() as Promise<T>;
};

class ApiError extends Error {
  appError: AppError;

  constructor(appError: AppError) {
    super(appError.message);
    this.name = "ApiError";
    this.appError = appError;
  }
}

function apiErrorFromResponse(statusCode: number, requestPath: string, body: string) {
  try {
    const parsed = JSON.parse(body) as { error?: AppError | string };
    if (parsed.error && typeof parsed.error === "object" && parsed.error.kind === "app_error") return new ApiError(parsed.error);
    return new ApiError(localAppError({ statusCode, requestPath, technicalDetail: typeof parsed.error === "string" ? parsed.error : body }));
  } catch {
    return new ApiError(localAppError({ statusCode, requestPath, technicalDetail: body }));
  }
}

function localAppError(input: { statusCode?: number; requestPath?: string; title?: string; message?: string; technicalDetail?: string; type?: AppError["type"]; retryKind?: AppError["retry"]["kind"]; dedupeKey?: string; target?: AppError["target"] }): AppError {
  const statusCode = input.statusCode || 0;
  const type = input.type || (statusCode === 429 ? "rate_limit" : statusCode >= 500 ? "provider" : "http");
  const retryKind = input.retryKind || (statusCode >= 500 || statusCode === 429 ? "retry_request" : "none");
  return {
    kind: "app_error",
    id: `ui-err-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title: input.title || (type === "rate_limit" ? "请求过于频繁" : statusCode >= 500 ? "请求失败" : "操作失败"),
    message: input.message || (type === "rate_limit" ? "请求触发限流，请稍后重试。" : "操作没有成功完成。"),
    statusCode: statusCode || undefined,
    technicalDetail: sanitizeClientDetail(input.technicalDetail || ""),
    retry: {
      kind: retryKind,
      label: statusCode === 429 ? "稍后重试" : retryLabel(retryKind),
      cooldownMs: statusCode === 429 ? 30_000 : undefined
    },
    dedupeKey: input.dedupeKey,
    target: { ...input.target, requestPath: input.requestPath || input.target?.requestPath },
    createdAt: new Date().toISOString()
  };
}

function sanitizeClientDetail(detail: string) {
  return detail
    .replace(/(authorization|cookie|set-cookie|x-api-key)\s*[:=]\s*(?:Bearer\s+)?[^\s,;]+/gi, "$1: [redacted]")
    .replace(/(token|secret|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, "$1: [redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\/home\/[^\s]+/g, "[path]")
    .slice(0, 2_000);
}

function isAppError(value: unknown): value is AppError {
  return typeof value === "object" && value !== null && (value as AppError).kind === "app_error";
}

const markdownSanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames || []),
    "details",
    "summary",
    "mark",
    "kbd",
    "sub",
    "sup"
  ],
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code || []), ["className"]],
    input: [...(defaultSchema.attributes?.input || []), ["type"], ["checked"], ["disabled"]],
    details: [["open"]],
    a: [...(defaultSchema.attributes?.a || []), ["target"], ["rel"]]
  }
};

function App() {
  const [state, setState] = useState<VspState | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowSnapshot | null>(null);
  const [codexHealth, setCodexHealth] = useState<CodexProviderHealth | null>(null);
  const [activeProjectId, setActiveProjectId] = useState("");
  const [activeSessionId, setActiveSessionId] = useState("");
  const [draft, setDraft] = useState("");
  const [tokens, setTokens] = useState<StructuredToken[]>([]);
  const [completions, setCompletions] = useState<CompletionItem[]>([]);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>("workflow");
  const [hydratingSessionId, setHydratingSessionId] = useState<string | null>(null);
  const [sessionLoadError, setSessionLoadError] = useState<string | null>(null);
  const [errorCards, setErrorCards] = useState<AppError[]>([]);
  const [creatingSession, setCreatingSession] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [renamingSession, setRenamingSession] = useState(false);
  const [activeRunSessionIds, setActiveRunSessionIds] = useState<Set<string>>(() => new Set());
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [modelSwitch, setModelSwitch] = useState<ModelSwitchState | null>(null);
  const [confirmInterrupt, setConfirmInterrupt] = useState(false);
  const [showAllProjects, setShowAllProjects] = useState(true);
  const [showAllSessions, setShowAllSessions] = useState(true);
  const [showAllRecentSessions, setShowAllRecentSessions] = useState(false);
  const [toolDisplayMode, setToolDisplayMode] = useState<ToolDisplayMode>(initialToolDisplayMode);
  const [activityScope, setActivityScope] = useState<ActivityScope>("all");
  const [layout, setLayout] = useState<Record<ResizableColumn, number>>(initialLayout);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth <= mobileBreakpoint);
  const [rightRailCollapsed, setRightRailCollapsed] = useState(shouldCollapseRightRail);
  const resizeRef = useRef<{ column: ResizableColumn; startX: number; startWidth: number } | null>(null);
  const rightRailUserToggledRef = useRef(false);
  const messagePaneRef = useRef<HTMLDivElement | null>(null);
  const messagePaneShouldStickRef = useRef(true);
  const messagePaneSessionRef = useRef("");
  const selectionBootstrappedRef = useRef(false);
  const sessionSortTimesRef = useRef<Map<string, number>>(new Map());
  const sessionSortStatusesRef = useRef<Map<string, Session["status"]>>(new Map());
  const runClearTimersRef = useRef<Map<string, number>>(new Map());
  const activeSessionIdRef = useRef("");
  const activeRunSessionIdsRef = useRef<Set<string>>(new Set());
  const stateRequestSeqRef = useRef(0);
  const sessionDetailRequestsRef = useRef<Map<string, { seq: number; controller: AbortController }>>(new Map());
  const sseDisconnectTimerRef = useRef<number | null>(null);

  const pushError = (error: unknown, context: Partial<AppError> & { retryKind?: AppError["retry"]["kind"]; requestPath?: string } = {}) => {
    const appError: AppError = isAppError(error)
      ? error
      : error instanceof ApiError
      ? {
        ...error.appError,
        ...context,
        retry: shouldKeepRateLimitRetry(error.appError)
          ? error.appError.retry
          : context.retryKind
          ? { ...error.appError.retry, kind: context.retryKind, label: retryLabel(context.retryKind) }
          : error.appError.retry,
        target: { ...error.appError.target, ...context.target, requestPath: context.requestPath || error.appError.target?.requestPath }
      }
      : localAppError({
        type: context.type,
        title: context.title,
        message: context.message,
        requestPath: context.requestPath,
        technicalDetail: error instanceof Error ? error.message : String(error),
        retryKind: context.retryKind,
        dedupeKey: context.dedupeKey,
        target: context.target
      });
    const merged = {
      ...appError,
      ...context,
      retry: shouldKeepRateLimitRetry(appError)
        ? appError.retry
        : context.retryKind
        ? { ...appError.retry, kind: context.retryKind, label: retryLabel(context.retryKind) }
        : appError.retry,
      target: { ...appError.target, ...context.target, requestPath: context.requestPath || appError.target?.requestPath },
      dedupeKey: context.dedupeKey || appError.dedupeKey
    };
    setErrorCards((prev) => [merged, ...prev.filter((item) => item.id !== merged.id && (!merged.dedupeKey || item.dedupeKey !== merged.dedupeKey))].slice(0, 4));
    return merged;
  };

  const dismissError = (id: string) => setErrorCards((prev) => prev.filter((item) => item.id !== id));

  const refresh = async (options: { workflow?: boolean } = { workflow: true }) => {
    const requestSeq = ++stateRequestSeqRef.current;
    try {
      const next = await api<VspState>("/api/state");
      if (requestSeq !== stateRequestSeqRef.current) return;
      setState((prev) => mergeStatePreservingDetails(prev, next));
      if (options.workflow !== false) {
        const wf = await api<WorkflowSnapshot>(`/api/workflow?projectId=${activeProjectId}`);
        if (requestSeq !== stateRequestSeqRef.current) return;
        setWorkflow(wf);
      }
      void api<CodexProviderHealth>("/api/providers/codex/health").then(setCodexHealth);
    } catch (error) {
      const appError = pushError(error, { type: "refresh", title: "刷新失败", retryKind: "refresh_state", requestPath: "/api/state" });
      setSessionLoadError(appError.message);
    }
  };

  const loadSessionDetail = async (sessionId: string, options: { silent?: boolean } = {}) => {
    if (!sessionId || sessionId.startsWith("mock-")) return;
    if (!options.silent) setHydratingSessionId(sessionId);
    setSessionLoadError(null);
    const previous = sessionDetailRequestsRef.current.get(sessionId);
    previous?.controller.abort();
    const request = {
      seq: (previous?.seq || 0) + 1,
      controller: new AbortController()
    };
    sessionDetailRequestsRef.current.set(sessionId, request);
    try {
      const detail = await api<Session>(`/api/sessions/${sessionId}`, { signal: request.controller.signal });
      if (sessionDetailRequestsRef.current.get(sessionId)?.seq !== request.seq) return;
      if (["running", "waiting_approval", "queued"].includes(detail.status) || detail.currentTurnId) {
        markSessionRun(sessionId, true);
      } else if (["idle", "interrupted", "error", "done"].includes(detail.status)) {
        if (activeRunSessionIdsRef.current.has(sessionId)) clearSessionRunSoon(sessionId);
      }
      setState((prev) => prev ? {
        ...prev,
        sessions: prev.sessions.map((item) => item.id === detail.id ? mergeDetailedSession(item, detail) : item)
      } : prev);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const appError = pushError(error, { type: "refresh", title: "读取 Session 失败", retryKind: "refresh_state", requestPath: `/api/sessions/${sessionId}`, target: { sessionId } });
      setSessionLoadError(appError.message);
    } finally {
      if (sessionDetailRequestsRef.current.get(sessionId)?.seq === request.seq) sessionDetailRequestsRef.current.delete(sessionId);
      if (!options.silent) setHydratingSessionId((current) => current === sessionId ? null : current);
    }
  };

  useEffect(() => {
    void refresh();
    void api<CompletionItem[]>("/api/completions").then(setCompletions);
    void api<ModelOption[]>("/api/models").then(setModelOptions);
    const source = new EventSource("/api/events");
    source.onopen = () => {
      if (sseDisconnectTimerRef.current) {
        window.clearTimeout(sseDisconnectTimerRef.current);
        sseDisconnectTimerRef.current = null;
      }
      setErrorCards((prev) => prev.filter((item) => item.dedupeKey !== "sse:disconnect"));
    };
    source.addEventListener("vsp", (event) => {
      try {
        const vspEvent = JSON.parse((event as MessageEvent).data) as VspEvent;
        if (applyLiveSessionPatch(vspEvent)) return;
        appendEvent(vspEvent);
        if (vspEvent.sessionId && vspEvent.sessionId === activeSessionIdRef.current) void loadSessionDetail(vspEvent.sessionId, { silent: true });
        if (!vspEvent.sessionId && shouldRefreshForGlobalEvent(vspEvent)) void refresh({ workflow: false });
      } catch {
        void refresh({ workflow: false });
      }
    });
    source.onerror = () => {
      if (sseDisconnectTimerRef.current) return;
      sseDisconnectTimerRef.current = window.setTimeout(() => {
        sseDisconnectTimerRef.current = null;
        pushError(localAppError({
          type: "sse",
          title: "实时连接已断开",
          message: "实时事件流持续断开，可以重连或刷新。",
          retryKind: "reconnect_sse",
          dedupeKey: "sse:disconnect",
          target: { operation: "reconnect_sse" }
        }));
      }, 1800);
    };
    return () => {
      if (sseDisconnectTimerRef.current) window.clearTimeout(sseDisconnectTimerRef.current);
      source.close();
    };
  }, []);

  useEffect(() => {
    const updateViewport = () => {
      setIsMobile(window.innerWidth <= mobileBreakpoint);
      if (!rightRailUserToggledRef.current) setRightRailCollapsed(shouldCollapseRightRail());
    };
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    const fitColumns = () => {
      if (window.innerWidth <= mobileBreakpoint) return;
      setLayout((prev) => fitLayoutToViewport(prev, window.innerWidth));
    };
    fitColumns();
    window.addEventListener("resize", fitColumns);
    return () => window.removeEventListener("resize", fitColumns);
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    const applyViewportVars = () => syncViewportVars();
    applyViewportVars();
    viewport?.addEventListener("resize", applyViewportVars);
    viewport?.addEventListener("scroll", applyViewportVars);
    window.addEventListener("resize", applyViewportVars);
    return () => {
      viewport?.removeEventListener("resize", applyViewportVars);
      viewport?.removeEventListener("scroll", applyViewportVars);
      window.removeEventListener("resize", applyViewportVars);
      document.documentElement.style.removeProperty("--visual-viewport-height");
      document.documentElement.style.removeProperty("--keyboard-inset");
      document.documentElement.classList.remove("keyboard-open");
    };
  }, []);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    void loadSessionDetail(activeSessionId);
  }, [activeSessionId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refresh({ workflow: false });
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [activeProjectId, activeSessionId]);

  useEffect(() => {
    window.localStorage.setItem("vsp-coder-tool-display-mode", toolDisplayMode);
  }, [toolDisplayMode]);

  const projects = state?.projects || [];
  const allSessions = useMemo(() => sortSessionsByLastSettled(state?.sessions || [], sessionSortTimesRef.current, sessionSortStatusesRef.current), [state]);
  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const projectSessions = allSessions.filter((session) => session.projectId === activeProjectId);
  const selectedSession = state?.sessions.find((item) => item.id === activeSessionId && item.projectId === activeProjectId);
  const session = selectedSession || projectSessions[0] || null;
  const config = state?.config || null;
  const activeProject = projects.find((project) => project.id === activeProjectId) || projects[0] || null;
  const qaRun = state?.qaRuns.find((run) => run.sessionId === session?.id && run.status !== "complete") || null;
  const openCards = session?.cards.filter((card) => card.status === "open" && !(config?.automationProfile === "full_auto" && card.kind === "approval")) || [];
  const pendingQueue = session?.queue.filter((item) => item.state === "pending") || [];
  const forceActiveRun = Boolean(session && activeRunSessionIds.has(session.id)) || sendingMessage;
  const activeTool = session ? currentToolActivity(session, forceActiveRun) : null;

  useEffect(() => {
    if (!session || session.provider !== "codex") return;
    const busy = forceActiveRun || ["running", "waiting_approval", "queued"].includes(session.status);
    const timer = window.setInterval(() => {
      void loadSessionDetail(session.id, { silent: true });
    }, busy ? 2500 : 1800);
    return () => window.clearInterval(timer);
  }, [session?.id, session?.provider, session?.status, forceActiveRun]);

  useEffect(() => {
    const pane = messagePaneRef.current;
    if (!pane || !session?.id) return;
    if (messagePaneSessionRef.current !== session.id) {
      messagePaneSessionRef.current = session.id;
      messagePaneShouldStickRef.current = true;
      pane.scrollTo({ top: pane.scrollHeight });
      return;
    }
    if (messagePaneShouldStickRef.current) pane.scrollTo({ top: pane.scrollHeight });
  }, [session?.id, session?.messages.length]);

  useEffect(() => {
    if (!state || !projects.length) return;
    const resolved = resolveSessionSelection({
      state,
      sessions: allSessions,
      currentProjectId: activeProjectId,
      currentSessionId: activeSessionId,
      persisted: selectionBootstrappedRef.current ? null : readPersistedSelection()
    });
    if (!resolved.projectId) return;
    selectionBootstrappedRef.current = true;
    if (resolved.projectId !== activeProjectId) setActiveProjectId(resolved.projectId);
    if (resolved.sessionId !== activeSessionId) setActiveSessionId(resolved.sessionId);
    if (resolved.fallbackReason !== "none") setSessionLoadError(selectionFallbackMessage(resolved.fallbackReason));
  }, [state, projects, allSessions, activeProjectId, activeSessionId]);

  useEffect(() => {
    if (!selectionBootstrappedRef.current || !activeProjectId) return;
    writePersistedSelection({
      projectId: activeProjectId,
      sessionId: activeSessionId,
      updatedAt: new Date().toISOString()
    });
  }, [activeProjectId, activeSessionId]);

  const scopedEvents = useMemo(() => {
    const events = state?.events || [];
    if (activityScope === "project") return events.filter((event) => event.projectId === activeProjectId);
    if (activityScope === "session") return events.filter((event) => event.sessionId === session?.id);
    return events;
  }, [state, activityScope, activeProjectId, session?.id]);

  const filteredCompletions = useMemo(() => {
    const trigger = draft.split(/\s/).at(-1) || "";
    if (!trigger.startsWith("$") && !trigger.startsWith("/") && !trigger.startsWith("@") && !trigger.includes(".pipeline")) return [];
    const term = trigger.replace(/^[@$]/, "").toLowerCase();
    return completions.filter((item) =>
      [item.label, item.value, item.path, item.description].filter(Boolean).join(" ").toLowerCase().includes(term)
    ).slice(0, 8);
  }, [draft, completions]);

  const selectProject = (projectId: string) => {
    setActiveProjectId(projectId);
    const firstSession = allSessions.find((item) => item.projectId === projectId);
    if (firstSession) setActiveSessionId(firstSession.id);
  };

  function applyLiveSessionPatch(event: VspEvent) {
    const patch = event.payload as LiveSessionPatch | undefined;
    if (!event.sessionId || patch?.kind !== "live_session_patch") return false;
    updateLocalRunState(event.sessionId, patch);
    setState((prev) => prev ? {
      ...prev,
      events: [event, ...prev.events].slice(0, 200),
      sessions: prev.sessions.map((item) => item.id === event.sessionId ? patchSession(item, patch) : item)
    } : prev);
    return true;
  }

  function appendEvent(event: VspEvent) {
    if (event.type === "error") pushError(event.payload && typeof event.payload === "object" && (event.payload as AppError).kind === "app_error"
      ? new ApiError(event.payload as AppError)
      : localAppError({ type: "provider", title: "后台错误", message: event.message, technicalDetail: event.message, retryKind: "refresh_state" }));
    setState((prev) => prev ? {
      ...prev,
      events: [event, ...prev.events.filter((item) => item.id !== event.id)].slice(0, 200)
    } : prev);
  }

  const selectSession = (nextSession: Session) => {
    setActiveProjectId(nextSession.projectId);
    setActiveSessionId(nextSession.id);
    setSwitcherOpen(false);
  };

  const createSession = async () => {
    if (creatingSession) return;
    setCreatingSession(true);
    setSessionLoadError(null);
    try {
      const next = await api<Session>("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ projectId: activeProjectId })
      });
      setState((prev) => prev ? {
        ...prev,
        sessions: [next, ...prev.sessions.filter((item) => item.id !== next.id)]
      } : prev);
      setActiveProjectId(next.projectId);
      setActiveSessionId(next.id);
      setSwitcherOpen(false);
      await refresh();
    } catch (error) {
      const appError = pushError(error, { type: "http", title: "创建会话失败", retryKind: "retry_request", requestPath: "/api/sessions" });
      setSessionLoadError(appError.message);
    } finally {
      setCreatingSession(false);
    }
  };

  const refreshState = async () => {
    await refresh();
    if (activeSessionId) await loadSessionDetail(activeSessionId);
    void api<ModelOption[]>("/api/models").then(setModelOptions);
  };

  const sendMessage = async (override?: { sessionId: string; text: string; tokens?: StructuredToken[] }) => {
    const targetSession = override?.sessionId ? state?.sessions.find((item) => item.id === override.sessionId) || session : session;
    const outgoingText = override?.text ?? draft.trim();
    const outgoingTokens = override?.tokens ?? tokens;
    if (!targetSession || sendingMessage || (!outgoingText.trim() && !outgoingTokens.length)) return;
    setSendingMessage(true);
    setSessionLoadError(null);
    markSessionRun(targetSession.id, true);
    try {
      const next = await api<Session>(`/api/sessions/${targetSession.id}`, {
        method: "POST",
        body: JSON.stringify({ text: outgoingText.trim() || "发送结构化 token", tokens: outgoingTokens })
      });
      setState((prev) => prev ? {
        ...prev,
        sessions: prev.sessions.map((item) => item.id === next.id ? next : item)
      } : prev);
      if (!override) {
        setDraft("");
        setTokens([]);
      }
    } catch (error) {
      markSessionRun(targetSession.id, false);
      const appError = pushError(error, {
        type: "send",
        title: "消息发送失败",
        retryKind: "retry_send",
        requestPath: `/api/sessions/${targetSession.id}`,
        target: { sessionId: targetSession.id, operation: "send_message", text: outgoingText, tokens: outgoingTokens }
      });
      setSessionLoadError(appError.message);
    } finally {
      setSendingMessage(false);
    }
  };
  const canSend = Boolean(session && !sendingMessage && (draft.trim() || tokens.length));
  const canRename = Boolean(session && session.provider === "codex" && !renamingSession);

  const openRename = () => {
    if (!session) return;
    setRenameDraft(session.title);
    setRenameOpen(true);
  };

  const renameSession = async () => {
    if (!session || renamingSession) return;
    const value = renameDraft.trim();
    if (!value) {
      setSessionLoadError("Rename title is required");
      return;
    }
    setRenamingSession(true);
    setSessionLoadError(null);
    try {
      const next = await api<Session>(`/api/sessions/${session.id}/actions`, {
        method: "POST",
        body: JSON.stringify({ type: "rename_session", value })
      });
      setState((prev) => prev ? {
        ...prev,
        sessions: prev.sessions.map((item) => item.id === next.id ? next : item)
      } : prev);
      setRenameOpen(false);
      setRenameDraft("");
      await loadSessionDetail(next.id);
    } catch (error) {
      const appError = pushError(error, { type: "http", title: "重命名失败", retryKind: "retry_request", requestPath: `/api/sessions/${session.id}/actions`, target: { sessionId: session.id } });
      setSessionLoadError(appError.message);
    } finally {
      setRenamingSession(false);
    }
  };

  const act = async (type: string, extra: Record<string, unknown> = {}) => {
    if (!session) return;
    const next = await api<Session>(`/api/sessions/${session.id}/actions`, {
      method: "POST",
      body: JSON.stringify({ type, ...extra })
    });
    setConfirmInterrupt(false);
    setState((prev) => prev ? {
      ...prev,
      sessions: prev.sessions.map((item) => item.id === next.id ? mergeDetailedSession(item, next) : item)
    } : prev);
    if (type.startsWith("workflow") || type.startsWith("qa_")) await refresh();
  };

  const switchSessionModel = async (provider: string, model: string, reasoning: string) => {
    if (!session || modelSwitch?.status === "pending") return;
    const visibleOptions = modelOptionsForSession(session, modelOptions);
    const option = visibleOptions.find((item) => item.provider === provider && item.model === model);
    if (!option) {
      setSessionLoadError("当前 provider 不支持所选模型。");
      return;
    }
    if (!option.reasoning.includes(reasoning)) {
      setSessionLoadError(`${option.label} 不支持 ${reasoning} reasoning。`);
      return;
    }
    const previous = { provider: session.provider, model: session.model, reasoning: session.reasoning };
    const target = { provider: option.provider, model: option.model, reasoning };
    setModelSwitch({ sessionId: session.id, status: "pending", previous, target });
    setSessionLoadError(null);
    setState((prev) => prev ? {
      ...prev,
      sessions: prev.sessions.map((item) => item.id === session.id ? { ...item, ...target, updatedAt: new Date().toISOString() } : item)
    } : prev);
    try {
      const next = await api<Session>(`/api/sessions/${session.id}/actions`, {
        method: "POST",
        body: JSON.stringify({ type: "switch_model", ...target })
      });
      setState((prev) => prev ? {
        ...prev,
        sessions: prev.sessions.map((item) => item.id === next.id ? mergeDetailedSession(item, next) : item)
      } : prev);
      setModelSwitch({ sessionId: session.id, status: "success", previous, target });
      window.setTimeout(() => setModelSwitch((current) => current?.sessionId === session.id && current.status === "success" ? null : current), 1200);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState((prev) => prev ? {
        ...prev,
        sessions: prev.sessions.map((item) => item.id === session.id ? { ...item, ...previous, updatedAt: new Date().toISOString() } : item)
      } : prev);
      setModelSwitch({ sessionId: session.id, status: "failed", previous, target, error: message });
      const appError = pushError(error, { type: "http", title: "模型切换失败", message: `模型切换失败：${message}`, retryKind: "retry_request", requestPath: `/api/sessions/${session.id}/actions`, target: { sessionId: session.id } });
      setSessionLoadError(appError.message);
    }
  };

  const updateConfig = async (patch: Partial<Pick<AppConfig, "deploymentMode" | "dataMode" | "automationProfile">>) => {
    await api<AppConfig>("/api/config", {
      method: "PUT",
      body: JSON.stringify(patch)
    });
    await refresh();
  };

  const startCodex = async () => {
    setCodexHealth(await api<CodexProviderHealth>("/api/providers/codex/start", { method: "POST" }));
    await refresh();
    void api<ModelOption[]>("/api/models").then(setModelOptions);
  };

  const retryError = async (error: AppError) => {
    if (error.retry.kind === "none") return;
    dismissError(error.id);
    if (error.retry.kind === "retry_send") {
      if (error.target?.sessionId && error.target.sessionId !== session?.id) setActiveSessionId(error.target.sessionId);
      if (error.target?.sessionId && typeof error.target.text === "string") {
        await sendMessage({ sessionId: error.target.sessionId, text: error.target.text, tokens: error.target.tokens || [] });
      }
      return;
    }
    if (error.retry.kind === "reconnect_sse" || error.retry.kind === "refresh_state" || error.retry.kind === "retry_request") {
      await refreshState();
    }
  };

  const chooseCompletion = (item: CompletionItem) => {
    setDraft((prev) => insertCompletionText(prev, item));
  };

  const openPreview = useCallback(async (token: StructuredToken) => {
    setPreview(await api<Preview>(`/api/preview/${encodeURIComponent(token.id)}`));
    setRightTab("skills");
    if (rightRailCollapsed) setRightRailCollapsed(false);
  }, [rightRailCollapsed]);

  const openArtifactPreview = useCallback(async (artifact: Artifact) => {
    if (!session) return;
    setPreview(await api<Preview>(`/api/sessions/${encodeURIComponent(session.id)}/artifacts/${encodeURIComponent(artifact.id)}/preview`));
    setRightTab("artifacts");
    if (rightRailCollapsed) setRightRailCollapsed(false);
  }, [session?.id, rightRailCollapsed]);

  const visibleProjects = showAllProjects ? projects : projects.slice(0, 5);
  const sessionPreviewLimit = isMobile ? 3 : 6;
  const recentSessionPreviewLimit = isMobile ? 3 : 5;
  const visibleSessions = showAllSessions ? projectSessions : projectSessions.slice(0, sessionPreviewLimit);
  const visibleRecentSessions = showAllRecentSessions ? allSessions : allSessions.slice(0, recentSessionPreviewLimit);
  const layoutStyle = {
    "--global-rail-width": `${layout.global}px`,
    "--session-rail-width": `${layout.session}px`,
    "--right-rail-width": `${rightRailCollapsed ? collapsedRightRailWidth : layout.right}px`
  } as React.CSSProperties & Record<"--global-rail-width" | "--session-rail-width" | "--right-rail-width", string>;

  const startResize = (column: ResizableColumn, event: React.PointerEvent<HTMLButtonElement>) => {
    if (rightRailCollapsed && column === "right") return;
    resizeRef.current = { column, startX: event.clientX, startWidth: layout[column] };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    const active = resizeRef.current;
    if (!active) return;
    const bounds = columnBounds[active.column];
    const delta = active.column === "right" ? active.startX - event.clientX : event.clientX - active.startX;
    setLayout((prev) => {
      const proposed = clamp(active.startWidth + delta, bounds.min, bounds.max);
      const next = { ...prev, [active.column]: proposed };
      const rightWidth = rightRailCollapsed ? collapsedRightRailWidth : next.right;
      const mainWidth = window.innerWidth - next.global - next.session - rightWidth;
      if (mainWidth >= minConversationWidth) return next;
      const available = Math.max(0, window.innerWidth - minConversationWidth);
      if (active.column === "right") next.right = clamp(available - next.global - next.session, bounds.min, bounds.max);
      if (active.column === "session") next.session = clamp(available - next.global - rightWidth, bounds.min, bounds.max);
      if (active.column === "global") next.global = clamp(available - next.session - rightWidth, bounds.min, bounds.max);
      return next;
    });
  };

  const endResize = () => {
    resizeRef.current = null;
  };

  const toggleRightRail = () => {
    rightRailUserToggledRef.current = true;
    setRightRailCollapsed((value) => !value);
  };

  const selectRightTab = (tab: RightTab) => {
    setRightTab(tab);
    if (rightRailCollapsed) {
      rightRailUserToggledRef.current = true;
      setRightRailCollapsed(false);
    }
  };

  return (
    <div className={rightRailCollapsed ? "app-shell right-collapsed" : "app-shell"} style={layoutStyle}>
      <ResizeHandle column="global" label="调整左侧栏宽度" onStart={startResize} onMove={moveResize} onEnd={endResize} />
      <ResizeHandle column="session" label="调整会话栏宽度" onStart={startResize} onMove={moveResize} onEnd={endResize} />
      {!rightRailCollapsed && <ResizeHandle column="right" label="调整右侧栏宽度" onStart={startResize} onMove={moveResize} onEnd={endResize} />}
      <aside className="global-rail">
        <div className="brand">
          <strong>VSP-Coder</strong>
          <span>WORKBENCH</span>
          <ProviderStatusBadge health={codexHealth} />
        </div>
        <button className="shortcut" onClick={() => void act("open_search")}><Search size={14} /> 搜索 <kbd>Ctrl K</kbd></button>
        <div className="global-recent-block">
          <SectionHeader label="最近 Session" count={allSessions.length} />
          <div className={showAllRecentSessions ? "session-list expanded recent global-recent" : "session-list recent global-recent"}>
            {visibleRecentSessions.map((item) => (
              <SessionCard
                key={item.id}
                session={item}
                projectName={projectById.get(item.projectId)?.name}
                active={item.id === session?.id}
                onSelect={() => selectSession(item)}
              />
            ))}
          </div>
          {allSessions.length > recentSessionPreviewLimit && <MoreButton expanded={showAllRecentSessions} onClick={() => setShowAllRecentSessions(!showAllRecentSessions)} />}
        </div>
        <SectionHeader label="最近 Project" count={projects.length} />
        <ProjectList projects={visibleProjects} activeProjectId={activeProjectId} onSelect={selectProject} />
        {projects.length > 5 && <MoreButton expanded={showAllProjects} onClick={() => setShowAllProjects(!showAllProjects)} />}
        <ActivityBlock
          events={scopedEvents}
          scope={activityScope}
          setScope={setActivityScope}
          activeProject={activeProject}
          session={session}
        />
      </aside>

      <aside className={switcherOpen ? "session-rail open" : "session-rail"}>
        <div className="session-head">
          <div>
            <span>当前 Project</span>
            <strong>{activeProject?.name || "Project"}</strong>
          </div>
          <div className="session-actions">
            <button className={creatingSession ? "new-session busy" : "new-session"} title="新建会话" disabled={creatingSession} onClick={() => void createSession()}><Play size={14} /> {creatingSession ? "创建中" : "新建"}</button>
            <button title="重命名当前会话" disabled={!canRename} onClick={() => openRename()}><Pencil size={16} /></button>
            <button title="刷新" onClick={() => void refreshState()}><RefreshCw size={16} /></button>
          </div>
        </div>

        <div className="session-rail-body">
          <div className="mobile-workbench">
            <SectionHeader label="最近 Session" count={allSessions.length} />
            <div className={showAllRecentSessions ? "session-list expanded recent" : "session-list recent"}>
              {visibleRecentSessions.map((item) => (
                <SessionCard
                  key={item.id}
                  session={item}
                  projectName={projectById.get(item.projectId)?.name}
                  active={item.id === session?.id}
                  onSelect={() => selectSession(item)}
                />
              ))}
            </div>
            {allSessions.length > recentSessionPreviewLimit && <MoreButton expanded={showAllRecentSessions} onClick={() => setShowAllRecentSessions(!showAllRecentSessions)} />}
            <SectionHeader label="最近 Project" count={projects.length} />
            <ProjectList projects={visibleProjects} activeProjectId={activeProjectId} onSelect={(id) => { selectProject(id); }} />
            {projects.length > 5 && <MoreButton expanded={showAllProjects} onClick={() => setShowAllProjects(!showAllProjects)} />}
          </div>

          <SectionHeader label="当前 Project Session" count={projectSessions.length} />
          <div className={showAllSessions ? "session-list expanded" : "session-list"}>
            {visibleSessions.map((item) => (
              <SessionCard
                key={item.id}
                session={item}
                active={item.id === session?.id}
                onSelect={() => { setActiveSessionId(item.id); setSwitcherOpen(false); }}
              />
            ))}
          </div>
          {projectSessions.length > sessionPreviewLimit && <MoreButton expanded={showAllSessions} onClick={() => setShowAllSessions(!showAllSessions)} />}

          <div className="mobile-workbench">
            <ActivityBlock
              events={scopedEvents}
              scope={activityScope}
              setScope={setActivityScope}
              activeProject={activeProject}
              session={session}
            />
          </div>
        </div>
      </aside>

      <main className="workspace">
        <div className="mobile-topbar">
          <button onClick={() => setSwitcherOpen(true)}><Menu size={18} /></button>
          <div className="mobile-title">
            <strong>{session?.title || "VSP-Coder"}</strong>
            <div className="mobile-meta">
              {session && <span className={`status-dot ${session.status}`} />}
              <span>{session ? `${statusLabel(session.status)} · ${session.runnerOwner} · ${profileLabel(config, session.automationProfile)}` : "未选择 Session"}</span>
            </div>
          </div>
          <div className="mobile-topbar-actions">
            <ProviderStatusBadge health={codexHealth} compact />
            <button className={creatingSession ? "mobile-create busy" : "mobile-create"} disabled={creatingSession} onClick={() => void createSession()}><Play size={17} /></button>
            <button disabled={!canRename} onClick={() => openRename()}><Pencil size={18} /></button>
            <button onClick={() => void refreshState()}><RefreshCw size={18} /></button>
          </div>
        </div>
        {session && (
          <MobileModelDock
            session={session}
            modelOptions={modelOptions}
            displayMode={toolDisplayMode}
            setDisplayMode={setToolDisplayMode}
            modelSwitch={modelSwitch?.sessionId === session.id ? modelSwitch : null}
            onSwitch={(provider, model, reasoning) => void switchSessionModel(provider, model, reasoning)}
          />
        )}
        {switcherOpen && <button className="scrim" onClick={() => setSwitcherOpen(false)} aria-label="关闭工作台抽屉" />}
        <div
          className="message-pane"
          ref={messagePaneRef}
          onScroll={(event) => {
            messagePaneShouldStickRef.current = isNearPaneBottom(event.currentTarget);
          }}
        >
          {session ? (
            <Conversation
              session={session}
              config={config}
              loading={hydratingSessionId === session.id}
              error={sessionLoadError}
              displayMode={toolDisplayMode}
              setDisplayMode={setToolDisplayMode}
              modelOptions={modelOptions}
              modelSwitch={modelSwitch?.sessionId === session.id ? modelSwitch : null}
              openPreview={openPreview}
              onSwitchModel={(provider, model, reasoning) => void switchSessionModel(provider, model, reasoning)}
            />
          ) : <EmptyState />}
        </div>
        {activeTool && <ToolActivityFloat activity={activeTool} />}
        <PendingBar
          cards={openCards}
          qaRun={qaRun}
          open={pendingOpen}
          setOpen={setPendingOpen}
          onCardAction={(card, actionId) => void act("card_action", { cardId: card.id, actionId })}
          onQaItem={(runId, itemId, status) => void act("qa_item_update", { qaRunId: runId, qaItemId: itemId, qaStatus: status })}
          onQaComplete={(runId) => void act("qa_complete", { qaRunId: runId })}
        />
        <QueueDock
          items={pendingQueue}
          onClear={() => void act("clear_queue")}
        />
        <ErrorDock
          errors={errorCards}
          onRetry={(error) => void retryError(error)}
          onDismiss={dismissError}
        />
        <Composer
          sessionId={session?.id || ""}
          mobileAutoFocus={Boolean(session && !switcherOpen && !renameOpen && !confirmInterrupt)}
          draft={draft}
          setDraft={setDraft}
          tokens={tokens}
          setTokens={setTokens}
          completions={filteredCompletions}
          chooseCompletion={chooseCompletion}
          sendMessage={sendMessage}
          sending={sendingMessage}
          canSend={canSend}
          onAction={(type) => type === "interrupt" ? setConfirmInterrupt(true) : void act(type)}
        />
        {confirmInterrupt && (
          <div className="modal">
            <div>
              <CircleStop size={28} />
              <h3>确认 Interrupt 当前 Codex turn？</h3>
              <p>Kill 在 VSP-Coder 中表示中断当前 runner/session。它不会清空历史消息。</p>
              <button onClick={() => setConfirmInterrupt(false)}>取消</button>
              <button className="danger" onClick={() => void act("interrupt")}>确认 Interrupt</button>
            </div>
          </div>
        )}
        {renameOpen && (
          <div className="modal">
            <div>
              <Pencil size={28} />
              <h3>重命名当前 Codex session</h3>
              <input
                autoFocus
                value={renameDraft}
                onChange={(event) => setRenameDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void renameSession();
                  if (event.key === "Escape") setRenameOpen(false);
                }}
              />
              <button onClick={() => setRenameOpen(false)}>取消</button>
              <button className="primary" disabled={renamingSession || !renameDraft.trim()} onClick={() => void renameSession()}>
                {renamingSession ? "重命名中" : "确认重命名"}
              </button>
            </div>
          </div>
        )}
      </main>

      <aside className={rightRailCollapsed ? "right-rail collapsed" : "right-rail"}>
        <div className="tabs">
          <button
            className="right-collapse-toggle"
            title={rightRailCollapsed ? "展开右侧面板" : "收起右侧面板"}
            aria-label={rightRailCollapsed ? "展开右侧面板" : "收起右侧面板"}
            onClick={toggleRightRail}
          >
            {rightRailCollapsed ? <PanelRightOpen size={15} /> : <PanelRightClose size={15} />}
          </button>
          <button title="Workflow" className={rightTab === "workflow" ? "active" : ""} onClick={() => selectRightTab("workflow")}><Workflow size={15} /> Workflow</button>
          <button title="Artifacts" className={rightTab === "artifacts" ? "active" : ""} onClick={() => selectRightTab("artifacts")}><FileText size={15} /> Artifacts</button>
          <button title="Skill" className={rightTab === "skills" ? "active" : ""} onClick={() => selectRightTab("skills")}><Bot size={15} /> Skill</button>
          <button title="Settings" className={rightTab === "settings" ? "active" : ""} onClick={() => selectRightTab("settings")}><SlidersHorizontal size={15} /> Settings</button>
        </div>
        {!rightRailCollapsed && rightTab === "workflow" && (
          <WorkflowPanel
            workflow={workflow}
            onAction={(type, extra) => void act(type, extra)}
          />
        )}
        {!rightRailCollapsed && rightTab === "artifacts" && <ArtifactPanel session={session} preview={preview} onPreview={(artifact) => void openArtifactPreview(artifact)} />}
        {!rightRailCollapsed && rightTab === "skills" && <SkillPanel preview={preview} completions={completions} onPreview={(item) => void openPreview(item)} />}
        {!rightRailCollapsed && rightTab === "settings" && <SettingsPanel config={config} codexHealth={codexHealth} onStartCodex={() => void startCodex()} onUpdate={(patch) => void updateConfig(patch)} />}
      </aside>
    </div>
  );

  function markSessionRun(sessionId: string, active: boolean) {
    const existingTimer = runClearTimersRef.current.get(sessionId);
    if (existingTimer) {
      window.clearTimeout(existingTimer);
      runClearTimersRef.current.delete(sessionId);
    }
    setActiveRunSessionIds((previous) => {
      const next = new Set(previous);
      if (active) next.add(sessionId);
      else next.delete(sessionId);
      activeRunSessionIdsRef.current = next;
      return next;
    });
  }

  function clearSessionRunSoon(sessionId: string) {
    const existingTimer = runClearTimersRef.current.get(sessionId);
    if (existingTimer) window.clearTimeout(existingTimer);
    const timer = window.setTimeout(() => {
      runClearTimersRef.current.delete(sessionId);
      markSessionRun(sessionId, false);
    }, 2600);
    runClearTimersRef.current.set(sessionId, timer);
  }

  function updateLocalRunState(sessionId: string, patch: LiveSessionPatch) {
    if (
      patch.messageDelta ||
      patch.artifactUpdates?.length ||
      (patch.status && ["running", "waiting_approval", "queued"].includes(patch.status))
    ) {
      markSessionRun(sessionId, true);
      return;
    }
    if (
      (patch.status && ["idle", "interrupted", "error"].includes(patch.status)) ||
      patch.currentTurnId === null
    ) {
      clearSessionRunSoon(sessionId);
    }
  }
}

function shouldRefreshForGlobalEvent(event: VspEvent) {
  if (event.type === "rate_limit_updated" || event.type === "metric_updated" || event.type === "warning") return false;
  if (event.type === "session_updated" && /^Codex app-server /.test(event.message)) return true;
  return event.type === "workflow_updated" || event.type === "qa_updated" || event.type === "error";
}

function isNearPaneBottom(pane: HTMLElement) {
  return pane.scrollHeight - pane.scrollTop - pane.clientHeight < 96;
}

function SectionHeader({ label, count }: { label: string; count?: number }) {
  return <div className="section-title"><span>{label}</span>{typeof count === "number" && <em>{count}</em>}</div>;
}

function ResizeHandle({ column, label, onStart, onMove, onEnd }: {
  column: ResizableColumn;
  label: string;
  onStart: (column: ResizableColumn, event: React.PointerEvent<HTMLButtonElement>) => void;
  onMove: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onEnd: () => void;
}) {
  return (
    <button
      className={`resize-handle ${column}`}
      aria-label={label}
      onPointerDown={(event) => onStart(column, event)}
      onPointerMove={onMove}
      onPointerUp={onEnd}
      onPointerCancel={onEnd}
    />
  );
}

function MoreButton({ expanded, onClick }: { expanded: boolean; onClick: () => void }) {
  return <button className="more-button" onClick={onClick}><MoreHorizontal size={14} /> {expanded ? "收起" : "更多"}</button>;
}

function ProjectList({ projects, activeProjectId, onSelect }: { projects: Project[]; activeProjectId: string; onSelect: (id: string) => void }) {
  return (
    <div className="project-list">
      {projects.map((project) => (
        <button
          key={project.id}
          className={project.id === activeProjectId ? "project active" : "project"}
          onClick={() => onSelect(project.id)}
        >
          <span style={{ background: project.color }} />
          <strong>{project.name}</strong>
          <small>{project.status}</small>
        </button>
      ))}
    </div>
  );
}

function SessionCard({ session, active, onSelect, projectName }: { session: Session; active: boolean; onSelect: () => void; projectName?: string }) {
  const pending = session.cards.filter((card) => card.status === "open").length;
  return (
    <button
      className={active ? "session-card active" : "session-card"}
      title={projectName ? `${session.title} · ${projectName}` : session.title}
      onClick={onSelect}
      onContextMenu={(event) => event.preventDefault()}
    >
      <strong>{session.title}</strong>
      <div className="session-meta">
        <span>{pending ? `待处理 ${pending}` : statusLabel(session.status)} · {modelLabel(session)}</span>
        <time>{formatTime(session.updatedAt)}</time>
      </div>
      {projectName && <small className="session-project">{projectName}</small>}
    </button>
  );
}

function Conversation(props: {
  session: Session;
  config: AppConfig | null;
  loading: boolean;
  error: string | null;
  displayMode: ToolDisplayMode;
  setDisplayMode: (mode: ToolDisplayMode) => void;
  modelOptions: ModelOption[];
  modelSwitch: ModelSwitchState | null;
  openPreview: (token: StructuredToken) => void;
  onSwitchModel: (provider: string, model: string, reasoning: string) => void;
}) {
  const [showAllMessages, setShowAllMessages] = useState(false);
  const allVisibleMessages = useMemo(() => visibleConversationMessages(props.session, props.displayMode), [props.session, props.displayMode]);
  useEffect(() => setShowAllMessages(false), [props.session.id, props.displayMode]);
  const renderLimit = 220;
  const hiddenCount = Math.max(0, allVisibleMessages.length - renderLimit);
  const visibleMessages = hiddenCount && !showAllMessages ? allVisibleMessages.slice(-renderLimit) : allVisibleMessages;
  const hasVisibleMessages = visibleMessages.length > 0;
  return (
    <>
      <SessionStatusBar
        session={props.session}
        config={props.config}
        modelOptions={props.modelOptions}
        displayMode={props.displayMode}
        setDisplayMode={props.setDisplayMode}
        modelSwitch={props.modelSwitch}
        onSwitchModel={props.onSwitchModel}
      />
      <div className="messages">
        {props.error && props.session.messages.length > 0 && <div className="inline-error">{props.error}</div>}
        {hiddenCount > 0 && !showAllMessages && (
          <button className="older-messages-button" onClick={() => setShowAllMessages(true)}>
            显示更早 {hiddenCount} 条消息
          </button>
        )}
        {hasVisibleMessages
          ? visibleMessages.map((message) => <MessageBubble key={message.id} session={props.session} message={message} openPreview={props.openPreview} />)
          : <div className="empty-state compact">
              <Bot size={28} />
              <strong>{props.loading ? "正在读取 Codex 会话" : props.error ? "读取 Codex 会话失败" : "已发现 Codex 会话"}</strong>
              <span>{props.error || (props.loading ? "正在从 Codex app-server 加载完整历史消息。" : "选择会话后会加载完整历史消息。")}</span>
            </div>}
      </div>
    </>
  );
}

function visibleConversationMessages(session: Session, displayMode: ToolDisplayMode) {
  const messages = session.messages.filter((message) => message.deliveryState !== "cancelled");
  if (displayMode === "simple") return messages.filter((message) => message.role !== "tool" || hasSubagentTrace(message));
  const lastFileChangeToolId = [...messages].reverse().find(isFileChangeToolMessage)?.id;
  return messages.filter((message) => !isFileChangeToolMessage(message) || message.id === lastFileChangeToolId);
}

function hasSubagentTrace(message: Message) {
  return message.blocks.some((block) =>
    block.type === "subagent_trace" ||
    (block.type === "text" && isSubagentTraceText(block.text))
  );
}

function isFileChangeToolMessage(message: Message) {
  return message.role === "tool" && message.blocks.some((block) =>
    block.type === "text" && /^File change:/i.test(block.text.trim())
  );
}

function currentToolActivity(session: Session, forceActiveRun = false) {
  const busy = ["running", "waiting_approval", "queued"].includes(session.status);
  if (!forceActiveRun && !busy) return null;
  const changedFiles = changedArtifactPaths(session, ["changed", "running", "completed"]);
  if (changedFiles.length) return { label: `编辑了 ${formatFileList(changedFiles)} 文件`, detail: null };
  if (forceActiveRun && !busy) return { label: "思考中", detail: null };
  const toolText = [...session.messages]
    .reverse()
    .flatMap((message) => message.role === "tool" ? message.blocks : [])
    .find((block) => block.type === "subagent_trace" || block.type === "text");
  if (toolText?.type === "subagent_trace") return { label: subagentTraceSummary(toolText.trace), detail: null };
  if (toolText?.type === "text") {
    if (isSubagentTraceText(toolText.text)) return { label: subagentTraceSummary(parseSubagentTrace(toolText.text)), detail: null };
    const parsed = parseCommandOutput(toolText.text);
    if (parsed) return { label: parsed.summary.replace(/^已运行\s+/, "正在运行 "), detail: parsed };
    if (/^File change:/i.test(toolText.text.trim())) return { label: "正在修改文件", detail: null };
  }
  return { label: session.status === "waiting_approval" ? "等待确认" : "思考中", detail: null };
}

function changedArtifactPaths(session: Session, statuses: Array<NonNullable<Artifact["status"]>> = ["changed", "running"]) {
  const paths = session.artifacts
    .filter((artifact) => artifact.kind === "diff" && artifact.path && statuses.includes(artifact.status || "changed"))
    .map((artifact) => artifact.path || "")
    .filter(Boolean);
  return [...new Set(paths)].slice(0, 4);
}

function formatFileList(paths: string[]) {
  if (!paths.length) return "";
  const names = paths.map((path) => path.split("/").filter(Boolean).at(-1) || path);
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} 等 ${names.length} 个`;
}

function ToolActivityFloat({ activity }: { activity: { label: string; detail: ParsedCommandOutput | null } }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="tool-activity-float">
      <button onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
        <span className="thinking-dot" />
        <span>{activity.label}</span>
      </button>
      {expanded && activity.detail && (
        <div className="tool-activity-detail">
          <code><ShellCommand command={activity.detail.command} /></code>
          {activity.detail.output && <pre>{activity.detail.output}</pre>}
        </div>
      )}
    </div>
  );
}

function SessionStatusBar({ session, config, modelOptions, displayMode, setDisplayMode, modelSwitch, onSwitchModel }: {
  session: Session;
  config: AppConfig | null;
  modelOptions: ModelOption[];
  displayMode: ToolDisplayMode;
  setDisplayMode: (mode: ToolDisplayMode) => void;
  modelSwitch: ModelSwitchState | null;
  onSwitchModel: (provider: string, model: string, reasoning: string) => void;
}) {
  const current = `${session.provider}:${session.model}`;
  const visibleModelOptions = modelOptionsForSession(session, modelOptions);
  const option = visibleModelOptions.find((item) => `${item.provider}:${item.model}` === current) || visibleModelOptions[0];
  const reasoningChoices = reasoningChoicesFor(option, session.reasoning);
  const currentValue = option ? `${option.provider}:${option.model}` : current;
  const switching = modelSwitch?.status === "pending";
  return (
    <div className="session-statusbar">
      <span className={`status-dot ${session.status}`} />
      <strong>{statusLabel(session.status)}</strong>
      <select
        aria-label="切换当前会话模型"
        value={currentValue}
        disabled={switching}
        onChange={(event) => {
          const [provider, model] = event.target.value.split(":");
          onSwitchModel(provider, model, session.reasoning);
        }}
      >
        {visibleModelOptions.map((item) => <option key={`${item.provider}:${item.model}`} value={`${item.provider}:${item.model}`}>{modelOptionLabel(item)}</option>)}
      </select>
      <select
        aria-label="切换当前会话 reasoning"
        value={session.reasoning}
        disabled={switching}
        onChange={(event) => {
          const [provider, model] = currentValue.split(":");
          onSwitchModel(provider, model, event.target.value);
        }}
      >
        {reasoningChoices.map((item) => <option key={item}>{item}</option>)}
      </select>
      {modelSwitch && <span>{modelSwitchLabel(modelSwitch)}</span>}
      <span>runner {session.runnerOwner}</span>
      <span>{profileLabel(config, session.automationProfile)} · {session.sandbox || config?.profiles.find((item) => item.id === config.automationProfile)?.sandbox || "sandbox"}</span>
      <span>{option?.status === "mock" ? "dev-test" : option?.status || "unknown"}</span>
      <span>{session.queue.filter((item) => item.state === "pending").length} queued</span>
      <span>{session.metric.inputTokens + session.metric.outputTokens} tokens</span>
      <DisplayModeToggle value={displayMode} onChange={setDisplayMode} />
    </div>
  );
}

function ModelControl({ session, modelOptions, onSwitch }: {
  session: Session;
  modelOptions: ModelOption[];
  onSwitch: (provider: string, model: string, reasoning: string) => void;
}) {
  const visibleModelOptions = modelOptionsForSession(session, modelOptions);
  const current = visibleModelOptions.some((item) => item.provider === session.provider && item.model === session.model)
    ? `${session.provider}:${session.model}`
    : `${visibleModelOptions[0]?.provider || session.provider}:${visibleModelOptions[0]?.model || session.model}`;
  return (
    <div className="model-card">
      <div>
        <span>当前会话模型</span>
        <strong>{modelLabel(session)} · {session.reasoning}</strong>
      </div>
      <select
        value={current}
        onChange={(event) => {
          const [provider, model] = event.target.value.split(":");
          onSwitch(provider, model, session.reasoning);
        }}
      >
        {visibleModelOptions.map((item) => <option key={`${item.provider}:${item.model}`} value={`${item.provider}:${item.model}`}>{modelOptionLabel(item)}</option>)}
      </select>
    </div>
  );
}

function MobileModelDock({ session, modelOptions, displayMode, setDisplayMode, modelSwitch, onSwitch }: {
  session: Session;
  modelOptions: ModelOption[];
  displayMode: ToolDisplayMode;
  setDisplayMode: (mode: ToolDisplayMode) => void;
  modelSwitch: ModelSwitchState | null;
  onSwitch: (provider: string, model: string, reasoning: string) => void;
}) {
  const current = `${session.provider}:${session.model}`;
  const visibleModelOptions = modelOptionsForSession(session, modelOptions);
  const option = visibleModelOptions.find((item) => `${item.provider}:${item.model}` === current) || visibleModelOptions[0];
  const reasoningChoices = reasoningChoicesFor(option, session.reasoning);
  const currentValue = option ? `${option.provider}:${option.model}` : current;
  const switching = modelSwitch?.status === "pending";
  return (
    <div className="mobile-model-dock">
      <select
        className="mobile-model-select"
        value={currentValue}
        aria-label="切换当前会话模型"
        disabled={switching}
        onChange={(event) => {
          const [provider, model] = event.target.value.split(":");
          onSwitch(provider, model, session.reasoning);
        }}
      >
        {visibleModelOptions.map((item) => <option key={`${item.provider}:${item.model}`} value={`${item.provider}:${item.model}`}>{modelOptionShortLabel(item)}</option>)}
      </select>
      <select
        className="mobile-reasoning-select"
        value={session.reasoning}
        aria-label="切换当前会话 reasoning"
        disabled={switching}
        onChange={(event) => {
          const [provider, model] = currentValue.split(":");
          onSwitch(provider, model, event.target.value);
        }}
      >
        {reasoningChoices.map((item) => <option key={item}>{item}</option>)}
      </select>
      <DisplayModeToggle value={displayMode} onChange={setDisplayMode} />
    </div>
  );
}

function DisplayModeToggle({ value, onChange }: { value: ToolDisplayMode; onChange: (mode: ToolDisplayMode) => void }) {
  return (
    <button
      className="display-mode-toggle"
      aria-label="切换工具显示模式"
      title={value === "simple" ? "简易模式：隐藏工具和文件修改明细" : "详细模式：显示全部工具和文件修改"}
      onClick={() => onChange(value === "simple" ? "detailed" : "simple")}
    >
      {value === "simple" ? "简易" : "详细"}
    </button>
  );
}

function RichMarkdown({ markdown, compact = false }: { markdown: string; compact?: boolean }) {
  return (
    <div className={compact ? "markdown-block compact" : "markdown-block"}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, markdownSanitizeSchema], rehypeKatex]}
        components={{
          a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>,
          pre: ({ children }) => <pre className="md-codeblock">{children}</pre>,
          code: ({ className, children, ...props }) => {
            const inline = !className;
            return <code className={inline ? "md-inline-code" : className} {...props}>{children}</code>;
          }
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

function CommandOutputBlock({ parsed, defaultExpanded = false }: { parsed: ParsedCommandOutput; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div className={`command-output ${parsed.status}`}>
      <button className="command-summary" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
        <span><TerminalGlyph /> {parsed.summary}</span>
        <ChevronDown size={15} />
      </button>
      {expanded && (
        <div className="command-detail">
          <code><ShellCommand command={parsed.command} /></code>
          {parsed.output && <pre>{parsed.output}</pre>}
        </div>
      )}
    </div>
  );
}

function FileChangeNotice({ text }: { text: string }) {
  return <div className="tool-notice"><TerminalGlyph /> {text}</div>;
}

function ShellCommand({ command }: { command: string }) {
  const parts = command.split(/(\s+|'.*?'|".*?"|--?[A-Za-z0-9][\w-]*)/g).filter(Boolean);
  return (
    <>
      <span className="shell-prompt">$</span>{" "}
      {parts.map((part, index) => {
        if (/^['"]/.test(part)) return <span key={index} className="shell-string">{part}</span>;
        if (/^--?/.test(part)) return <span key={index} className="shell-flag">{part}</span>;
        if (/^\s+$/.test(part)) return part;
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

function TerminalGlyph() {
  return <span className="terminal-glyph" aria-hidden="true">$</span>;
}

const MessageBubble = React.memo(function MessageBubble({ session, message, openPreview }: {
  session: Session;
  message: Message;
  openPreview: (token: StructuredToken) => void;
}) {
  message = sanitizeMessageText(message);
  if (message.role === "tool") {
    return (
      <div className="tool-inline-row">
        {message.blocks.map((block, index) => {
          if (block.type === "subagent_trace") return <SubagentTraceNotice key={index} trace={block.trace} />;
          if (block.type !== "text") return null;
          const parsed = parseCommandOutput(block.text);
          if (parsed) return <CommandOutputBlock key={index} parsed={parsed} />;
          if (isSubagentTraceText(block.text)) return <SubagentTraceNotice key={index} trace={parseSubagentTrace(block.text)} rawText={block.text} />;
          if (/^File change:/i.test(block.text.trim())) return <FileChangeNotice key={index} text={fileChangeNoticeText(session, block.text)} />;
          return <FileChangeNotice key={index} text={toolNoticeText(block.text)} />;
        })}
      </div>
    );
  }
  return (
    <article className={`bubble ${message.role} ${message.deliveryState ? `delivery-${message.deliveryState}` : ""}`}>
      {message.blocks.map((block, index) => {
        if (block.type === "text") {
          const parsed = message.role === "tool" ? parseCommandOutput(block.text) : null;
          if (!parsed && message.role === "tool" && /^File change:/i.test(block.text.trim())) return <FileChangeNotice key={index} text={fileChangeNoticeText(session, block.text)} />;
          return parsed ? <CommandOutputBlock key={index} parsed={parsed} /> : <RichMarkdown key={index} markdown={block.text} />;
        }
        if (block.type === "subagent_trace") return <SubagentTraceNotice key={index} trace={block.trace} />;
        if (block.type === "tokens") {
          return <div className="token-row" key={index}>{block.tokens.map((token) => <button key={token.id} onClick={() => openPreview(token)}>{token.label}</button>)}</div>;
        }
        return <span className="attachment" key={index}>{block.name}</span>;
      })}
    </article>
  );
});

function SubagentTraceNotice({ trace, rawText }: { trace: SubagentTrace; rawText?: string }) {
  const [open, setOpen] = useState(false);
  const summary = subagentTraceSummary(trace);
  return (
    <>
      <button className="tool-notice subagent-trace" onClick={() => setOpen(true)}>
        <Bot size={13} /> {summary}
      </button>
      {open && (
        <div className="modal subagent-modal">
          <div>
            <Bot size={24} />
            <h3>{summary}</h3>
            <SubagentTraceDetail trace={trace} rawText={rawText} />
            <button className="primary" onClick={() => setOpen(false)}>关闭</button>
          </div>
        </div>
      )}
    </>
  );
}

function SubagentTraceDetail({ trace, rawText }: { trace: SubagentTrace; rawText?: string }) {
  return (
    <div className="subagent-detail">
      <div>
        <span>status</span>
        <strong>{trace.status || "updated"}</strong>
      </div>
      <div>
        <span>agent</span>
        <strong>{trace.agentName || trace.agentType || "subagent"}</strong>
      </div>
      {trace.agentType && <div><span>type</span><strong>{trace.agentType}</strong></div>}
      {trace.method && <div><span>method</span><strong>{trace.method}</strong></div>}
      <div>
        <span>interaction</span>
        <strong>{trace.interaction.supported ? "可交互" : "只读 trace"}</strong>
      </div>
      <p>{trace.summary || "Provider 未提供摘要。"}</p>
      <p>{trace.interaction.reason}</p>
      <div className="subagent-actions">
        {trace.interaction.actions.map((action) => (
          <button key={action.id} disabled={!action.enabled}>{action.label}</button>
        ))}
      </div>
      <pre>{rawText || JSON.stringify(trace.raw || trace, null, 2)}</pre>
    </div>
  );
}

function isSubagentTraceText(text: string) {
  return /^Subagent trace:/i.test(text.trim()) || /\b(spawn_agent|wait_agent|subagent)\b/i.test(text);
}

function subagentTraceSummary(trace: SubagentTrace) {
  const status = trace.status || "updated";
  const agent = trace.agentName || trace.agentType || "subagent";
  return `Subagent ${agent} · ${status}`;
}

function parseSubagentTrace(text: string): SubagentTrace {
  const fields: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^([A-Za-z _-]+):\s*(.*)$/);
    if (!match) continue;
    const key = match[1].toLowerCase().replace(/\s+/g, " ");
    if (key === "subagent trace") fields.status = match[2].trim();
    else fields[key] = match[2].trim();
  }
  return {
    id: fields.id || fields.item || `legacy-subagent-${stableTextHash(text)}`,
    status: fields.status || "updated",
    agentName: fields.agent || fields.name || fields.type || "subagent",
    agentId: fields.agent_id || undefined,
    agentType: fields.type || undefined,
    method: fields.method || undefined,
    summary: fields.summary || undefined,
    raw: fields.raw || text,
    interaction: {
      supported: false,
      reason: "这是兼容旧文本格式解析出的 Subagent trace；当前 provider 未暴露可继续交互的 Subagent channel。",
      actions: [{ id: "open_detail", label: "查看详情", enabled: true }]
    }
  };
}

function stableTextHash(text: string) {
  let hash = 5381;
  for (const char of text) hash = ((hash << 5) + hash + char.charCodeAt(0)) >>> 0;
  return hash.toString(36);
}

function fileChangeNoticeText(session: Session, text: string) {
  const status = text.trim().match(/^File change:\s*([^\n]+)/i)?.[1]?.trim().toLowerCase() || "";
  const paths = fileChangeNoticePaths(session, text);
  const filePart = paths.length ? `${formatFileList(paths)} 文件` : "文件";
  if (status.includes("completed") || status.includes("success")) return `编辑完成：${filePart}`;
  if (status.includes("failed")) return `编辑失败：${filePart}`;
  if (status.includes("declined")) return `编辑已拒绝：${filePart}`;
  if (status.includes("running")) return `正在编辑：${filePart}`;
  return `文件变更：${filePart}`;
}

function fileChangeNoticePaths(session: Session, text: string) {
  const artifactPaths = changedArtifactPaths(session, ["completed", "changed", "running", "failed", "declined", "unsupported"]);
  const allFileChangeText = session.messages
    .filter(isFileChangeToolMessage)
    .flatMap((message) => message.blocks)
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
  const textPaths = extractPathsFromToolText(`${text}\n${allFileChangeText}`);
  return [...new Set([...artifactPaths, ...textPaths])].slice(0, 6);
}

function extractPathsFromToolText(text: string) {
  const paths = new Set<string>();
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    const match = trimmed.match(/(?:changed|created|updated|deleted|modified|path)\s*:\s*(.+)$/i);
    const candidate = (match?.[1] || (/^(?:\/|\.)?[\w.-]+(?:\/[\w .@()[\]-]+)+$/.test(trimmed) ? trimmed : "")).trim();
    if (candidate) paths.add(candidate.replace(/^["']|["']$/g, ""));
    for (const pathMatch of trimmed.matchAll(/(?:^|\s)((?:\/|\.\/|[\w.-]+\/)[\w .@()[\]\/-]+\.[A-Za-z0-9]{1,12})(?=\s|$)/g)) {
      if (pathMatch[1]) paths.add(pathMatch[1].replace(/^["']|["']$/g, ""));
    }
  }
  return [...paths];
}

function toolNoticeText(text: string) {
  const firstLine = text.trim().split("\n").find(Boolean) || "工具调用";
  return firstLine.length > 72 ? `${firstLine.slice(0, 69)}...` : firstLine;
}

function PendingBar(props: {
  cards: RequestCard[];
  qaRun: QaRun | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  onCardAction: (card: RequestCard, action: string) => void;
  onQaItem: (runId: string, itemId: string, status: "pass" | "fail") => void;
  onQaComplete: (runId: string) => void;
}) {
  const qaPending = props.qaRun?.items.filter((item) => item.status === "pending").length || 0;
  const count = props.cards.length + qaPending;
  if (!count) return null;
  const headline = props.cards[0]?.title || props.qaRun?.title || "待处理事项";
  return (
    <>
      <div className="pending-strip">
        <div>
          <strong>待处理 {count}</strong>
          <span>{headline}</span>
        </div>
        <button onClick={() => props.setOpen(true)}>查看 <ChevronDown size={14} /></button>
      </div>
      {props.open && (
        <div className="pending-layer">
          <button className="pending-backdrop" aria-label="关闭待处理窗口" onClick={() => props.setOpen(false)} />
          <section className="pending-panel">
            <header>
              <div>
                <span>待处理</span>
                <strong>{count} 项需要确认</strong>
              </div>
              <button onClick={() => props.setOpen(false)}><X size={18} /></button>
            </header>
            <div className="pending-list">
              {props.cards.map((card) => (
                <RequestCardView key={card.id} card={card} onAction={(actionId) => props.onCardAction(card, actionId)} />
              ))}
              {props.qaRun && <QaPanel run={props.qaRun} onItem={props.onQaItem} onComplete={props.onQaComplete} compact />}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function RequestCardView({ card, onAction }: { card: RequestCard; onAction: (action: string) => void }) {
  const open = card.status === "open";
  return (
    <article className={`request-card ${card.kind} ${card.status}`}>
      <span>{cardKindLabel(card.kind)} · {cardStatusLabel(card.status)}</span>
      <strong>{card.title}</strong>
      <p>{card.body}</p>
      <div>{card.actions.map((action) => <button key={action.id} className={action.tone || ""} disabled={!open} onClick={() => onAction(action.id)}>{action.label}</button>)}</div>
    </article>
  );
}

function QueueDock({ items, onClear }: { items: QueueItem[]; onClear: () => void }) {
  if (!items.length) return null;
  const visible = items.slice(0, 3);
  return (
    <div className="queue-dock">
      <div className="queue-dock-summary">
        <span>{items.length} queued</span>
        <strong>{visible[0]?.text || "Pending message"}</strong>
      </div>
      <div className="queue-dock-items" aria-label="当前排队消息">
        {visible.map((item, index) => (
          <span key={item.id} title={item.text}>{index + 1}. {item.text}</span>
        ))}
        {items.length > visible.length && <span>+{items.length - visible.length} more</span>}
      </div>
      <button onClick={onClear}><Trash2 size={15} /> Clear Queue</button>
    </div>
  );
}

function ErrorDock({ errors, onRetry, onDismiss }: { errors: AppError[]; onRetry: (error: AppError) => void; onDismiss: (id: string) => void }) {
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    if (!errors.some((error) => error.retry.cooldownMs)) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [errors]);
  if (!errors.length) return null;
  return (
    <div className="error-dock" aria-label="错误与重试">
      {errors.slice(0, 3).map((error) => {
        const remaining = retryCooldownRemaining(error, nowMs);
        return (
          <article key={error.id} className={`error-card ${error.type}`}>
            <div className="error-card-main">
              <span>{error.statusCode ? `${error.statusCode} · ${errorTypeLabel(error.type)}` : errorTypeLabel(error.type)}</span>
              <strong>{error.title}</strong>
              <p>{error.message}</p>
              {error.technicalDetail && (
                <details>
                  <summary>技术详情</summary>
                  <code>{error.technicalDetail}</code>
                </details>
              )}
            </div>
            <div className="error-card-actions">
              {error.retry.kind !== "none" && <button disabled={remaining > 0} onClick={() => onRetry(error)}>{remaining > 0 ? `${error.retry.label} ${remaining}s` : error.retry.label}</button>}
              <button onClick={() => onDismiss(error.id)}><X size={15} /></button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Composer(props: {
  sessionId: string;
  mobileAutoFocus: boolean;
  draft: string;
  setDraft: (value: string) => void;
  tokens: StructuredToken[];
  setTokens: React.Dispatch<React.SetStateAction<StructuredToken[]>>;
  completions: CompletionItem[];
  chooseCompletion: (item: CompletionItem) => void;
  sendMessage: () => void;
  sending: boolean;
  canSend: boolean;
  onAction: (type: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const wasSendingRef = useRef(false);

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    const maxHeight = expanded ? 320 : 148;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, [expanded]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const closeOnEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEsc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEsc);
    };
  }, [menuOpen]);

  useEffect(() => {
    adjustTextareaHeight();
  }, [props.draft, props.tokens.length, expanded, adjustTextareaHeight]);

  useEffect(() => {
    if (!props.mobileAutoFocus || !props.sessionId || window.innerWidth > mobileBreakpoint) return;
    const timer = window.setTimeout(() => {
      textareaRef.current?.focus({ preventScroll: true });
      syncViewportVars();
    }, 90);
    return () => window.clearTimeout(timer);
  }, [props.sessionId, props.mobileAutoFocus]);

  useEffect(() => {
    if (wasSendingRef.current && !props.sending && window.innerWidth <= mobileBreakpoint) {
      textareaRef.current?.focus({ preventScroll: true });
      syncViewportVars();
    }
    wasSendingRef.current = props.sending;
  }, [props.sending]);

  const runAction = (type: string) => {
    setMenuOpen(false);
    props.onAction(type);
  };

  return (
    <div className="composer">
      <div className="composer-tools" ref={menuRef}>
        <button onClick={() => setMenuOpen(!menuOpen)}><Paperclip size={18} /></button>
        {menuOpen && (
          <div className="action-menu">
            <button onClick={() => runAction("upload_image_mock")}><Image size={15} /> 添加图片</button>
            <button onClick={() => runAction("upload_file_mock")}><FileText size={15} /> 添加文件</button>
            <button onClick={() => runAction("clear_queue")}><Trash2 size={15} /> 清空队列</button>
            <button className="danger" onClick={() => runAction("interrupt")}><CircleStop size={15} /> Interrupt</button>
          </div>
        )}
      </div>
      <div className={expanded ? "composer-input expanded" : "composer-input"}>
        <div className="draft-tokens">
          {props.tokens.map((token) => <span key={token.id}>{token.label}<button onClick={() => props.setTokens((prev) => prev.filter((item) => item.id !== token.id))}><X size={12} /></button></span>)}
        </div>
        <textarea
          ref={textareaRef}
          value={props.draft}
          onChange={(event) => {
            props.setDraft(event.target.value);
            window.requestAnimationFrame(adjustTextareaHeight);
          }}
          onInput={() => window.requestAnimationFrame(adjustTextareaHeight)}
          onFocus={() => {
            if (window.innerWidth <= mobileBreakpoint) {
              syncViewportVars();
              window.requestAnimationFrame(syncViewportVars);
              for (const delay of [40, 120, 240]) window.setTimeout(syncViewportVars, delay);
            }
          }}
          onKeyDown={(event) => {
            if ((event.key === "Enter" && (event.metaKey || event.ctrlKey)) || (event.key === "Enter" && !event.shiftKey)) {
              event.preventDefault();
              void props.sendMessage();
            }
          }}
          placeholder="给 Codex 发消息..."
          rows={1}
        />
        <button
          className="composer-expand"
          title={expanded ? "收起输入框" : "展开输入框"}
          aria-label={expanded ? "收起输入框" : "展开输入框"}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
        {!!props.completions.length && (
          <div className="autocomplete">
            {props.completions.map((item) => (
              <button key={item.id} onMouseDown={(event) => event.preventDefault()} onClick={() => props.chooseCompletion(item)}>
                <strong>{completionInsertText(item)}</strong>
                <small>{item.group} · 插入正文</small>
              </button>
            ))}
          </div>
        )}
      </div>
      <button className={props.sending ? "send busy" : props.canSend ? "send enabled" : "send"} disabled={!props.canSend} onClick={() => void props.sendMessage()}><Send size={18} /> {props.sending ? "发送中" : "发送"}</button>
    </div>
  );
}

function WorkflowPanel({ workflow, onAction }: { workflow: WorkflowSnapshot | null; onAction: (type: string, extra?: Record<string, unknown>) => void }) {
  const [syncOpen, setSyncOpen] = useState(false);
  if (!workflow) return <div className="panel empty">正在读取项目状态。</div>;
  if (!workflow.hasWorkflow) {
    return (
      <div className="panel workflow-panel">
        <header className="panel-head">
          <div>
            <h2>Project Status</h2>
            <span>{workflow.project.name}</span>
          </div>
        </header>
        <div className="workflow-empty">
          <Workflow size={24} />
          <strong>未检测到 Hypo-Workflow</strong>
          <p>这个 Project 没有 `.pipeline/config.yaml` 和 `.pipeline/state.yaml`。右侧栏暂时显示通用项目状态；会话、模型切换和左侧 Activity 仍可使用。</p>
        </div>
        <h3>可读资源</h3>
        <div className="resource-links">
          <button onClick={() => onAction("open_resource", { value: "Project path" })}><FileText size={15} /><div><strong>Project path</strong><small>{workflow.project.path}</small></div></button>
        </div>
      </div>
    );
  }
  return (
    <div className="panel workflow-panel">
      <header className="panel-head">
        <div>
          <h2>Hypo-Workflow</h2>
          <span>{workflow?.phase || "unknown"} · {workflow?.project.name || "Project"}</span>
        </div>
        <div className="workflow-actions">
          <button onClick={() => onAction("workflow_check")}><Check size={14} /> Check</button>
          <button onClick={() => setSyncOpen(!syncOpen)}><SlidersHorizontal size={14} /> 维护</button>
        </div>
      </header>
      {syncOpen && (
        <div className="sync-confirm">
          <strong>Sync 会刷新 derived context</strong>
          <p>包含 PROGRESS、compact 摘要和知识索引缓存。执行结果会进入 Activity。</p>
          <button onClick={() => { setSyncOpen(false); onAction("workflow_sync"); }}>确认 Sync</button>
        </div>
      )}

      <h3>Progress</h3>
      <div className="progress-list">
        {(workflow?.milestones || []).map((item) => (
          <article key={item.id} className={item.current ? "current" : ""}>
            <span>{item.id}</span>
            <strong>{item.name}</strong>
            <em>{item.current ? "当前" : statusLabel(item.status)}</em>
          </article>
        ))}
      </div>

      <h3>当前 Milestone 摘要</h3>
      <MarkdownBlock markdown={workflow.compactPlan || "暂无 compact 摘要。"} />

      <h3>Config</h3>
      <div className="config-list">
        {(workflow?.configItems || []).map((item) => <ConfigCard key={item.id} item={item} onAction={onAction} />)}
      </div>

      <h3>只读入口</h3>
      <div className="resource-links">
        <button onClick={() => onAction("open_resource", { value: "Architecture" })}><FileText size={15} /><div><strong>Architecture</strong><small>{workflow?.architectureRef?.path || ".pipeline/architecture.md"}</small></div></button>
        <button onClick={() => onAction("open_resource", { value: "Knowledge" })}><Workflow size={15} /><div><strong>Knowledge</strong><small>{workflow?.knowledgeRoot || ".pipeline/knowledge/"}</small></div></button>
      </div>
    </div>
  );
}

function MarkdownBlock({ markdown }: { markdown: string }) {
  return <RichMarkdown markdown={markdown} compact />;
}

function ConfigCard({ item, onAction }: { item: WorkflowConfigItem; onAction: (type: string, extra?: Record<string, unknown>) => void }) {
  return (
    <article className="config-card">
      <div>
        <strong>{item.label}</strong>
        <span>{item.description}</span>
      </div>
      <select value={item.value} onChange={(event) => onAction("config_update", { configId: item.id, value: event.target.value })}>
        {(item.choices || [item.value]).map((choice) => <option key={choice}>{choice}</option>)}
      </select>
    </article>
  );
}

function SkillPanel({ preview, completions, onPreview }: { preview: Preview | null; completions: CompletionItem[]; onPreview: (item: CompletionItem) => void }) {
  return (
    <div className="panel">
      <h2>Skill / Command</h2>
      {preview ? (
        <div className="preview-box">
          <div>
            <strong>{preview.title}</strong>
            {preview.description && <p>{preview.description}</p>}
            <code>{preview.path || preview.kind}</code>
          </div>
          {preview.path?.endsWith(".md") || preview.path?.endsWith("SKILL.md")
            ? <RichMarkdown markdown={preview.body || "暂无内容。"} compact />
            : <pre>{preview.body || "暂无内容。"}</pre>}
        </div>
      ) : <div className="empty small">选择一个 Skill、Command 或 File 查看完整内容。</div>}
      <div className="skill-list">
        {completions.map((item) => (
          <button key={item.id} onClick={() => onPreview(item)} title={item.path || item.description || item.label}>
            <span>{item.group}</span>
            <strong>{item.label}</strong>
            <small>{item.path ? displayPreviewPath(item.path) : item.description}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function displayPreviewPath(path: string) {
  const normalized = path.replace(/\\/g, "/");
  if (normalized.includes("/.codex/skills/")) return normalized.split("/.codex/skills/")[1] || normalized;
  if (normalized.includes("/.pipeline/")) return `.pipeline/${normalized.split("/.pipeline/")[1]}`;
  return normalized.length > 64 ? `...${normalized.slice(-61)}` : normalized;
}

function ArtifactPanel({ session, preview, onPreview }: { session: Session | null; preview: Preview | null; onPreview: (artifact: Artifact) => void }) {
  const artifacts = session?.artifacts || [];
  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>Artifacts</h2>
          <span>{artifacts.length ? `${artifacts.length} entries` : "No artifacts"}</span>
        </div>
      </div>
      {preview ? (
        <div className={`preview-box ${preview.previewStatus}`}>
          <strong>{preview.title}</strong>
          <p>{preview.description}</p>
          {preview.path && <code>{preview.path}</code>}
          <pre>{preview.body}</pre>
        </div>
      ) : <div className="empty">当前 session 的命令输出、diff 和文件预览会出现在这里。</div>}
      <div className="artifact-list">
        {artifacts.map((artifact) => (
          <button key={artifact.id} onClick={() => onPreview(artifact)} title={artifact.path || artifact.title}>
            <span>{artifact.kind || "artifact"} · {artifact.status || artifact.previewStatus}</span>
            <strong>{artifactTitle(artifact, session)}</strong>
            <small>{displayArtifactPath(artifact.path, session) || artifact.mime || "inline preview"}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function artifactTitle(artifact: Artifact, session: Session | null) {
  if ((artifact.kind === "diff" || artifact.kind === "file") && artifact.path) {
    const prefix = artifact.title.split(":")[0] || artifact.kind;
    return `${prefix}: ${displayArtifactPath(artifact.path, session)}`;
  }
  return artifact.title;
}

function displayArtifactPath(path: string | undefined, session: Session | null) {
  if (!path) return "";
  if (session?.cwd && path.startsWith(`${session.cwd}/`)) return path.slice(session.cwd.length + 1);
  return path.replace(/^.*\/([^/]+)$/, "$1");
}

function SettingsPanel({
  config,
  codexHealth,
  onStartCodex,
  onUpdate
}: {
  config: AppConfig | null;
  codexHealth: CodexProviderHealth | null;
  onStartCodex: () => void;
  onUpdate: (patch: Partial<Pick<AppConfig, "deploymentMode" | "dataMode" | "automationProfile">>) => void;
}) {
  if (!config) return <div className="panel empty">正在读取实例配置。</div>;
  const active = config.profiles.find((profile) => profile.id === config.automationProfile) || config.profiles[0];
  return (
    <div className="panel settings-panel">
      <h2>Settings</h2>
      <div className="settings-summary">
        <strong>{active?.label || config.automationProfile}</strong>
        <span>{active?.approvalPolicy || "approval"} · {active?.sandbox || "sandbox"} · {active?.approvalsReviewer || "reviewer"}</span>
        <small>{config.configPath}</small>
      </div>
      <div className={`provider-health compact ${codexHealth?.status || "stopped"}`}>
        <div>
          <strong>Codex app-server</strong>
          <span>{codexHealth?.status || "stopped"} · {codexHealth?.transport || "stdio"}</span>
          {codexHealth?.userAgent && <small>{codexHealth.userAgent}</small>}
          {codexHealth?.lastError && <small>{codexHealth.lastError}</small>}
        </div>
        <button onClick={onStartCodex} disabled={codexHealth?.status === "starting" || codexHealth?.status === "ready"}>
          {codexHealth?.status === "ready" ? "已连接" : "启动"}
        </button>
      </div>
      <ConfigSelect
        label="部署模式"
        description="本地模式可默认使用更高自动化；发布模式由设置显式控制。"
        value={config.deploymentMode}
        choices={["local", "release"]}
        onChange={(value) => onUpdate({ deploymentMode: value as DeploymentMode })}
      />
      <ConfigSelect
        label="数据模式"
        description="正常模式等待 Codex 真实发现；开发测试模式显示 C1 mock fixtures。"
        value={config.dataMode}
        choices={["codex", "dev-test"]}
        onChange={(value) => onUpdate({ dataMode: value as DataMode })}
      />
      <ConfigSelect
        label="自动化程度"
        description="该选择会作为后续 Codex thread/start 的 approval 和 sandbox 输入。"
        value={config.automationProfile}
        choices={config.profiles.map((profile) => profile.id)}
        labels={Object.fromEntries(config.profiles.map((profile) => [profile.id, profile.label]))}
        onChange={(value) => onUpdate({ automationProfile: value as AutomationProfileId })}
      />
      <div className="profile-list">
        {config.profiles.map((profile) => (
          <article key={profile.id} className={profile.id === config.automationProfile ? "active" : ""}>
            <strong>{profile.label}</strong>
            <span>{profile.description}</span>
            <small>{profile.approvalPolicy} · {profile.sandbox} · {profile.approvalsReviewer}</small>
          </article>
        ))}
      </div>
    </div>
  );
}

function ProviderStatusBadge({ health, compact = false }: { health: CodexProviderHealth | null; compact?: boolean }) {
  const status = health?.status || "stopped";
  const label = status === "ready" ? "Codex ready" : status === "starting" ? "Codex starting" : "Codex offline";
  const shortLabel = status === "ready" ? "ready" : status === "starting" ? "starting" : "offline";
  return (
    <div className={`provider-badge ${status}`} title={health?.lastError || health?.userAgent || label}>
      <span />
      <small>{compact ? shortLabel : label}</small>
    </div>
  );
}

function ConfigSelect({
  label,
  description,
  value,
  choices,
  labels = {},
  onChange
}: {
  label: string;
  description: string;
  value: string;
  choices: string[];
  labels?: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="settings-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {choices.map((choice) => <option key={choice} value={choice}>{labels[choice] || choice}</option>)}
      </select>
      <small>{description}</small>
    </label>
  );
}

function ActivityBlock(props: {
  events: VspEvent[];
  scope: ActivityScope;
  setScope: (scope: ActivityScope) => void;
  activeProject: Project | null;
  session: Session | null;
}) {
  return (
    <div className="activity-block">
      <SectionHeader label="Activity" count={props.events.length} />
      <ScopeControl scope={props.scope} setScope={props.setScope} />
      <ActivityList events={props.events.slice(0, 9)} />
    </div>
  );
}

function ActivityPanel(props: {
  events: VspEvent[];
  scope: ActivityScope;
  setScope: (scope: ActivityScope) => void;
  activeProject: Project | null;
  session: Session | null;
}) {
  return (
    <div className="panel">
      <h2>Activity</h2>
      <ScopeControl scope={props.scope} setScope={props.setScope} />
      <ActivityList events={props.events.slice(0, 40)} />
    </div>
  );
}

function ScopeControl({ scope, setScope }: { scope: ActivityScope; setScope: (scope: ActivityScope) => void }) {
  return (
    <div className="scope-control">
      <button className={scope === "all" ? "active" : ""} onClick={() => setScope("all")}>全部事件</button>
      <button className={scope === "project" ? "active" : ""} onClick={() => setScope("project")}>当前项目</button>
      <button className={scope === "session" ? "active" : ""} onClick={() => setScope("session")}>当前会话</button>
    </div>
  );
}

function ActivityList({ events }: { events: VspEvent[] }) {
  if (!events.length) return <div className="empty small">暂无事件</div>;
  return (
    <div className="activity-list">
      {events.map((event) => (
        <article key={event.id}>
          <span className={`event-dot ${event.type}`} />
          <div>
            <strong>{event.message}</strong>
            <small>{event.type} · {formatTime(event.createdAt)}</small>
          </div>
        </article>
      ))}
    </div>
  );
}

function QaPanel({ run, onItem, onComplete, compact = false }: {
  run: QaRun | null;
  onItem: (runId: string, itemId: string, status: "pass" | "fail") => void;
  onComplete: (runId: string) => void;
  compact?: boolean;
}) {
  if (!run) return <div className="panel empty">发送“开始测试”后会生成 C1 QA checklist。</div>;
  return (
    <div className={compact ? "qa compact" : "panel qa"}>
      <h2>{run.title}</h2>
      {run.items.map((item) => (
        <article key={item.id} className={`qa-item ${item.status}`}>
          <span>{item.label}</span>
          <strong>{qaStatusLabel(item.status)}</strong>
          <button className={item.status === "pass" ? "qa-pass selected" : "qa-pass"} onClick={() => onItem(run.id, item.id, "pass")}>Pass</button>
          <button className={item.status === "fail" ? "qa-fail selected" : "qa-fail"} onClick={() => onItem(run.id, item.id, "fail")}>Fail</button>
        </article>
      ))}
      <button className={run.items.some((item) => item.status === "pending") ? "secondary" : "primary"} onClick={() => onComplete(run.id)}>完成 QA</button>
    </div>
  );
}

function EmptyState() {
  return <div className="empty-state"><Smartphone size={36} /><strong>选择一个会话开始</strong><span>左侧会话会保持后台运行，切换不会断开 runner。</span></div>;
}

function sortSessionsByLastSettled(sessions: Session[], sortTimes: Map<string, number>, statuses: Map<string, Session["status"]>) {
  const ids = new Set(sessions.map((session) => session.id));
  for (const id of [...sortTimes.keys()]) if (!ids.has(id)) sortTimes.delete(id);
  for (const id of [...statuses.keys()]) if (!ids.has(id)) statuses.delete(id);
  for (const session of sessions) {
    const existing = sortTimes.get(session.id);
    const settled = !["running", "waiting_approval", "queued"].includes(session.status);
    const previousStatus = statuses.get(session.id);
    const wasBusy = previousStatus ? ["running", "waiting_approval", "queued"].includes(previousStatus) : false;
    if (typeof existing === "undefined" || (settled && wasBusy)) {
      sortTimes.set(session.id, new Date(session.updatedAt).getTime());
    }
    statuses.set(session.id, session.status);
  }
  return [...sessions].sort((a, b) => (sortTimes.get(b.id) || 0) - (sortTimes.get(a.id) || 0));
}

function modelOptionsForSession(session: Session, options: ModelOption[]) {
  const filtered = options.filter((item) => item.provider === session.provider);
  return filtered.length ? filtered : options;
}

function reasoningChoicesFor(option: ModelOption | undefined, current: string) {
  const choices = option?.reasoning.filter(Boolean) || [];
  if (!choices.length) return current ? [current] : [];
  return choices.includes(current) ? choices : [current, ...choices];
}

function modelSwitchLabel(state: ModelSwitchState) {
  if (state.status === "pending") return `模型切换中 · ${state.target.reasoning}`;
  if (state.status === "success") return `已切换 · ${state.target.reasoning}`;
  return `切换失败 · 可重试`;
}

function retryLabel(kind: AppError["retry"]["kind"]) {
  const labels: Record<AppError["retry"]["kind"], string> = {
    none: "无需重试",
    retry_request: "重试请求",
    retry_send: "重试发送",
    refresh_state: "重新刷新",
    reconnect_sse: "重新连接",
    retry_queue: "重试队列"
  };
  return labels[kind];
}

function shouldKeepRateLimitRetry(error: AppError) {
  return error.statusCode === 429 && typeof error.retry.cooldownMs === "number" && error.retry.cooldownMs > 0;
}

function errorTypeLabel(type: AppError["type"]) {
  const labels: Record<AppError["type"], string> = {
    http: "HTTP",
    rate_limit: "限流",
    provider: "Provider",
    sse: "实时连接",
    send: "发送",
    refresh: "刷新",
    queue: "队列",
    unknown: "错误"
  };
  return labels[type];
}

function retryCooldownRemaining(error: AppError, nowMs: number) {
  if (!error.retry.cooldownMs) return 0;
  const startedAt = new Date(error.createdAt).getTime();
  if (!Number.isFinite(startedAt)) return 0;
  return Math.max(0, Math.ceil((startedAt + error.retry.cooldownMs - nowMs) / 1000));
}

function selectionFallbackMessage(reason: "missing_project" | "missing_session" | "empty_project" | "first_available" | "none") {
  const labels = {
    none: "",
    missing_project: "上次选择的 Project 不可用，已切换到可用工作区。",
    missing_session: "上次选择的 Session 不可用，已切换到可用会话。",
    empty_project: "上次选择的 Project 暂无会话。",
    first_available: "已打开最近可用会话。"
  };
  return labels[reason];
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    idle: "空闲",
    running: "运行中",
    queued: "排队",
    waiting_approval: "等待审批",
    interrupted: "已中断",
    done: "已完成",
    error: "错误",
    pending: "待执行",
    complete: "完成",
    blocked: "阻塞",
    unknown: "未知"
  };
  return labels[status] || status;
}

function cardKindLabel(kind: RequestCard["kind"]) {
  const labels: Record<RequestCard["kind"], string> = {
    approval: "审批",
    user_input: "Ask Tool",
    settings: "设置",
    danger_confirm: "危险确认"
  };
  return labels[kind];
}

function cardStatusLabel(status: RequestCard["status"]) {
  const labels: Record<RequestCard["status"], string> = {
    open: "待确认",
    resolved: "已通过",
    denied: "已拒绝",
    failed: "回写失败",
    expired: "已取消"
  };
  return labels[status];
}

function qaStatusLabel(status: QaRun["items"][number]["status"]) {
  const labels = { pending: "待判断", pass: "PASS", fail: "FAIL" };
  return labels[status];
}

function modelLabel(session: Session) {
  return `${providerLabel(session.provider)} · ${session.model}`;
}

function modelOptionLabel(option: ModelOption) {
  return option.status === "mock" ? `${option.label} (mock)` : option.label;
}

function modelOptionShortLabel(option: ModelOption) {
  if (option.provider === "codex" && option.model === "codex-default") return "Codex";
  const label = modelOptionLabel(option).replace(/\s*\(mock\)$/i, "");
  return label.length > 12 ? `${label.slice(0, 11)}...` : label;
}

function providerLabel(provider: string) {
  const labels: Record<string, string> = {
    mock: "Mock",
    codex: "Codex",
    opencode: "OpenCode",
    claude: "Claude Code"
  };
  return labels[provider] || provider;
}

function profileLabel(config: AppConfig | null, fallback?: string) {
  const id = fallback || config?.automationProfile;
  return config?.profiles.find((profile) => profile.id === id)?.label || id || "profile";
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

createRoot(document.getElementById("root")!).render(<App />);

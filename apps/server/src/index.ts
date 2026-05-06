import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { basename, extname, join, resolve } from "node:path";
import { CodexAppServerManager } from "./codex.js";
import { mergeArtifactUpdates } from "./codexArtifacts.js";
import { mapCodexNotification, type LiveSessionPatch } from "./codexEvents.js";
import { discoverCodexState, mapThreadToVspSession, readCodexSession } from "./codexDiscovery.js";
import {
  clearPendingQueue,
  codexSessionIsBusy,
  enqueuePendingMessage,
  markActiveSessionUnavailable,
  markQueueItemPending,
  markQueueItemSent,
  nextPendingQueueItem
} from "./codexQueue.js";
import {
  autoResolutionFor,
  codexResponseForAction,
  mapCodexServerRequest,
  shouldAutoResolveRequest,
  threadStartOverrides,
  turnStartOverrides,
  type CodexServerRequest,
  type PendingCodexRequest
} from "./codexRequests.js";
import { MockStore, projectRoot } from "./store.js";
import { previewArtifact } from "./preview.js";
import { setCodexThreadName } from "./codexRename.js";
import { mergeProviderRefresh } from "./codexSessionMerge.js";
import { fallbackCodexModelOptions, listCodexModelOptions } from "./codexModels.js";
import { profileForCwd, selfProtectionOverrides } from "./selfProtection.js";
import { createTmpQaFixture } from "./tmpQa.js";
import type { CodexDiscoverySnapshot } from "./codexDiscovery.js";
import type { AutomationProfile, CodexProviderHealth, ModelOption, Project, RequestCard, Session, SessionActionRequest, VspState } from "@vsp-coder/protocol";

const defaultPort = 4180;
const host = process.env.HOST || process.env.VSP_CODER_HOST || "0.0.0.0";
const port = Number(process.env.PORT || process.env.VSP_CODER_PORT || defaultPort);
const webDist = join(projectRoot, "apps/web/dist");
const store = new MockStore();
const codex = new CodexAppServerManager();
const discoveryCache: {
  snapshot: CodexDiscoverySnapshot | null;
  fetchedAt: number;
  inflight: Promise<CodexDiscoverySnapshot> | null;
} = { snapshot: null, fetchedAt: 0, inflight: null };
const sessionCache = new Map<string, { session: Session; fetchedAt: number }>();
const sessionInflight = new Map<string, Promise<Session>>();
const pendingCodexRequests = new Map<string, PendingCodexRequest>();
const discoveryCacheTtlMs = 2_000;
const sessionFreshTtlMs = 3_000;
const busySessionFreshTtlMs = 500;
const sessionStaleTtlMs = 60_000;
const modelCache: { options: ModelOption[] | null; fetchedAt: number } = { options: null, fetchedAt: 0 };
const modelCacheTtlMs = 60_000;
const subagentExpectations = new Map<string, { itemId: string; requestedAt: number; text: string; observed: boolean }>();

codex.on("health", (health) => {
  store.recordEvent({
    type: health.status === "ready" ? "session_updated" : "error",
    message: `Codex app-server ${health.status}`,
    payload: health
  });
  void handleCodexHealth(health).catch((error) => {
    store.recordEvent({ type: "error", message: `Codex recovery failed: ${error instanceof Error ? error.message : String(error)}` });
  });
});
codex.on("stderr", (message) => {
  if (isNonBlockingCodexStderr(message)) return;
  store.recordEvent({ type: message.includes("WARN") ? "warning" : "error", message: `Codex app-server: ${message}` });
});
codex.on("protocol-error", (error) => {
  store.recordEvent({ type: "error", message: `Codex protocol error: ${error instanceof Error ? error.message : String(error)}` });
});
codex.on("notification", (notification) => {
  handleCodexNotification(notification as { method: string; params?: unknown });
});
codex.on("request", (request) => {
  void handleCodexRequest(request as CodexServerRequest).catch((error) => {
    store.recordEvent({ type: "error", message: `Codex request handling failed: ${error instanceof Error ? error.message : String(error)}` });
  });
});

const server = createServer(async (req, res) => {
  try {
    await route(req, res);
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status: number }).status) : 500;
    json(res, status, { error: error instanceof Error ? error.message : String(error) });
  }
});

async function route(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (url.pathname === "/api/health") {
    const config = store.getConfig();
    return json(res, 200, {
      ok: true,
      service: "vsp-coder",
      dataMode: config.dataMode,
      deploymentMode: config.deploymentMode,
      automationProfile: config.automationProfile
    });
  }
  if (url.pathname === "/api/events") return sse(req, res);
  if (url.pathname === "/api/state") return json(res, 200, await stateSnapshot());
  if (url.pathname === "/api/config" && req.method === "GET") return json(res, 200, store.getConfig());
  if (url.pathname === "/api/config" && req.method === "PUT") {
    const config = store.updateConfig(await body(req));
    await reconcileFullAutoPendingRequests();
    return json(res, 200, config);
  }
  if (url.pathname === "/api/providers/codex/health" && req.method === "GET") return json(res, 200, codex.getHealth());
  if (url.pathname === "/api/providers/codex/start" && req.method === "POST") return json(res, 200, await codex.start());
  if (url.pathname === "/api/providers/codex/stop" && req.method === "POST") {
    await codex.stop();
    return json(res, 200, codex.getHealth());
  }
  if (url.pathname === "/api/projects") return json(res, 200, (await stateSnapshot()).projects);
  if (url.pathname === "/api/models") return json(res, 200, await modelOptionsForCurrentMode());
  if (url.pathname === "/api/completions") return json(res, 200, store.completions());
  if (url.pathname === "/api/qa/tmp-fixture" && req.method === "POST") return json(res, 200, createTmpQaFixture());
  if (url.pathname === "/api/qa/tmp-session" && req.method === "POST") return json(res, 200, await createTmpQaSession());
  if (url.pathname === "/api/workflow") return json(res, 200, await workflowSnapshot(url.searchParams.get("projectId") || "vsp-coder"));
  if (url.pathname.startsWith("/api/preview/")) {
    return json(res, 200, store.preview(decodeURIComponent(url.pathname.replace("/api/preview/", ""))));
  }

  const artifactPreviewMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/artifacts\/([^/]+)\/preview$/);
  if (artifactPreviewMatch && req.method === "GET") {
    return json(res, 200, await previewSessionArtifact(artifactPreviewMatch[1], decodeURIComponent(artifactPreviewMatch[2])));
  }

  const sessionMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)$/);
  if (url.pathname === "/api/sessions" && req.method === "POST") return json(res, 200, await createSession(await body(req)));
  if (sessionMatch && req.method === "GET") return json(res, 200, await getSession(sessionMatch[1]));
  if (sessionMatch && req.method === "POST") return json(res, 200, await sendSessionMessage(sessionMatch[1], await body(req)));

  const actionMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/actions$/);
  if (actionMatch && req.method === "POST") return json(res, 200, await applySessionAction(actionMatch[1], await body(req)));

  return staticFile(url.pathname, res);
}

async function stateSnapshot() {
  const snapshot = store.snapshot();
  if (snapshot.config.dataMode !== "codex") return withDefaultProject(snapshot, snapshot.projects);
  try {
    const discovered = mergeCachedSessionDetails(await discoverCodexStateCached());
    prefetchRecentSessions(discovered.sessions);
    return withDefaultProject({
      ...snapshot,
      projects: discovered.projects,
      sessions: discovered.sessions
    }, discovered.projects);
  } catch (error) {
    store.recordEvent({
      type: "error",
      message: `Codex discovery failed: ${error instanceof Error ? error.message : String(error)}`
    });
    return withDefaultProject(snapshot, snapshot.projects);
  }
}

function withDefaultProject(snapshot: VspState, projects: Project[]): VspState {
  const root = resolve(projectRoot);
  const defaultProject = projects.find((project) => resolve(project.path) === root);
  return {
    ...snapshot,
    defaultProjectId: defaultProject?.id,
    projects
  };
}

async function workflowSnapshot(projectId: string) {
  const snapshot = store.snapshot();
  if (snapshot.config.dataMode !== "codex") return store.workflow(projectId);
  try {
    const discovered = mergeCachedSessionDetails(await discoverCodexStateCached());
    const project = discovered.projects.find((item) => item.id === projectId);
    return project ? store.workflowForProject(project) : store.workflow(projectId);
  } catch {
    return store.workflow(projectId);
  }
}

async function getSession(sessionId: string) {
  const snapshot = store.snapshot();
  if (snapshot.config.dataMode !== "codex") return store.getSession(sessionId);
  return readCodexSessionCached(sessionId);
}

async function createSession(request: { projectId?: string }) {
  const snapshot = store.snapshot();
  if (snapshot.config.dataMode !== "codex") return store.createSession({ projectId: request.projectId || "vsp-coder" });
  const discovered = await discoverCodexStateCached();
  const project = discovered.projects.find((item) => item.id === request.projectId) || discovered.projects[0];
  if (!project) throw Object.assign(new Error("No Codex project is available for thread/start"), { status: 400 });
  return createCodexThreadInCwd(project.path, "Codex thread 已创建");
}

async function createTmpQaSession() {
  const snapshot = store.snapshot();
  if (snapshot.config.dataMode !== "codex") throw Object.assign(new Error("Tmp QA session requires codex data mode"), { status: 400 });
  const fixture = createTmpQaFixture();
  const session = await createCodexThreadInCwd(fixture.path, "Codex tmp QA thread 已创建");
  return { ...fixture, session };
}

async function createCodexThreadInCwd(cwd: string, eventMessage: string) {
  const snapshot = store.snapshot();
  const profile = profileForCwd(snapshot.config.profiles.find((item) => item.id === snapshot.config.automationProfile), cwd, projectRoot);
  const response = await codex.request<{ thread: import("./codexDiscovery.js").CodexThread; model?: string; reasoningEffort?: string | null }>("thread/start", {
    cwd,
    ...threadStartOverrides(profile),
    ...selfProtectionOverrides(cwd, projectRoot, port)
  });
  const session = mapThreadToVspSession(response.thread);
  session.model = response.model || "codex-default";
  session.reasoning = response.reasoningEffort || "xhigh";
  session.automationProfile = profile?.id || snapshot.config.automationProfile;
  session.sandbox = profile?.sandbox || "danger-full-access";
  session.approvalPolicy = profile?.approvalPolicy || "never";
  sessionCache.set(session.id, { session, fetchedAt: Date.now() });
  mergeCreatedSession(session);
  store.recordEvent({ sessionId: session.id, projectId: session.projectId, type: "session_updated", message: `${eventMessage}：${session.title}` });
  return session;
}

async function sendSessionMessage(sessionId: string, request: { text?: string }) {
  const snapshot = store.snapshot();
  if (snapshot.config.dataMode !== "codex") return store.sendMessage(sessionId, { text: request.text || "", tokens: [] });
  const text = request.text?.trim();
  if (!text) throw Object.assign(new Error("Message text is required"), { status: 400 });
  let base = sessionCache.get(sessionId)?.session || discoveryCache.snapshot?.sessions.find((item) => item.id === sessionId);
  base ||= await readCodexSessionCached(sessionId);
  if (codexSessionIsBusy(base)) return enqueueCodexMessage(sessionId, text, base);
  return startCodexTurn(sessionId, text);
}

async function startCodexTurn(sessionId: string, text: string) {
  const configuredProfile = activeProfile(store.getConfig().automationProfile);
  const cachedBase = sessionCache.get(sessionId)?.session || discoveryCache.snapshot?.sessions.find((item) => item.id === sessionId);
  const profile = profileForCwd(configuredProfile, cachedBase?.cwd, projectRoot);
  const cachedSession = await resumeCodexSession(sessionId, profile);
  const turnProfile = profileForCwd(configuredProfile, cachedSession?.cwd, projectRoot);
  let response: { turnId?: string; turn?: { id?: string } } | null = null;
  try {
    response = await codex.request<{ turnId?: string; turn?: { id?: string } }>("turn/start", {
      threadId: sessionId,
      input: [{ type: "text", text, text_elements: [] }],
      ...turnStartOverrides(turnProfile, cachedSession?.cwd),
      model: cachedSession?.model && cachedSession.model !== "codex-default" ? cachedSession.model : null,
      effort: normalizeReasoningEffort(cachedSession?.reasoning)
    });
  } catch (error) {
    if (error instanceof Error && /thread not found/i.test(error.message)) {
      sessionCache.delete(sessionId);
      invalidateDiscoveryCache();
    }
    throw error;
  }
  const optimistic = markCodexTurnRunning(cachedSession, response?.turnId || response?.turn?.id);
  sessionCache.set(sessionId, { session: optimistic, fetchedAt: Date.now() });
  maybeAddSubagentExpectation(sessionId, text);
  store.recordEvent({ sessionId, type: "message_added", message: "消息已发送到 Codex turn/start" });
  store.recordEvent({
    sessionId,
    projectId: optimistic.projectId,
    type: "session_updated",
    message: "Codex turn 已进入运行态。",
    payload: { kind: "live_session_patch", status: "running", currentTurnId: optimistic.currentTurnId || null }
  });
  return optimistic;
}

function markCodexTurnRunning(session: Session, turnId: string | undefined): Session {
  return {
    ...session,
    status: "running",
    currentTurnId: turnId || session.currentTurnId,
    updatedAt: new Date().toISOString()
  };
}

function enqueueCodexMessage(sessionId: string, text: string, base: Session) {
  const next = enqueuePendingMessage(base, text);
  sessionCache.set(sessionId, { session: next, fetchedAt: Date.now() });
  store.recordEvent({
    sessionId,
    projectId: next.projectId,
    type: "queue_updated",
    message: "当前 Codex turn 正在运行，消息已加入待发送队列。",
    payload: { pending: next.queue.filter((item) => item.state === "pending").length }
  });
  return next;
}

async function resumeCodexSession(sessionId: string, profile: AutomationProfile | undefined) {
  const base = sessionCache.get(sessionId)?.session || discoveryCache.snapshot?.sessions.find((item) => item.id === sessionId);
  const effectiveProfile = profileForCwd(profile, base?.cwd, projectRoot);
  let response: { thread: import("./codexDiscovery.js").CodexThread; model?: string; reasoningEffort?: string | null };
  try {
    response = await codex.request<{ thread: import("./codexDiscovery.js").CodexThread; model?: string; reasoningEffort?: string | null }>("thread/resume", {
      threadId: sessionId,
      cwd: base?.cwd || null,
      model: base?.model && base.model !== "codex-default" ? base.model : null,
      ...threadStartOverrides(effectiveProfile),
      ...selfProtectionOverrides(base?.cwd, projectRoot, port),
      excludeTurns: true
    }, 20_000);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (base && /no rollout found|not materialized yet/i.test(message)) {
      return {
        ...base,
        automationProfile: effectiveProfile?.id || base.automationProfile,
        sandbox: effectiveProfile?.sandbox || base.sandbox,
        approvalPolicy: effectiveProfile?.approvalPolicy || base.approvalPolicy
      };
    }
    throw error;
  }
  const resumed = mapThreadToVspSession(response.thread);
  const merged = mergeProviderRefresh(base || resumed, {
    ...resumed,
    model: response.model || base?.model || "codex-default",
    reasoning: response.reasoningEffort || base?.reasoning || "xhigh",
    automationProfile: effectiveProfile?.id || base?.automationProfile,
    sandbox: effectiveProfile?.sandbox || base?.sandbox,
    approvalPolicy: effectiveProfile?.approvalPolicy || base?.approvalPolicy
  });
  const next = {
    ...merged,
    automationProfile: effectiveProfile?.id || merged.automationProfile,
    sandbox: effectiveProfile?.sandbox || merged.sandbox,
    approvalPolicy: effectiveProfile?.approvalPolicy || merged.approvalPolicy
  };
  sessionCache.set(sessionId, { session: next, fetchedAt: Date.now() });
  store.recordEvent({
    sessionId,
    projectId: next.projectId,
    type: "session_updated",
    message: `Codex session 已恢复：${next.title}`,
    payload: { profile: effectiveProfile?.id, approvalPolicy: effectiveProfile?.approvalPolicy, sandbox: effectiveProfile?.sandbox }
  });
  return next;
}

async function applySessionAction(sessionId: string, request: SessionActionRequest) {
  const snapshot = store.snapshot();
  if (snapshot.config.dataMode !== "codex") return store.applyAction(sessionId, request);
  if (request.type === "card_action") return applyCodexCardAction(sessionId, request);
  if (request.type === "clear_queue") return clearCodexQueue(sessionId);
  if (request.type === "interrupt") return interruptCodexTurn(sessionId);
  if (request.type === "rename_session") return renameCodexSession(sessionId, request);
  if (request.type !== "switch_model" && request.type !== "switch_model_mock") return store.applyAction(sessionId, request);
  const base = sessionCache.get(sessionId)?.session || discoveryCache.snapshot?.sessions.find((item) => item.id === sessionId);
  if (!base) throw Object.assign(new Error("Session not found"), { status: 404 });
  const options = await modelOptionsForCurrentMode();
  const option = options.find((item) =>
    item.provider === (request.provider || base.provider) && item.model === (request.model || request.value)
  ) || options.find((item) => item.provider === base.provider);
  if (!option) throw Object.assign(new Error("Model option not found"), { status: 400 });
  const next = {
    ...base,
    provider: option.provider,
    model: option.model,
    reasoning: option.reasoning.includes(request.reasoning || "") ? request.reasoning || option.reasoning[0] : option.reasoning[0],
    updatedAt: new Date().toISOString()
  };
  sessionCache.set(sessionId, { session: next, fetchedAt: Date.now() });
  store.recordEvent({
    sessionId,
    projectId: next.projectId,
    type: "session_updated",
    message: `当前会话模型已切换为 ${option.label} · ${next.reasoning}。`,
    payload: { provider: next.provider, model: next.model, reasoning: next.reasoning }
  });
  return next;
}

async function renameCodexSession(sessionId: string, request: SessionActionRequest) {
  const name = await setCodexThreadName(codex, sessionId, request.value || "");
  invalidateDiscoveryCache();
  sessionInflight.delete(sessionId);
  const refreshed = await refreshCodexSession(sessionId);
  store.recordEvent({
    sessionId,
    projectId: refreshed.projectId,
    type: "session_updated",
    message: `Codex session 已重命名：${refreshed.title}`,
    payload: { method: "thread/name/set", requestedName: name, canonicalTitle: refreshed.title }
  });
  return refreshed;
}

async function modelOptionsForCurrentMode() {
  if (store.getConfig().dataMode !== "codex") return store.modelOptions();
  if (modelCache.options && Date.now() - modelCache.fetchedAt < modelCacheTtlMs) return modelCache.options;
  try {
    const options = await listCodexModelOptions(codex);
    modelCache.options = options;
    modelCache.fetchedAt = Date.now();
    return options;
  } catch {
    const fallback = fallbackCodexModelOptions();
    modelCache.options = fallback;
    modelCache.fetchedAt = Date.now();
    return fallback;
  }
}

async function clearCodexQueue(sessionId: string) {
  let base = sessionCache.get(sessionId)?.session || discoveryCache.snapshot?.sessions.find((item) => item.id === sessionId);
  base ||= await readCodexSessionCached(sessionId);
  const { session: next, cleared } = clearPendingQueue(base);
  sessionCache.set(sessionId, { session: next, fetchedAt: Date.now() });
  store.recordEvent({
    sessionId,
    projectId: next.projectId,
    type: "queue_updated",
    message: cleared ? `已清空 ${cleared} 条待发送消息，当前 Codex turn 未被中断。` : "没有待发送消息需要清空，当前 Codex turn 未被中断。",
    payload: { cleared }
  });
  return next;
}

async function interruptCodexTurn(sessionId: string) {
  let base = sessionCache.get(sessionId)?.session || discoveryCache.snapshot?.sessions.find((item) => item.id === sessionId);
  base ||= await readCodexSessionCached(sessionId);
  if (!base) throw Object.assign(new Error("Session not found"), { status: 404 });
  if (!base.currentTurnId && codexSessionIsBusy(base)) {
    const refreshed = await refreshCodexSession(sessionId).catch(() => null);
    if (refreshed) base = refreshed;
  }
  if (!base.currentTurnId) {
    store.recordEvent({
      sessionId,
      projectId: base.projectId,
      type: "warning",
      message: "当前 Codex session 没有可中断的 active turn。",
      payload: { status: base.status }
    });
    return base;
  }
  await codex.request("turn/interrupt", { threadId: sessionId, turnId: base.currentTurnId }, 10_000);
  const next: Session = {
    ...base,
    status: "interrupted",
    currentTurnId: undefined,
    updatedAt: new Date().toISOString()
  };
  sessionCache.set(sessionId, { session: next, fetchedAt: Date.now() });
  store.recordEvent({
    sessionId,
    projectId: next.projectId,
    type: "runner_interrupt_requested",
    message: "已请求中断当前 Codex turn，待发送队列保持不变。",
    payload: { interruptedTurnId: base.currentTurnId }
  });
  return next;
}

async function applyCodexCardAction(sessionId: string, request: SessionActionRequest) {
  const cardId = request.cardId || "";
  const pending = pendingCodexRequests.get(cardId);
  if (!pending || pending.sessionId !== sessionId) throw Object.assign(new Error("Pending Codex request not found"), { status: 404 });
  const resolution = codexResponseForAction(pending, request);
  try {
    await codex.respond(pending.requestId, resolution.result);
    pendingCodexRequests.delete(cardId);
    const session = updateCachedCard(sessionId, cardId, resolution.status);
    store.recordEvent({
      sessionId,
      projectId: session?.projectId,
      type: "card_resolved",
      message: `Codex 请求已处理：${pending.card.title} · ${resolution.label}`,
      payload: { cardId, method: pending.method, status: resolution.status, actionId: request.actionId }
    });
    return session || readCodexSessionCached(sessionId);
  } catch (error) {
    const session = updateCachedCard(sessionId, cardId, "failed");
    store.recordEvent({
      sessionId,
      projectId: session?.projectId,
      type: "error",
      message: `Codex 请求回写失败：${error instanceof Error ? error.message : String(error)}`,
      payload: { cardId, method: pending.method }
    });
    throw error;
  }
}

async function previewSessionArtifact(sessionId: string, artifactId: string) {
  const session = await getSession(sessionId);
  const artifact = session.artifacts.find((item) => item.id === artifactId);
  if (!artifact) throw Object.assign(new Error("Artifact not found"), { status: 404 });
  return previewArtifact(session, artifact);
}

async function discoverCodexStateCached() {
  const now = Date.now();
  if (discoveryCache.snapshot && now - discoveryCache.fetchedAt < discoveryCacheTtlMs) return discoveryCache.snapshot;
  if (discoveryCache.inflight) return discoveryCache.inflight;
  discoveryCache.inflight = discoverCodexState(codex)
    .then((snapshot) => {
      discoveryCache.snapshot = snapshot;
      discoveryCache.fetchedAt = Date.now();
      return snapshot;
    })
    .finally(() => {
      discoveryCache.inflight = null;
    });
  return discoveryCache.inflight;
}

async function readCodexSessionCached(sessionId: string) {
  const cached = sessionCache.get(sessionId);
  const now = Date.now();
  if (cached && codexSessionIsBusy(cached.session)) {
    if (now - cached.fetchedAt < busySessionFreshTtlMs) return cached.session;
    return refreshCodexSession(sessionId);
  }
  if (cached && now - cached.fetchedAt < sessionFreshTtlMs) return cached.session;
  if (cached && now - cached.fetchedAt < sessionStaleTtlMs) {
    void refreshCodexSession(sessionId).catch((error) => {
      store.recordEvent({
        sessionId,
        type: "error",
        message: `Codex session refresh failed: ${error instanceof Error ? error.message : String(error)}`
      });
    });
    return cached.session;
  }
  return refreshCodexSession(sessionId);
}

async function refreshCodexSession(sessionId: string) {
  const inflight = sessionInflight.get(sessionId);
  if (inflight) return inflight;
  const promise = readCodexSession(codex, sessionId)
    .then((session) => {
      const previous = sessionCache.get(sessionId)?.session;
      const merged = previous ? mergeProviderRefresh(previous, session) : session;
      sessionCache.set(sessionId, { session: merged, fetchedAt: Date.now() });
      store.recordEvent({
        sessionId,
        projectId: merged.projectId,
        type: "session_updated",
        message: `Codex session 已刷新：${merged.title}`,
        payload: { messages: merged.messages.length }
      });
      return merged;
    })
    .finally(() => {
      sessionInflight.delete(sessionId);
    });
  sessionInflight.set(sessionId, promise);
  return promise;
}

function prefetchRecentSessions(sessions: Session[]) {
  for (const session of sessions.slice(0, 3)) {
    if (sessionCache.has(session.id) || sessionInflight.has(session.id)) continue;
    void refreshCodexSession(session.id).catch(() => undefined);
  }
}

function invalidateDiscoveryCache() {
  discoveryCache.snapshot = null;
  discoveryCache.fetchedAt = 0;
}

function mergeCreatedSession(session: Session) {
  if (!discoveryCache.snapshot) return;
  discoveryCache.snapshot = {
    ...discoveryCache.snapshot,
    sessions: [session, ...discoveryCache.snapshot.sessions.filter((item) => item.id !== session.id)]
  };
  discoveryCache.fetchedAt = Date.now();
}

function mergeCachedSessionDetails(discovered: CodexDiscoverySnapshot): CodexDiscoverySnapshot {
  const profile = activeProfile(store.getConfig().automationProfile);
  const discoveredIds = new Set(discovered.sessions.map((session) => session.id));
  const cachedOnlySessions = [...sessionCache.values()]
    .map((entry) => entry.session)
    .filter((session) => session.provider === "codex" && !discoveredIds.has(session.id));
  const projectsById = new Map(discovered.projects.map((project) => [project.id, project]));
  for (const session of cachedOnlySessions) {
    if (projectsById.has(session.projectId)) continue;
    projectsById.set(session.projectId, {
      id: session.projectId,
      name: basename(session.cwd) || session.cwd,
      path: session.cwd,
      color: "#38bdf8",
      status: "active"
    });
  }
  return {
    projects: [...projectsById.values()],
    sessions: [...cachedOnlySessions, ...discovered.sessions.map((session) => {
      const cached = sessionCache.get(session.id)?.session;
      if (!cached) return {
        ...session,
        automationProfile: profile?.id || session.automationProfile,
        sandbox: profile?.sandbox || session.sandbox,
        approvalPolicy: profile?.approvalPolicy || session.approvalPolicy
      };
      return {
        ...session,
        provider: cached.provider,
        model: cached.model,
        reasoning: cached.reasoning,
        automationProfile: cached.automationProfile,
        sandbox: cached.sandbox,
        approvalPolicy: cached.approvalPolicy,
        status: cached.status,
        currentTurnId: cached.currentTurnId,
        queue: cached.queue,
        metric: cached.metric,
        messages: cached.messages.length ? cached.messages : session.messages,
        cards: cached.cards.length ? cached.cards : session.cards,
        artifacts: cached.artifacts.length ? cached.artifacts : session.artifacts
      };
    })]
  };
}

function handleCodexNotification(notification: { method: string; params?: unknown }) {
  const completedThreadIds = new Set<string>();
  for (const mapped of mapCodexNotification(notification)) {
    if (mapped.sessionId && isSubagentTracePatch(mapped.patch)) markSubagentObserved(mapped.sessionId);
    if (mapped.sessionId && mapped.patch) applyLivePatch(mapped.sessionId, mapped.patch);
    if (mapped.persistent) store.recordEvent(mapped.event);
    else store.publishTransientEvent(mapped.event);
    if (mapped.sessionId && notification.method === "turn/completed") completedThreadIds.add(mapped.sessionId);
    if (mapped.sessionId && mapped.refreshSession) {
      void refreshCodexSession(mapped.sessionId).catch((error) => {
        store.recordEvent({
          sessionId: mapped.sessionId,
          type: "error",
          message: `Codex live refresh failed: ${error instanceof Error ? error.message : String(error)}`
        });
      });
    }
  }
  for (const sessionId of completedThreadIds) {
    completeSubagentExpectation(sessionId);
    setTimeout(() => void drainCodexQueue(sessionId), 0);
  }
}

function maybeAddSubagentExpectation(sessionId: string, text: string) {
  if (!/\b(subagent|sub-agent|worker|explorer)\b/i.test(text)) return;
  const itemId = `${sessionId}:subagent-expectation:${Date.now()}`;
  subagentExpectations.set(sessionId, { itemId, requestedAt: Date.now(), text, observed: false });
  applyLivePatch(sessionId, {
    kind: "live_session_patch",
    messageDelta: {
      id: itemId,
      role: "tool",
      text: [
        "Subagent trace: requested",
        "agent: provider",
        "summary: User requested subagent/worker usage; waiting for Codex provider trace.",
        `raw: ${JSON.stringify({ requestedText: text })}`
      ].join("\n"),
      providerItemRef: itemId
    }
  });
}

function markSubagentObserved(sessionId: string) {
  const expectation = subagentExpectations.get(sessionId);
  if (expectation) expectation.observed = true;
}

function completeSubagentExpectation(sessionId: string) {
  const expectation = subagentExpectations.get(sessionId);
  if (!expectation || expectation.observed) return;
  applyLivePatch(sessionId, {
    kind: "live_session_patch",
    finalMessages: [{
      id: expectation.itemId,
      sessionId,
      role: "tool",
      providerItemRef: expectation.itemId,
      createdAt: new Date(expectation.requestedAt).toISOString(),
      blocks: [{
        type: "text",
        text: [
          "Subagent trace: not observed",
          "agent: provider",
          "summary: The user requested subagent/worker usage, but Codex did not emit a subagent trace for this turn.",
          `raw: ${JSON.stringify({ requestedText: expectation.text })}`
        ].join("\n")
      }]
    }]
  });
  subagentExpectations.delete(sessionId);
}

function isSubagentTracePatch(patch: LiveSessionPatch | undefined) {
  const text = [
    patch?.messageDelta?.text || "",
    ...(patch?.finalMessages || []).flatMap((message) => message.blocks).map((block) => block.type === "text" ? block.text : "")
  ].join("\n");
  return /^Subagent trace:/i.test(text.trim());
}

function isNonBlockingCodexStderr(message: string) {
  const normalized = message.toLowerCase();
  return [
    "failed to warm featured plugin ids cache",
    "failed to send remote plugin sync request",
    "failed to open state db",
    "table threads already exists"
  ].some((pattern) => normalized.includes(pattern));
}

async function handleCodexHealth(health: CodexProviderHealth) {
  if (health.status === "ready") {
    invalidateDiscoveryCache();
    const activeIds = [...sessionCache.entries()]
      .filter(([, cached]) => cached.session.provider === "codex" && (cached.session.status === "error" || codexSessionIsBusy(cached.session)))
      .map(([sessionId]) => sessionId);
    await Promise.allSettled(activeIds.map((sessionId) => refreshCodexSession(sessionId)));
    return;
  }
  if (!["crashed", "unavailable", "stopped"].includes(health.status)) return;
  for (const [sessionId, cached] of sessionCache.entries()) {
    if (cached.session.provider !== "codex" || !codexSessionIsBusy(cached.session)) continue;
    const next = markActiveSessionUnavailable(cached.session);
    sessionCache.set(sessionId, { session: next, fetchedAt: Date.now() });
    store.recordEvent({
      sessionId,
      projectId: next.projectId,
      type: "error",
      message: "Codex app-server 已断开，当前 active turn 标记为错误；待发送队列保留，重连后会重新对齐状态。",
      payload: { health }
    });
  }
  pendingCodexRequests.clear();
}

async function drainCodexQueue(sessionId: string) {
  const base = sessionCache.get(sessionId)?.session;
  if (!base || codexSessionIsBusy(base)) return;
  const queueItem = nextPendingQueueItem(base);
  if (!queueItem) return;
  const sent = markQueueItemSent(base, queueItem.id);
  sessionCache.set(sessionId, { session: sent, fetchedAt: Date.now() });
  store.recordEvent({
    sessionId,
    projectId: sent.projectId,
    type: "queue_updated",
    message: "已从待发送队列取出下一条消息并发送到 Codex。",
    payload: { queueItemId: queueItem.id }
  });
  try {
    await startCodexTurn(sessionId, queueItem.text);
    await refreshCodexSession(sessionId).catch(() => undefined);
  } catch (error) {
    const latest = sessionCache.get(sessionId)?.session || sent;
    sessionCache.set(sessionId, { session: markQueueItemPending(latest, queueItem.id), fetchedAt: Date.now() });
    store.recordEvent({
      sessionId,
      projectId: sent.projectId,
      type: "error",
      message: `待发送消息启动失败：${error instanceof Error ? error.message : String(error)}`,
      payload: { queueItemId: queueItem.id }
    });
  }
}

async function handleCodexRequest(request: CodexServerRequest) {
  const pending = mapCodexServerRequest(request);
  if (!pending) {
    await codex.rejectRequest(request.id, -32601, `Unsupported Codex server request: ${request.method}`);
    return;
  }
  const profile = activeProfile(store.getConfig().automationProfile);
  if (shouldAutoResolveRequest(pending, profile)) {
    const resolution = autoResolutionFor(pending);
    if (!resolution) return;
    await codex.respond(pending.requestId, resolution.result);
    store.recordEvent({
      sessionId: pending.sessionId,
      type: "card_resolved",
      message: `Codex 请求已按全自动 profile 处理：${pending.card.title}`,
      payload: { method: pending.method, status: resolution.status, automatic: true }
    });
    return;
  }
  pendingCodexRequests.set(pending.card.id, pending);
  let session = addCardToCachedSession(pending.sessionId, pending.card);
  if (!session) {
    await readCodexSessionCached(pending.sessionId).catch(() => null);
    session = addCardToCachedSession(pending.sessionId, pending.card);
  }
  store.recordEvent({
    sessionId: pending.sessionId,
    projectId: session?.projectId,
    type: "card_opened",
    message: `Codex 请求需要确认：${pending.card.title}`,
    payload: { kind: "codex_request", method: pending.method, cardId: pending.card.id }
  });
}

async function reconcileFullAutoPendingRequests() {
  const profile = activeProfile(store.getConfig().automationProfile);
  if (profile?.id !== "full_auto") return;
  const pending = [...pendingCodexRequests.values()];
  for (const request of pending) {
    if (!shouldAutoResolveRequest(request, profile)) continue;
    const resolution = autoResolutionFor(request);
    if (!resolution) continue;
    pendingCodexRequests.delete(request.card.id);
    try {
      await codex.respond(request.requestId, resolution.result);
      const session = updateCachedCard(request.sessionId, request.card.id, resolution.status);
      store.recordEvent({
        sessionId: request.sessionId,
        projectId: session?.projectId,
        type: "card_resolved",
        message: `Codex 请求已切换为全自动处理：${request.card.title}`,
        payload: { method: request.method, status: resolution.status, automatic: true }
      });
    } catch (error) {
      store.recordEvent({
        sessionId: request.sessionId,
        type: "error",
        message: `全自动处理 Codex 请求失败：${error instanceof Error ? error.message : String(error)}`,
        payload: { method: request.method, cardId: request.card.id }
      });
    }
  }
}

function applyLivePatch(sessionId: string, patch: LiveSessionPatch) {
  const base = sessionCache.get(sessionId)?.session || discoveryCache.snapshot?.sessions.find((session) => session.id === sessionId);
  if (!base) return;
  const next: Session = {
    ...base,
    title: patch.title || base.title,
    status: patch.status || base.status,
    currentTurnId: typeof patch.currentTurnId === "undefined" ? base.currentTurnId : patch.currentTurnId || undefined,
    metric: patch.metric ? { ...base.metric, ...patch.metric, updatedAt: patch.metric.updatedAt || new Date().toISOString() } : base.metric,
    messages: mergeLiveMessages(sessionId, base.messages, patch),
    artifacts: patch.artifactUpdates ? mergeArtifactUpdates(base.artifacts, patch.artifactUpdates) : base.artifacts,
    updatedAt: new Date().toISOString()
  };
  sessionCache.set(sessionId, { session: next, fetchedAt: Date.now() });
}

function addCardToCachedSession(sessionId: string, card: RequestCard) {
  const base = sessionCache.get(sessionId)?.session || discoveryCache.snapshot?.sessions.find((session) => session.id === sessionId);
  if (!base) return null;
  const next: Session = {
    ...base,
    status: "waiting_approval",
    cards: [card, ...base.cards.filter((item) => item.id !== card.id)],
    updatedAt: new Date().toISOString()
  };
  sessionCache.set(sessionId, { session: next, fetchedAt: Date.now() });
  return next;
}

function updateCachedCard(sessionId: string, cardId: string, status: RequestCard["status"]) {
  const base = sessionCache.get(sessionId)?.session || discoveryCache.snapshot?.sessions.find((session) => session.id === sessionId);
  if (!base) return null;
  const next: Session = {
    ...base,
    status: base.status === "waiting_approval" ? "running" : base.status,
    cards: base.cards.map((card) => card.id === cardId ? { ...card, status, resolvedAt: new Date().toISOString() } : card),
    updatedAt: new Date().toISOString()
  };
  sessionCache.set(sessionId, { session: next, fetchedAt: Date.now() });
  return next;
}

function mergeLiveMessages(sessionId: string, messages: Session["messages"], patch: LiveSessionPatch) {
  let next = messages;
  if (patch.messageDelta) {
    const existing = next.find((message) => message.id === patch.messageDelta?.id);
    if (existing) {
      next = next.map((message) => message.id === patch.messageDelta?.id ? appendText(message, patch.messageDelta.text) : message);
    } else {
      next = [...next, {
        id: patch.messageDelta.id,
        sessionId,
        role: patch.messageDelta.role,
        providerItemRef: patch.messageDelta.providerItemRef,
        createdAt: new Date().toISOString(),
        blocks: [{ type: "text", text: patch.messageDelta.text }]
      }];
    }
  }
  for (const finalMessage of patch.finalMessages || []) {
    const duplicate = next.find((message) => messagesAreSameContent(message, finalMessage));
    if (duplicate && duplicate.id !== finalMessage.id) {
      next = next.map((message) => message.id === duplicate.id ? finalMessage : message);
      continue;
    }
    next = next.some((message) => message.id === finalMessage.id)
      ? next.map((message) => message.id === finalMessage.id ? finalMessage : message)
      : [...next, finalMessage];
  }
  return dedupeMessagesByContent(next);
}

function appendText(message: Session["messages"][number], delta: string): Session["messages"][number] {
  return {
    ...message,
    blocks: message.blocks.map((block, index) => {
      if (index !== 0 || block.type !== "text") return block;
      return { ...block, text: `${block.text}${delta}` };
    })
  };
}

function messagesAreSameContent(a: Session["messages"][number], b: Session["messages"][number]) {
  return a.role === b.role && normalizedMessageText(a) !== "" && normalizedMessageText(a) === normalizedMessageText(b);
}

function dedupeMessagesByContent(messages: Session["messages"]) {
  const seen = new Set<string>();
  return messages.filter((message) => {
    const text = normalizedMessageText(message);
    if (!text) return true;
    const key = `${message.role}:${text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizedMessageText(message: Session["messages"][number]) {
  return message.blocks
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
}

function activeProfile(id: string): AutomationProfile | undefined {
  return store.getConfig().profiles.find((profile) => profile.id === id);
}

function normalizeReasoningEffort(value: string | undefined) {
  return ["none", "minimal", "low", "medium", "high", "xhigh"].includes(value || "") ? value : undefined;
}

function sse(req: IncomingMessage, res: ServerResponse) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*"
  });
  res.write(`event: hello\ndata: ${JSON.stringify({ ok: true })}\n\n`);
  const unsubscribe = store.subscribe((event) => {
    res.write(`event: vsp\ndata: ${JSON.stringify(event)}\n\n`);
  });
  req.on("close", unsubscribe);
}

function staticFile(pathname: string, res: ServerResponse) {
  const candidate = pathname === "/" ? join(webDist, "index.html") : join(webDist, pathname);
  const file = safeStatic(candidate);
  const path = file || join(webDist, "index.html");
  const data = readFileSync(path);
  res.writeHead(200, { "Content-Type": mime(path) });
  res.end(data);
}

function safeStatic(path: string) {
  const resolved = resolve(path);
  if (!resolved.startsWith(`${webDist}/`) && resolved !== webDist) return null;
  try {
    if (statSync(resolved).isFile()) return resolved;
  } catch {
    return null;
  }
  return null;
}

function mime(path: string) {
  const ext = extname(path);
  if (ext === ".html") return "text/html";
  if (ext === ".js") return "text/javascript";
  if (ext === ".css") return "text/css";
  if (ext === ".png") return "image/png";
  return "application/octet-stream";
}

function json(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(value));
}

async function body(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

server.listen(port, host, () => {
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  const urls = [`http://localhost:${actualPort}`, ...lanUrls(actualPort)];
  console.log(`VSP-Coder server listening on ${host}:${actualPort}`);
  for (const url of urls) console.log(`  ${url}`);
});

function lanUrls(port: number) {
  return Object.values(networkInterfaces())
    .flatMap((entries) => entries || [])
    .filter((entry) => entry.family === "IPv4" && !entry.internal)
    .map((entry) => `http://${entry.address}:${port}`);
}

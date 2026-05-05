import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bot,
  Check,
  ChevronDown,
  CircleStop,
  Clock3,
  FileText,
  Image,
  Menu,
  MoreHorizontal,
  Paperclip,
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
  CompletionItem,
  Message,
  ModelOption,
  Project,
  QaRun,
  RequestCard,
  Session,
  StructuredToken,
  VspEvent,
  VspState,
  WorkflowConfigItem,
  WorkflowSnapshot
} from "@vsp-coder/protocol";
import "./styles.css";

type Preview = {
  title: string;
  kind: string;
  path?: string;
  description?: string;
  previewStatus: string;
  body: string;
};

type RightTab = "workflow" | "skills" | "activity";
type ActivityScope = "all" | "project" | "session";
type ResizableColumn = "global" | "session" | "right";

const columnBounds: Record<ResizableColumn, { min: number; max: number }> = {
  global: { min: 72, max: 300 },
  session: { min: 220, max: 380 },
  right: { min: 360, max: 620 }
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const initialLayout = (): Record<ResizableColumn, number> => {
  if (typeof window !== "undefined" && window.innerWidth <= 1540 && window.innerWidth > 1100) {
    return { global: 72, session: 280, right: 420 };
  }
  return { global: 220, session: 280, right: 480 };
};

const api = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
};

function App() {
  const [state, setState] = useState<VspState | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowSnapshot | null>(null);
  const [activeProjectId, setActiveProjectId] = useState("vsp-coder");
  const [activeSessionId, setActiveSessionId] = useState("mock-main");
  const [draft, setDraft] = useState("");
  const [tokens, setTokens] = useState<StructuredToken[]>([]);
  const [completions, setCompletions] = useState<CompletionItem[]>([]);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>("workflow");
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [confirmInterrupt, setConfirmInterrupt] = useState(false);
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [activityScope, setActivityScope] = useState<ActivityScope>("all");
  const [layout, setLayout] = useState<Record<ResizableColumn, number>>(initialLayout);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth <= 1100);
  const resizeRef = useRef<{ column: ResizableColumn; startX: number; startWidth: number } | null>(null);

  const refresh = async () => {
    const next = await api<VspState>("/api/state");
    setState(next);
    const wf = await api<WorkflowSnapshot>(`/api/workflow?projectId=${activeProjectId}`);
    setWorkflow(wf);
  };

  useEffect(() => {
    void refresh();
    void api<CompletionItem[]>("/api/completions").then(setCompletions);
    void api<ModelOption[]>("/api/models").then(setModelOptions);
    const source = new EventSource("/api/events");
    source.addEventListener("vsp", () => void refresh());
    return () => source.close();
  }, [activeProjectId]);

  useEffect(() => {
    const updateViewport = () => setIsMobile(window.innerWidth <= 1100);
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  const projects = state?.projects || [];
  const allSessions = useMemo(() => [...(state?.sessions || [])].sort(byUpdated), [state]);
  const projectSessions = allSessions.filter((session) => session.projectId === activeProjectId);
  const selectedSession = state?.sessions.find((item) => item.id === activeSessionId && item.projectId === activeProjectId);
  const session = selectedSession || projectSessions[0] || null;
  const activeProject = projects.find((project) => project.id === activeProjectId) || projects[0] || null;
  const qaRun = state?.qaRuns.find((run) => run.sessionId === session?.id && run.status !== "complete") || null;
  const openCards = session?.cards.filter((card) => card.status === "open") || [];

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

  const createSession = async () => {
    const next = await api<Session>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ projectId: activeProjectId })
    });
    setActiveSessionId(next.id);
    setSwitcherOpen(false);
    await refresh();
  };

  const refreshState = async () => {
    if (session) await act("refresh_state");
    else await refresh();
  };

  const sendMessage = async () => {
    if (!session || (!draft.trim() && !tokens.length)) return;
    await api<Session>(`/api/sessions/${session.id}`, {
      method: "POST",
      body: JSON.stringify({ text: draft.trim() || "发送结构化 token", tokens })
    });
    setDraft("");
    setTokens([]);
    await refresh();
  };

  const act = async (type: string, extra: Record<string, unknown> = {}) => {
    if (!session) return;
    await api<Session>(`/api/sessions/${session.id}/actions`, {
      method: "POST",
      body: JSON.stringify({ type, ...extra })
    });
    setConfirmInterrupt(false);
    await refresh();
  };

  const chooseCompletion = (item: CompletionItem) => {
    setTokens((prev) => [...prev, item]);
    setDraft((prev) => prev.replace(/\S*$/, "").trimEnd());
  };

  const openPreview = async (token: StructuredToken) => {
    setPreview(await api<Preview>(`/api/preview/${encodeURIComponent(token.id)}`));
    setRightTab("skills");
  };

  const visibleProjects = showAllProjects ? projects : projects.slice(0, 5);
  const sessionPreviewLimit = isMobile ? 3 : 6;
  const visibleSessions = showAllSessions ? projectSessions : projectSessions.slice(0, sessionPreviewLimit);
  const layoutStyle = {
    "--global-rail-width": `${layout.global}px`,
    "--session-rail-width": `${layout.session}px`,
    "--right-rail-width": `${layout.right}px`
  } as React.CSSProperties & Record<"--global-rail-width" | "--session-rail-width" | "--right-rail-width", string>;

  const startResize = (column: ResizableColumn, event: React.PointerEvent<HTMLButtonElement>) => {
    resizeRef.current = { column, startX: event.clientX, startWidth: layout[column] };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    const active = resizeRef.current;
    if (!active) return;
    const bounds = columnBounds[active.column];
    const delta = active.column === "right" ? active.startX - event.clientX : event.clientX - active.startX;
    setLayout((prev) => ({ ...prev, [active.column]: clamp(active.startWidth + delta, bounds.min, bounds.max) }));
  };

  const endResize = () => {
    resizeRef.current = null;
  };

  return (
    <div className="app-shell" style={layoutStyle}>
      <ResizeHandle column="global" label="调整左侧栏宽度" onStart={startResize} onMove={moveResize} onEnd={endResize} />
      <ResizeHandle column="session" label="调整会话栏宽度" onStart={startResize} onMove={moveResize} onEnd={endResize} />
      <ResizeHandle column="right" label="调整右侧栏宽度" onStart={startResize} onMove={moveResize} onEnd={endResize} />
      <aside className="global-rail">
        <div className="brand">
          <strong>VSP-Coder</strong>
          <span>WORKBENCH</span>
        </div>
        <button className="shortcut" onClick={() => void act("open_search")}><Search size={14} /> 搜索 <kbd>Ctrl K</kbd></button>
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
            <button className="new-session" title="新建会话" onClick={() => void createSession()}><Play size={14} /> 新建</button>
            <button title="刷新" onClick={() => void refreshState()}><RefreshCw size={16} /></button>
          </div>
        </div>

        <div className="mobile-workbench">
          <SectionHeader label="最近 Project" count={projects.length} />
          <ProjectList projects={visibleProjects} activeProjectId={activeProjectId} onSelect={(id) => { selectProject(id); }} />
          {projects.length > 5 && <MoreButton expanded={showAllProjects} onClick={() => setShowAllProjects(!showAllProjects)} />}
        </div>

        <SectionHeader label="最近 Session" count={projectSessions.length} />
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
      </aside>

      <main className="workspace">
        <div className="mobile-topbar">
          <button onClick={() => setSwitcherOpen(true)}><Menu size={18} /></button>
          <strong>{session?.title || "VSP-Coder"}</strong>
          <div className="mobile-topbar-actions">
            <button onClick={() => void createSession()}><Play size={17} /></button>
            <button onClick={() => void refreshState()}><RefreshCw size={18} /></button>
          </div>
        </div>
        {session && (
          <MobileSessionDock
            session={session}
            modelOptions={modelOptions}
            onSwitch={(provider, model, reasoning) => void act("switch_model", { provider, model, reasoning })}
          />
        )}
        {switcherOpen && <button className="scrim" onClick={() => setSwitcherOpen(false)} aria-label="关闭工作台抽屉" />}
        <div className="message-pane">
          {session ? (
            <Conversation
              session={session}
              modelOptions={modelOptions}
              openPreview={openPreview}
              onSwitchModel={(provider, model, reasoning) => void act("switch_model", { provider, model, reasoning })}
            />
          ) : <EmptyState />}
        </div>
        <PendingBar
          cards={openCards}
          qaRun={qaRun}
          open={pendingOpen}
          setOpen={setPendingOpen}
          onCardAction={(card, actionId) => void act("card_action", { cardId: card.id, actionId })}
          onQaItem={(runId, itemId, status) => void act("qa_item_update", { qaRunId: runId, qaItemId: itemId, qaStatus: status })}
          onQaComplete={(runId) => void act("qa_complete", { qaRunId: runId })}
        />
        <Composer
          draft={draft}
          setDraft={setDraft}
          tokens={tokens}
          setTokens={setTokens}
          completions={filteredCompletions}
          chooseCompletion={chooseCompletion}
          sendMessage={sendMessage}
          onAction={(type) => type === "interrupt" ? setConfirmInterrupt(true) : void act(type)}
        />
        {confirmInterrupt && (
          <div className="modal">
            <div>
              <CircleStop size={28} />
              <h3>确认 Interrupt 当前 mock runner？</h3>
              <p>Kill 在 VSP-Coder 中表示中断当前 runner/session。它不会清空历史消息。</p>
              <button onClick={() => setConfirmInterrupt(false)}>取消</button>
              <button className="danger" onClick={() => void act("interrupt")}>确认 Interrupt</button>
            </div>
          </div>
        )}
      </main>

      <aside className="right-rail">
        <div className="tabs">
          <button className={rightTab === "workflow" ? "active" : ""} onClick={() => setRightTab("workflow")}><Workflow size={15} /> Workflow</button>
          <button className={rightTab === "skills" ? "active" : ""} onClick={() => setRightTab("skills")}><Bot size={15} /> Skill</button>
          <button className={rightTab === "activity" ? "active" : ""} onClick={() => setRightTab("activity")}><Clock3 size={15} /> Activity</button>
        </div>
        {rightTab === "workflow" && (
          <WorkflowPanel
            workflow={workflow}
            onAction={(type, extra) => void act(type, extra)}
            setRightTab={setRightTab}
          />
        )}
        {rightTab === "skills" && <SkillPanel preview={preview} completions={completions} />}
        {rightTab === "activity" && (
          <ActivityPanel
            events={scopedEvents}
            scope={activityScope}
            setScope={setActivityScope}
            activeProject={activeProject}
            session={session}
          />
        )}
      </aside>
    </div>
  );
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

function SessionCard({ session, active, onSelect }: { session: Session; active: boolean; onSelect: () => void }) {
  const pending = session.cards.filter((card) => card.status === "open").length;
  return (
    <button className={active ? "session-card active" : "session-card"} onClick={onSelect} onContextMenu={(event) => event.preventDefault()}>
      <strong>{session.title}</strong>
      <div className="session-meta">
        <span>{pending ? `待处理 ${pending}` : statusLabel(session.status)} · {modelLabel(session)}</span>
        <time>{formatTime(session.updatedAt)}</time>
      </div>
    </button>
  );
}

function Conversation(props: {
  session: Session;
  modelOptions: ModelOption[];
  openPreview: (token: StructuredToken) => void;
  onSwitchModel: (provider: string, model: string, reasoning: string) => void;
}) {
  return (
    <>
      <SessionStatusBar
        session={props.session}
        modelOptions={props.modelOptions}
        onSwitchModel={props.onSwitchModel}
      />
      <div className="messages">
        {props.session.messages.map((message) => <MessageBubble key={message.id} message={message} openPreview={props.openPreview} />)}
      </div>
    </>
  );
}

function SessionStatusBar({ session, modelOptions, onSwitchModel }: {
  session: Session;
  modelOptions: ModelOption[];
  onSwitchModel: (provider: string, model: string, reasoning: string) => void;
}) {
  const current = `${session.provider}:${session.model}`;
  const option = modelOptions.find((item) => `${item.provider}:${item.model}` === current);
  const reasoningChoices = option?.reasoning.length ? option.reasoning : ["xhigh", "high", "medium"];
  return (
    <div className="session-statusbar">
      <span className={`status-dot ${session.status}`} />
      <strong>{statusLabel(session.status)}</strong>
      <select
        aria-label="切换当前会话模型"
        value={current}
        onChange={(event) => {
          const [provider, model] = event.target.value.split(":");
          onSwitchModel(provider, model, session.reasoning);
        }}
      >
        {modelOptions.map((item) => <option key={`${item.provider}:${item.model}`} value={`${item.provider}:${item.model}`}>{modelOptionLabel(item)}</option>)}
      </select>
      <select
        aria-label="切换当前会话 reasoning"
        value={session.reasoning}
        onChange={(event) => onSwitchModel(session.provider, session.model, event.target.value)}
      >
        {reasoningChoices.map((item) => <option key={item}>{item}</option>)}
      </select>
      <span>runner {session.runnerOwner}</span>
      <span>{option?.status === "mock" ? "mock 映射" : option?.status || "unknown"}</span>
      <span>{session.queue.filter((item) => item.state === "pending").length} queued</span>
      <span>{session.metric.inputTokens + session.metric.outputTokens} tokens</span>
    </div>
  );
}

function ModelControl({ session, modelOptions, onSwitch }: {
  session: Session;
  modelOptions: ModelOption[];
  onSwitch: (provider: string, model: string, reasoning: string) => void;
}) {
  return (
    <div className="model-card">
      <div>
        <span>当前会话模型</span>
        <strong>{modelLabel(session)} · {session.reasoning}</strong>
      </div>
      <select
        value={`${session.provider}:${session.model}`}
        onChange={(event) => {
          const [provider, model] = event.target.value.split(":");
          onSwitch(provider, model, session.reasoning);
        }}
      >
        {modelOptions.map((item) => <option key={`${item.provider}:${item.model}`} value={`${item.provider}:${item.model}`}>{modelOptionLabel(item)}</option>)}
      </select>
    </div>
  );
}

function MobileSessionDock({ session, modelOptions, onSwitch }: {
  session: Session;
  modelOptions: ModelOption[];
  onSwitch: (provider: string, model: string, reasoning: string) => void;
}) {
  const current = `${session.provider}:${session.model}`;
  const option = modelOptions.find((item) => `${item.provider}:${item.model}` === current);
  const reasoningChoices = option?.reasoning.length ? option.reasoning : ["xhigh", "high", "medium"];
  return (
    <div className="mobile-session-dock">
      <span className={`status-dot ${session.status}`} />
      <strong>{statusLabel(session.status)}</strong>
      <select
        value={current}
        aria-label="切换当前会话模型"
        onChange={(event) => {
          const [provider, model] = event.target.value.split(":");
          onSwitch(provider, model, session.reasoning);
        }}
      >
        {modelOptions.map((item) => <option key={`${item.provider}:${item.model}`} value={`${item.provider}:${item.model}`}>{modelOptionLabel(item)}</option>)}
      </select>
      <select
        value={session.reasoning}
        aria-label="切换当前会话 reasoning"
        onChange={(event) => onSwitch(session.provider, session.model, event.target.value)}
      >
        {reasoningChoices.map((item) => <option key={item}>{item}</option>)}
      </select>
    </div>
  );
}

function MessageBubble({ message, openPreview }: { message: Message; openPreview: (token: StructuredToken) => void }) {
  return (
    <article className={`bubble ${message.role}`}>
      {message.blocks.map((block, index) => {
        if (block.type === "text") return <p key={index}>{block.text}</p>;
        if (block.type === "tokens") {
          return <div className="token-row" key={index}>{block.tokens.map((token) => <button key={token.id} onClick={() => openPreview(token)}>{token.label}</button>)}</div>;
        }
        return <span className="attachment" key={index}>{block.name}</span>;
      })}
    </article>
  );
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
  return (
    <article className={`request-card ${card.kind}`}>
      <span>{cardKindLabel(card.kind)}</span>
      <strong>{card.title}</strong>
      <p>{card.body}</p>
      <div>{card.actions.map((action) => <button key={action.id} className={action.tone || ""} onClick={() => onAction(action.id)}>{action.label}</button>)}</div>
    </article>
  );
}

function Composer(props: {
  draft: string;
  setDraft: (value: string) => void;
  tokens: StructuredToken[];
  setTokens: React.Dispatch<React.SetStateAction<StructuredToken[]>>;
  completions: CompletionItem[];
  chooseCompletion: (item: CompletionItem) => void;
  sendMessage: () => void;
  onAction: (type: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

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
      <div className="composer-input">
        <div className="draft-tokens">
          {props.tokens.map((token) => <span key={token.id}>{token.label}<button onClick={() => props.setTokens((prev) => prev.filter((item) => item.id !== token.id))}><X size={12} /></button></span>)}
        </div>
        <input value={props.draft} onChange={(event) => props.setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void props.sendMessage(); }} placeholder="给 Codex 发消息..." />
        {!!props.completions.length && (
          <div className="autocomplete">
            {props.completions.map((item) => <button key={item.id} onClick={() => props.chooseCompletion(item)}><strong>{item.label}</strong><small>{item.group} · {item.description}</small></button>)}
          </div>
        )}
      </div>
      <button className="send" onClick={() => void props.sendMessage()}><Send size={18} /> 发送</button>
    </div>
  );
}

function WorkflowPanel({ workflow, onAction, setRightTab }: { workflow: WorkflowSnapshot | null; onAction: (type: string, extra?: Record<string, unknown>) => void; setRightTab: (tab: RightTab) => void }) {
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
          <p>这个 Project 没有 `.pipeline/config.yaml` 和 `.pipeline/state.yaml`。右侧栏暂时显示通用项目状态；会话、模型切换和 Activity 仍可使用。</p>
        </div>
        <h3>可读资源</h3>
        <div className="resource-links">
          <button onClick={() => onAction("open_resource", { value: "Project path" })}><FileText size={15} /><div><strong>Project path</strong><small>{workflow.project.path}</small></div></button>
          <button onClick={() => { onAction("open_resource", { value: "Activity" }); setRightTab("activity"); }}><Clock3 size={15} /><div><strong>Activity</strong><small>查看该项目最近事件</small></div></button>
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
  const lines = markdown.split(/\r?\n/).filter((line) => line.trim());
  return (
    <div className="compact-plan markdown-block">
      {lines.map((line, index) => {
        if (line.startsWith("# ")) return <h4 key={index}>{line.replace(/^#\s+/, "")}</h4>;
        if (line.startsWith("## ")) return <h5 key={index}>{line.replace(/^##\s+/, "")}</h5>;
        if (line.startsWith("### ")) return <h6 key={index}>{line.replace(/^###\s+/, "")}</h6>;
        if (/^[-*]\s+/.test(line)) return <p className="md-list" key={index}>{line.replace(/^[-*]\s+/, "")}</p>;
        if (/^\d+\.\s+/.test(line)) return <p className="md-list" key={index}>{line}</p>;
        return <p key={index}>{line}</p>;
      })}
    </div>
  );
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

function SkillPanel({ preview, completions }: { preview: Preview | null; completions: CompletionItem[] }) {
  return (
    <div className="panel">
      <h2>Skill / Command</h2>
      {preview ? (
        <div className="preview-box">
          <strong>{preview.title}</strong>
          <p>{preview.description}</p>
          <code>{preview.path || preview.kind}</code>
          <span>{preview.body}</span>
        </div>
      ) : <div className="empty">点击消息里的 Skill/Command/File chip 查看功能说明。</div>}
      <div className="skill-list">
        {completions.map((item) => <article key={item.id}><strong>{item.label}</strong><span>{item.group} · {item.description}</span></article>)}
      </div>
    </div>
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

function byUpdated(a: Session, b: Session) {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
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

function providerLabel(provider: string) {
  const labels: Record<string, string> = {
    mock: "Mock",
    codex: "Codex",
    opencode: "OpenCode",
    claude: "Claude Code"
  };
  return labels[provider] || provider;
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

createRoot(document.getElementById("root")!).render(<App />);

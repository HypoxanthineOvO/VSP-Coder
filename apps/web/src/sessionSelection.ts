import type { Project, Session, VspState } from "@vsp-coder/protocol";

export const selectionStorageKey = "vsp-coder-selection";

export type PersistedSelection = {
  projectId: string;
  sessionId: string;
  updatedAt?: string;
};

export type ResolvedSelection = {
  projectId: string;
  sessionId: string;
  fallbackReason: "none" | "missing_project" | "missing_session" | "empty_project" | "first_available";
};

export function readPersistedSelection(storage: Storage = window.localStorage): PersistedSelection | null {
  try {
    const parsed = JSON.parse(storage.getItem(selectionStorageKey) || "null") as Partial<PersistedSelection> | null;
    if (!parsed?.projectId && !parsed?.sessionId) return null;
    return {
      projectId: parsed.projectId || "",
      sessionId: parsed.sessionId || "",
      updatedAt: parsed.updatedAt
    };
  } catch {
    return null;
  }
}

export function writePersistedSelection(selection: PersistedSelection, storage: Storage = window.localStorage) {
  if (!selection.projectId) return;
  storage.setItem(selectionStorageKey, JSON.stringify(selection));
}

export function resolveSessionSelection(input: {
  state: VspState;
  sessions: Session[];
  currentProjectId?: string;
  currentSessionId?: string;
  persisted?: PersistedSelection | null;
}): ResolvedSelection {
  const projects = input.state.projects;
  const sessions = input.sessions;
  const current = findSession(projects, sessions, input.currentSessionId, input.currentProjectId);
  if (current) return { projectId: current.projectId, sessionId: current.id, fallbackReason: "none" };

  const persisted = input.persisted;
  if (persisted?.sessionId) {
    const persistedSession = sessions.find((session) => session.id === persisted.sessionId);
    if (persistedSession) return { projectId: persistedSession.projectId, sessionId: persistedSession.id, fallbackReason: "none" };
  }

  if (persisted?.projectId && !projects.some((project) => project.id === persisted.projectId)) {
    return firstAvailableSelection(input.state, sessions, "missing_project");
  }

  if (persisted?.projectId) {
    const session = sessions.find((item) => item.projectId === persisted.projectId);
    if (session) return { projectId: persisted.projectId, sessionId: session.id, fallbackReason: persisted.sessionId ? "missing_session" : "none" };
    return { projectId: persisted.projectId, sessionId: "", fallbackReason: "empty_project" };
  }

  return firstAvailableSelection(input.state, sessions, input.currentSessionId ? "missing_session" : "none");
}

function findSession(projects: Project[], sessions: Session[], sessionId?: string, projectId?: string) {
  if (!sessionId) return null;
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return null;
  if (projectId && session.projectId !== projectId) return null;
  if (!projects.some((project) => project.id === session.projectId)) return null;
  return session;
}

function firstAvailableSelection(state: VspState, sessions: Session[], fallbackReason: ResolvedSelection["fallbackReason"]): ResolvedSelection {
  const defaultProject = state.defaultProjectId && state.projects.some((project) => project.id === state.defaultProjectId)
    ? state.defaultProjectId
    : state.projects[0]?.id || "";
  const session = sessions.find((item) => item.projectId === defaultProject) || sessions[0];
  return {
    projectId: session?.projectId || defaultProject,
    sessionId: session?.id || "",
    fallbackReason
  };
}

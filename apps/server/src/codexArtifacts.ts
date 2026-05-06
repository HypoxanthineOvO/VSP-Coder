import type { Artifact } from "@vsp-coder/protocol";

export type ArtifactUpdate = Artifact & {
  appendBody?: boolean;
};

export function artifactsFromCodexItem(sessionId: string, item: unknown): ArtifactUpdate[] {
  const record = asRecord(item);
  const type = stringValue(record.type);
  const id = stringValue(record.id) || stableHash(JSON.stringify(record));

  if (type === "commandExecution") {
    const command = stringValue(record.command) || "(unknown command)";
    const output = stringValue(record.aggregatedOutput);
    const status = commandStatus(record.status);
    return [{
      id: commandArtifactId(id),
      sessionId,
      kind: "command",
      title: commandTitle(command),
      path: stringValue(record.cwd) || undefined,
      mime: "text/plain",
      status,
      body: commandBody(command, status, output, numberValue(record.exitCode), numberValue(record.durationMs)),
      previewStatus: "renderable"
    }];
  }

  if (type === "fileChange") {
    return [
      ...artifactsFromFileChanges(sessionId, id, arrayValue(record.changes), stringValue(record.status) || "changed"),
      {
        id: fileChangeOutputArtifactId(id),
        sessionId,
        kind: "command",
        title: "File change output",
        mime: "text/plain",
        status: fileChangeStatus(record.status),
        previewStatus: "renderable"
      }
    ];
  }

  return [];
}

export function artifactUpdatesFromNotification(method: string, params: unknown): ArtifactUpdate[] {
  const record = asRecord(params);
  const sessionId = stringValue(record.threadId);
  const itemId = stringValue(record.itemId);
  if (!sessionId) return [];

  if (method === "item/commandExecution/outputDelta" && itemId) {
    const delta = stringValue(record.delta);
    if (!delta) return [];
    return [{
      id: commandArtifactId(itemId),
      sessionId,
      kind: "command",
      title: "Command output",
      mime: "text/plain",
      status: "running",
      body: delta,
      appendBody: true,
      previewStatus: "renderable"
    }];
  }

  if (method === "item/fileChange/outputDelta" && itemId) {
    const delta = stringValue(record.delta);
    if (!delta) return [];
    return [{
      id: fileChangeOutputArtifactId(itemId),
      sessionId,
      kind: "command",
      title: "File change output",
      mime: "text/plain",
      status: "running",
      body: delta,
      appendBody: true,
      previewStatus: "renderable"
    }];
  }

  if (method === "item/fileChange/patchUpdated" && itemId) {
    return artifactsFromFileChanges(sessionId, itemId, arrayValue(record.changes), "changed");
  }

  if (method === "turn/diff/updated") {
    const turnId = stringValue(record.turnId) || "turn";
    const diff = stringValue(record.diff);
    if (!diff) return [];
    return [{
      id: `artifact:${turnId}:diff`,
      sessionId,
      kind: "diff",
      title: "Turn diff",
      mime: "text/x-diff",
      status: "changed",
      body: trimBody(diff),
      previewStatus: "renderable"
    }];
  }

  return [];
}

export function mergeArtifactUpdates(existing: Artifact[], updates: ArtifactUpdate[]): Artifact[] {
  let next = existing;
  for (const update of updates) {
    const current = next.find((artifact) => artifact.id === update.id);
    const normalized = stripUpdate(update);
    if (!current) {
      next = [normalized, ...next];
      continue;
    }
    next = next.map((artifact) => {
      if (artifact.id !== update.id) return artifact;
      return {
        ...artifact,
        ...normalized,
        body: update.appendBody ? trimBody(`${artifact.body || ""}${update.body || ""}`) : typeof normalized.body === "undefined" ? artifact.body : normalized.body
      };
    });
  }
  return next;
}

function artifactsFromFileChanges(sessionId: string, itemId: string, changes: unknown[], status: string): ArtifactUpdate[] {
  return changes.map(asRecord).map((change, index) => {
    const path = stringValue(change.path) || `change-${index + 1}`;
    const diff = stringValue(change.diff);
    const kind = stringValue(change.kind) || "changed";
    return {
      id: `artifact:${itemId}:diff:${stableHash(path)}`,
      sessionId,
      kind: "diff" as const,
      title: `${kind}: ${path}`,
      path,
      mime: "text/x-diff",
      status: fileChangeStatus(status),
      body: diff ? trimBody(diff) : "Diff is unavailable for this file change.",
      previewStatus: diff ? "renderable" as const : "unsupported" as const
    };
  });
}

function stripUpdate(update: ArtifactUpdate): Artifact {
  const { appendBody: _appendBody, ...artifact } = update;
  return artifact;
}

function commandArtifactId(itemId: string) {
  return `artifact:${itemId}:command`;
}

function fileChangeOutputArtifactId(itemId: string) {
  return `artifact:${itemId}:file-output`;
}

function commandTitle(command: string) {
  const normalized = command.replace(/\s+/g, " ").trim();
  return normalized.length > 64 ? `${normalized.slice(0, 61)}...` : normalized;
}

function commandBody(command: string, status: Artifact["status"], output: string, exitCode: number | undefined, durationMs: number | undefined) {
  const details = [
    `$ ${command}`,
    `status: ${status || "unknown"}`,
    typeof exitCode === "number" ? `exit: ${exitCode}` : null,
    typeof durationMs === "number" ? `duration: ${durationMs}ms` : null
  ].filter(Boolean).join("\n");
  return trimBody(output ? `${details}\n\n${output}` : details);
}

function commandStatus(value: unknown): Artifact["status"] {
  const status = stringValue(value);
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  if (status === "declined") return "declined";
  if (status === "inProgress") return "running";
  return "unsupported";
}

function fileChangeStatus(value: unknown): Artifact["status"] {
  const status = stringValue(value);
  if (status === "completed" || status === "success") return "completed";
  if (status === "failed") return "failed";
  return "changed";
}

function trimBody(value: string) {
  const max = 120_000;
  if (value.length <= max) return value;
  return `${value.slice(0, max)}\n\n[output truncated by VSP-Coder]`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stableHash(value: string) {
  let hash = 5381;
  for (const char of value) hash = ((hash << 5) + hash + char.charCodeAt(0)) >>> 0;
  return hash.toString(36);
}

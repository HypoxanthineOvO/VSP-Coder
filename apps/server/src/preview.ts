import { readFileSync, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import type { Artifact, Session } from "@vsp-coder/protocol";

export type PreviewResponse = {
  title: string;
  kind: string;
  path?: string;
  description?: string;
  previewStatus: "placeholder" | "renderable" | "unsupported";
  body: string;
};

const maxPreviewBytes = 256 * 1024;

export function previewArtifact(session: Session, artifact: Artifact): PreviewResponse {
  if (artifact.body) {
    return {
      title: artifact.title,
      kind: artifact.kind || "artifact",
      path: artifact.path,
      description: artifact.status ? `status: ${artifact.status}` : artifact.mime,
      previewStatus: artifact.previewStatus,
      body: artifact.body
    };
  }

  if (!artifact.path) {
    return unsupported(artifact, "No preview body or file path is available.");
  }

  const file = resolveArtifactPath(session.cwd, artifact.path);
  const stat = statSync(file);
  if (!stat.isFile()) return unsupported(artifact, "Preview target is not a file.");
  if (stat.size > maxPreviewBytes) return unsupported(artifact, `File is too large for inline preview (${stat.size} bytes).`);
  if (!isTextPreview(file, artifact.mime)) return unsupported(artifact, "Binary or unsupported file type.");

  return {
    title: artifact.title,
    kind: artifact.kind || "file",
    path: artifact.path,
    description: artifact.mime || "text/plain",
    previewStatus: "renderable",
    body: readFileSync(file, "utf8")
  };
}

export function resolveArtifactPath(root: string, artifactPath: string) {
  const rootPath = resolve(root);
  const candidate = resolve(rootPath, artifactPath);
  if (candidate !== rootPath && !candidate.startsWith(`${rootPath}${sep}`)) {
    throw Object.assign(new Error("Preview path escapes the selected project root"), { status: 403 });
  }
  return candidate;
}

function unsupported(artifact: Artifact, body: string): PreviewResponse {
  return {
    title: artifact.title,
    kind: artifact.kind || "artifact",
    path: artifact.path,
    description: artifact.mime,
    previewStatus: "unsupported",
    body
  };
}

function isTextPreview(path: string, mime: string | undefined) {
  if (mime?.startsWith("text/")) return true;
  const ext = extname(path).toLowerCase();
  return [
    ".css",
    ".diff",
    ".html",
    ".js",
    ".json",
    ".jsx",
    ".log",
    ".md",
    ".mjs",
    ".ts",
    ".tsx",
    ".txt",
    ".yaml",
    ".yml"
  ].includes(ext);
}

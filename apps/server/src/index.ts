import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { extname, join, resolve } from "node:path";
import { MockStore, projectRoot } from "./store.js";

const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 4180);
const webDist = join(projectRoot, "apps/web/dist");
const store = new MockStore();

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
  if (url.pathname === "/api/health") return json(res, 200, { ok: true, service: "vsp-coder", mode: "mock" });
  if (url.pathname === "/api/events") return sse(req, res);
  if (url.pathname === "/api/state") return json(res, 200, store.snapshot());
  if (url.pathname === "/api/projects") return json(res, 200, store.snapshot().projects);
  if (url.pathname === "/api/models") return json(res, 200, store.modelOptions());
  if (url.pathname === "/api/completions") return json(res, 200, store.completions());
  if (url.pathname === "/api/workflow") return json(res, 200, store.workflow(url.searchParams.get("projectId") || "vsp-coder"));
  if (url.pathname.startsWith("/api/preview/")) {
    return json(res, 200, store.preview(decodeURIComponent(url.pathname.replace("/api/preview/", ""))));
  }

  const sessionMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)$/);
  if (url.pathname === "/api/sessions" && req.method === "POST") return json(res, 200, store.createSession(await body(req)));
  if (sessionMatch && req.method === "GET") return json(res, 200, store.getSession(sessionMatch[1]));
  if (sessionMatch && req.method === "POST") return json(res, 200, store.sendMessage(sessionMatch[1], await body(req)));

  const actionMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/actions$/);
  if (actionMatch && req.method === "POST") return json(res, 200, store.applyAction(actionMatch[1], await body(req)));

  return staticFile(url.pathname, res);
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
  const urls = [`http://localhost:${port}`, ...lanUrls(port)];
  console.log(`VSP-Coder mock server listening on ${host}:${port}`);
  for (const url of urls) console.log(`  ${url}`);
});

function lanUrls(port: number) {
  return Object.values(networkInterfaces())
    .flatMap((entries) => entries || [])
    .filter((entry) => entry.family === "IPv4" && !entry.internal)
    .map((entry) => `http://${entry.address}:${port}`);
}

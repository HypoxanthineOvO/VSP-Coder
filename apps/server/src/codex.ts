import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Readable, Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import type { CodexProviderHealth } from "@vsp-coder/protocol";

type JsonRpcId = string | number;

type JsonRpcRequest = {
  id: JsonRpcId;
  method: string;
  params?: unknown;
};

type JsonRpcResponse = {
  id: JsonRpcId;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
};

type JsonRpcNotification = {
  method: string;
  params?: unknown;
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

export class LineJsonRpcClient extends EventEmitter {
  private nextId = 1;
  private buffer = "";
  private pending = new Map<JsonRpcId, PendingRequest>();

  constructor(
    private readonly input: Readable,
    private readonly output: Writable,
    private readonly requestTimeoutMs = 8_000
  ) {
    super();
    input.on("data", (chunk) => this.consume(String(chunk)));
    input.on("error", (error) => this.rejectAll(error instanceof Error ? error : new Error(String(error))));
    input.on("close", () => this.rejectAll(new Error("JSON-RPC input closed")));
  }

  request<T = unknown>(method: string, params?: unknown, timeoutMs = this.requestTimeoutMs): Promise<T> {
    const id = this.nextId++;
    const payload: JsonRpcRequest = typeof params === "undefined" ? { id, method } : { id, method, params };
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`JSON-RPC request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timer
      });
      this.write(payload);
    });
  }

  notify(method: string, params?: unknown) {
    const payload = typeof params === "undefined" ? { method } : { method, params };
    this.write(payload);
  }

  respond(id: JsonRpcId, result?: unknown) {
    this.write({ id, result });
  }

  rejectRequest(id: JsonRpcId, code: number, message: string, data?: unknown) {
    this.write({ id, error: typeof data === "undefined" ? { code, message } : { code, message, data } });
  }

  dispose() {
    this.rejectAll(new Error("JSON-RPC client disposed"));
    this.removeAllListeners();
  }

  private write(value: unknown) {
    this.output.write(`${JSON.stringify(value)}\n`);
  }

  private consume(chunk: string) {
    this.buffer += chunk;
    while (true) {
      const newline = this.buffer.indexOf("\n");
      if (newline === -1) return;
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;
      this.handleLine(line);
    }
  }

  private handleLine(line: string) {
    let message: JsonRpcResponse | JsonRpcRequest | JsonRpcNotification;
    try {
      message = JSON.parse(line) as JsonRpcResponse | JsonRpcNotification;
    } catch (error) {
      this.emit("protocol-error", error instanceof Error ? error : new Error(String(error)), line);
      return;
    }

    if (isJsonRpcRequest(message)) {
      this.emit("request", message);
      return;
    }

    if (isJsonRpcResponse(message)) {
      const pending = this.pending.get(message.id);
      if (!pending) {
        this.emit("protocol-error", new Error(`Unexpected JSON-RPC response id: ${String(message.id)}`), message);
        return;
      }
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
      return;
    }

    if (isJsonRpcNotification(message)) {
      this.emit("notification", message);
      return;
    }

    this.emit("protocol-error", new Error("Invalid JSON-RPC message"), message);
  }

  private rejectAll(error: Error) {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pending.delete(id);
    }
  }
}

type InitializeResponse = {
  userAgent: string;
  codexHome: string;
  platformFamily: string;
  platformOs: string;
};

const clientVersion = readClientVersion();

export class CodexAppServerManager extends EventEmitter {
  private child: ChildProcessWithoutNullStreams | null = null;
  private client: LineJsonRpcClient | null = null;
  private health: CodexProviderHealth = {
    provider: "codex",
    status: "stopped",
    transport: "stdio"
  };
  private startPromise: Promise<CodexProviderHealth> | null = null;

  getHealth() {
    return { ...this.health };
  }

  async start() {
    if (this.health.status === "ready") return this.getHealth();
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.startInner().finally(() => {
      this.startPromise = null;
    });
    return this.startPromise;
  }

  async stop() {
    const child = this.child;
    this.client?.dispose();
    this.client = null;
    this.child = null;
    if (child && !child.killed) child.kill("SIGTERM");
    this.health = { ...this.health, status: "stopped", pid: undefined };
    this.emit("health", this.getHealth());
  }

  async request<T = unknown>(method: string, params?: unknown, timeoutMs?: number) {
    await this.start();
    if (!this.client) throw new Error("Codex app-server client is not available");
    return this.client.request<T>(method, params, timeoutMs);
  }

  async respond(id: JsonRpcId, result?: unknown) {
    await this.start();
    if (!this.client) throw new Error("Codex app-server client is not available");
    this.client.respond(id, result);
  }

  async rejectRequest(id: JsonRpcId, code: number, message: string, data?: unknown) {
    await this.start();
    if (!this.client) throw new Error("Codex app-server client is not available");
    this.client.rejectRequest(id, code, message, data);
  }

  private async startInner() {
    this.health = {
      provider: "codex",
      status: "starting",
      transport: "stdio"
    };
    this.emit("health", this.getHealth());

    const child = spawn("codex", ["app-server", "--listen", "stdio://"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"]
    });
    this.child = child;
    this.health = { ...this.health, pid: child.pid };

    child.stderr.on("data", (chunk) => {
      const message = stripAnsi(String(chunk)).trim();
      if (message) {
        this.health = { ...this.health, lastError: message };
        this.emit("stderr", message);
      }
    });

    child.on("exit", (code, signal) => {
      this.client?.dispose();
      this.client = null;
      this.child = null;
      this.health = {
        ...this.health,
        status: code === 0 || signal === "SIGTERM" ? "stopped" : "crashed",
        pid: undefined,
        lastExit: { code, signal, at: new Date().toISOString() }
      };
      this.emit("health", this.getHealth());
    });

    const client = new LineJsonRpcClient(child.stdout, child.stdin);
    this.client = client;
    client.on("notification", (message) => this.emit("notification", message));
    client.on("request", (message) => this.emit("request", message));
    client.on("protocol-error", (error) => this.emit("protocol-error", error));

    try {
      const result = await client.request<InitializeResponse>("initialize", {
        clientInfo: { name: "vsp-coder", title: "VSP-Coder", version: clientVersion },
        capabilities: { experimentalApi: true }
      });
      client.notify("initialized");
      this.health = {
        provider: "codex",
        status: "ready",
        transport: "stdio",
        pid: child.pid,
        userAgent: result.userAgent,
        codexHome: result.codexHome,
        platformFamily: result.platformFamily,
        platformOs: result.platformOs,
        initializedAt: new Date().toISOString(),
        lastError: this.health.lastError
      };
      this.emit("health", this.getHealth());
      return this.getHealth();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.health = {
        provider: "codex",
        status: "unavailable",
        transport: "stdio",
        lastError: message
      };
      this.emit("health", this.getHealth());
      if (!child.killed) child.kill("SIGTERM");
      throw error;
    }
  }
}

function readClientVersion() {
  try {
    const packageJsonPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../..", "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: unknown };
    if (typeof packageJson.version === "string" && packageJson.version) return packageJson.version;
  } catch {
    // Fall through to a conservative value for unusual packaged layouts.
  }
  return "0.0.0";
}

function isJsonRpcRequest(message: JsonRpcResponse | JsonRpcRequest | JsonRpcNotification): message is JsonRpcRequest {
  return "id" in message && typeof (message as JsonRpcRequest).method === "string";
}

function isJsonRpcResponse(message: JsonRpcResponse | JsonRpcRequest | JsonRpcNotification): message is JsonRpcResponse {
  return "id" in message && !("method" in message) && ("result" in message || "error" in message);
}

function isJsonRpcNotification(message: JsonRpcResponse | JsonRpcRequest | JsonRpcNotification): message is JsonRpcNotification {
  return !("id" in message) && typeof (message as JsonRpcNotification).method === "string";
}

function stripAnsi(value: string) {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

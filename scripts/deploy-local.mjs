#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { closeSync, mkdirSync, openSync, writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const runtimeDir = join(root, ".vsp-coder");
const args = new Set(process.argv.slice(2));
const host = valueArg("--host") || process.env.HOST || "0.0.0.0";
const requestedPort = numberArg("--port") || numberEnv("PORT");
const startPort = requestedPort || numberArg("--start-port") || 4180;
const noBuild = args.has("--no-build");

mkdirSync(runtimeDir, { recursive: true });

if (!noBuild) {
  const build = spawnSync("npm", ["run", "build"], {
    cwd: root,
    stdio: "inherit",
    env: process.env
  });
  if (build.status !== 0) process.exit(build.status || 1);
}

const port = requestedPort || await findAvailablePort(startPort, host);
const logPath = join(runtimeDir, `deploy-${port}.log`);
const logFd = openSync(logPath, "a");
const child = spawn(process.execPath, ["apps/server/dist/index.js"], {
  cwd: root,
  detached: true,
  stdio: ["ignore", logFd, logFd],
  env: { ...process.env, HOST: host, PORT: String(port) }
});
closeSync(logFd);
child.unref();

await waitForHealth(port);

const deployment = {
  pid: child.pid,
  host,
  port,
  startedAt: new Date().toISOString(),
  logPath: relativeToRoot(logPath),
  urls: deploymentUrls(port)
};
writeFileSync(join(runtimeDir, "deployment.json"), `${JSON.stringify(deployment, null, 2)}\n`);
writeFileSync(join(runtimeDir, "server.pid"), `${child.pid}\n`);

console.log("VSP-Coder deployed locally");
console.log(`pid: ${child.pid}`);
console.log(`port: ${port}`);
console.log(`log: ${deployment.logPath}`);
for (const url of deployment.urls) console.log(url);

function valueArg(name) {
  const prefix = `${name}=`;
  const pair = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  if (pair) return pair.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function numberArg(name) {
  const value = valueArg(name);
  return value ? Number(value) : 0;
}

function numberEnv(name) {
  const value = process.env[name];
  return value ? Number(value) : 0;
}

async function findAvailablePort(firstPort, bindHost) {
  for (let port = firstPort; port < firstPort + 200; port += 1) {
    if (await canListen(port, bindHost)) return port;
  }
  throw new Error(`No available port found from ${firstPort} to ${firstPort + 199}`);
}

function canListen(port, bindHost) {
  return new Promise((resolvePort) => {
    const server = net.createServer();
    server.once("error", () => resolvePort(false));
    server.once("listening", () => server.close(() => resolvePort(true)));
    server.listen(port, bindHost);
  });
}

async function waitForHealth(port) {
  const deadline = Date.now() + 10_000;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 150));
  }
  throw new Error(`Deployment did not become healthy on port ${port}: ${lastError}`);
}

function deploymentUrls(port) {
  const urls = [`http://127.0.0.1:${port}`];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) urls.push(`http://${entry.address}:${port}`);
    }
  }
  return [...new Set(urls)];
}

function relativeToRoot(path) {
  return path.startsWith(root) ? path.slice(root.length + 1) : path;
}

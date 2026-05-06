import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import test from "node:test";
import { LineJsonRpcClient } from "./codex.js";

function rpcPair() {
  const serverToClient = new PassThrough();
  const clientToServer = new PassThrough();
  const client = new LineJsonRpcClient(serverToClient, clientToServer, 50);
  return { client, serverToClient, clientToServer };
}

test("LineJsonRpcClient writes newline-delimited JSON-RPC requests", async () => {
  const { client, clientToServer, serverToClient } = rpcPair();
  const writes: string[] = [];
  clientToServer.on("data", (chunk) => writes.push(String(chunk)));
  const promise = client.request("initialize", { ok: true });
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(writes.join(""), /"method":"initialize"/);
  assert.match(writes.join(""), /\n$/);
  serverToClient.write('{"id":1,"result":{"ready":true}}\n');
  assert.deepEqual(await promise, { ready: true });
});

test("LineJsonRpcClient emits notifications", async () => {
  const { client, serverToClient } = rpcPair();
  const seen = new Promise((resolve) => client.once("notification", resolve));
  serverToClient.write('{"method":"thread/status/changed","params":{"status":"idle"}}\n');
  assert.deepEqual(await seen, { method: "thread/status/changed", params: { status: "idle" } });
});

test("LineJsonRpcClient emits server-initiated requests separately from responses", async () => {
  const { client, serverToClient } = rpcPair();
  const seen = new Promise((resolve) => client.once("request", resolve));
  serverToClient.write('{"id":"approval-1","method":"item/commandExecution/requestApproval","params":{"threadId":"thread-1"}}\n');
  assert.deepEqual(await seen, {
    id: "approval-1",
    method: "item/commandExecution/requestApproval",
    params: { threadId: "thread-1" }
  });
});

test("LineJsonRpcClient writes JSON-RPC responses to server requests", async () => {
  const { client, clientToServer } = rpcPair();
  const writes: string[] = [];
  clientToServer.on("data", (chunk) => writes.push(String(chunk)));
  client.respond("approval-1", { decision: "accept" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(writes.join(""), '{"id":"approval-1","result":{"decision":"accept"}}\n');
});

test("LineJsonRpcClient rejects JSON-RPC errors", async () => {
  const { client, serverToClient } = rpcPair();
  const promise = client.request("model/list");
  serverToClient.write('{"id":1,"error":{"code":-1,"message":"boom"}}\n');
  await assert.rejects(promise, /boom/);
});

test("LineJsonRpcClient times out pending requests", async () => {
  const { client } = rpcPair();
  await assert.rejects(client.request("slow", undefined, 5), /timed out/);
});

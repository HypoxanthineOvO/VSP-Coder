export type CodexRenameClient = {
  request<T = unknown>(method: string, params?: unknown, timeoutMs?: number): Promise<T>;
};

export async function setCodexThreadName(client: CodexRenameClient, threadId: string, rawName: string) {
  const name = normalizeThreadName(rawName);
  if (!threadId.trim()) throw Object.assign(new Error("Thread id is required"), { status: 400 });
  if (!name) throw Object.assign(new Error("Rename title is required"), { status: 400 });
  await client.request("thread/name/set", { threadId, name }, 10_000);
  return name;
}

export function normalizeThreadName(value: string) {
  return value.trim();
}

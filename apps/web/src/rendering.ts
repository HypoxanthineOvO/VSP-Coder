export type ParsedCommandOutput = {
  command: string;
  summary: string;
  status: "running" | "completed" | "failed" | "unknown";
  output: string;
};

export function parseCommandOutput(text: string): ParsedCommandOutput | null {
  const normalized = text.replace(/\r\n/g, "\n").trimEnd();
  if (!normalized.startsWith("$ ")) return null;
  const [commandLine = "", ...rest] = normalized.split("\n");
  const command = commandLine.replace(/^\$\s+/, "").trim();
  if (!command) return null;
  const output = rest.join("\n").trimEnd();
  const status = commandStatus(output);
  return {
    command,
    summary: `${status === "running" ? "正在运行" : status === "failed" ? "运行失败" : "已运行"} ${commandSummary(command)}`,
    status,
    output
  };
}

function commandStatus(output: string): ParsedCommandOutput["status"] {
  const firstLine = output.split("\n").find((line) => line.trim())?.trim().toLowerCase() || "";
  if (firstLine.includes("running")) return "running";
  if (firstLine.includes("failed") || firstLine.includes("error") || firstLine.includes("declined")) return "failed";
  if (firstLine.includes("completed") || firstLine.includes("success") || output) return "completed";
  return "unknown";
}

function commandSummary(command: string) {
  const shellMatch = command.match(/^\/bin\/(?:ba|z|)?sh\s+-lc\s+(['"])([\s\S]*)\1$/);
  const inner = shellMatch?.[2] || command;
  const cleaned = inner.replace(/\\(['"])/g, "$1").trim();
  if (!cleaned) return command;
  const first = cleaned.split(/[;&|]\s*/).find(Boolean) || cleaned;
  return first.length > 44 ? `${first.slice(0, 41)}...` : first;
}

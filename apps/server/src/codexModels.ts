import type { ModelOption } from "@vsp-coder/protocol";

type CodexReasoningOption = {
  reasoningEffort?: string;
};

type CodexModel = {
  id?: string;
  model?: string;
  displayName?: string;
  hidden?: boolean;
  supportedReasoningEfforts?: CodexReasoningOption[];
  defaultReasoningEffort?: string;
  isDefault?: boolean;
};

export type CodexModelListClient = {
  request<T = unknown>(method: string, params?: unknown, timeoutMs?: number): Promise<T>;
};

export async function listCodexModelOptions(client: CodexModelListClient): Promise<ModelOption[]> {
  const response = await client.request<{ data?: CodexModel[] }>("model/list", { includeHidden: false }, 10_000);
  const options = (response.data || [])
    .filter((model) => !model.hidden)
    .map(codexModelToOption)
    .filter((option): option is ModelOption => Boolean(option));
  return options.length ? options : fallbackCodexModelOptions();
}

export function fallbackCodexModelOptions(): ModelOption[] {
  return [
    codexOption("gpt-5.5", "GPT-5.5"),
    codexOption("gpt-5.4", "GPT-5.4"),
    codexOption("gpt-5.3-codex", "GPT-5.3 Codex"),
    codexOption("gpt-5.2", "GPT-5.2"),
    codexOption("gpt-5.4-mini", "GPT-5.4 Mini")
  ];
}

function codexModelToOption(model: CodexModel): ModelOption | null {
  const id = model.model || model.id;
  if (!id) return null;
  const reasoning = model.supportedReasoningEfforts
    ?.map((item) => item.reasoningEffort)
    .filter((item): item is string => Boolean(item)) || [];
  const uniqueReasoning = [...new Set(reasoning.length ? reasoning : [model.defaultReasoningEffort || "xhigh"])];
  return codexOption(id, model.displayName || id, uniqueReasoning, model.isDefault ? "Codex 默认模型" : "Codex app-server model/list");
}

function codexOption(model: string, label: string, reasoning = ["xhigh", "high", "medium", "low"], note = "Codex app-server model/list"): ModelOption {
  return {
    provider: "codex",
    model,
    label,
    reasoning,
    status: "available",
    note
  };
}

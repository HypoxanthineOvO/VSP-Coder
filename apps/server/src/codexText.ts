export function stripIdeContextWrapper(text: string) {
  const marker = "My request for Codex:";
  const normalized = text.trimStart();
  if (!normalized.startsWith("Context from my IDE setup:")) return text;
  const markerIndex = normalized.indexOf(marker);
  if (markerIndex === -1) return text;
  const request = normalized.slice(markerIndex + marker.length).trim();
  return request || text;
}


// Unique ID generation

export function createId() {
  // randomUUID only exists in secure contexts (https or localhost), so keep a fallback.
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Pull the mentioned user IDs out of a TipTap document (stored as a JSON string).
// A mention node looks like { type: "mention", attrs: { id, label } }.
export function extractMentionIds(doc: string | null | undefined): string[] {
  if (!doc) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(doc);
  } catch {
    return []; // legacy plain-text (e.g. old comments) — no mentions
  }
  const ids = new Set<string>();
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; attrs?: { id?: unknown }; content?: unknown[] };
    if (n.type === "mention" && n.attrs?.id) ids.add(String(n.attrs.id));
    if (Array.isArray(n.content)) n.content.forEach(walk);
  };
  walk(parsed);
  return [...ids];
}

/** Flatten a TipTap document to plain text (mentions become "@Label") — for
 *  email excerpts. Falls back to the raw string for legacy plain-text bodies. */
export function extractText(doc: string | null | undefined): string {
  if (!doc) return "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(doc);
  } catch {
    return String(doc);
  }
  const parts: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; text?: string; attrs?: { label?: unknown }; content?: unknown[] };
    if (n.type === "text" && typeof n.text === "string") parts.push(n.text);
    else if (n.type === "mention" && n.attrs?.label) parts.push(`@${String(n.attrs.label)}`);
    if (Array.isArray(n.content)) n.content.forEach(walk);
  };
  walk(parsed);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}


import { SCREEN_FIELDS, type ScreenField } from "@/lib/review-anchor";

// A review round reviews a FROZEN copy of the storyboard, taken when the round starts
// (docs/REVIEW-LINKS.md, locked decision 3). Comments anchor to it, so editing the live
// storyboard mid-review can't orphan feedback — and comparing one round's snapshot with
// the previous round's gives "changed since your last review" for free.

export type SnapshotScreen = {
  id: string;
  title: string;
  screenType: string;
  fields: Record<ScreenField, string | null>; // TipTap JSON strings, as stored on Screen
};

export type StoryboardSnapshot = {
  v: 1;
  storyboardId: string;
  title: string;
  screens: SnapshotScreen[];
};

type ScreenRow = { id: string; title: string; screenType: string } & Record<ScreenField, string | null>;

export function buildSnapshot(storyboard: { id: string; title: string; screens: ScreenRow[] }): StoryboardSnapshot {
  return {
    v: 1,
    storyboardId: storyboard.id,
    title: storyboard.title,
    screens: storyboard.screens.map((s) => ({
      id: s.id,
      title: s.title,
      screenType: s.screenType,
      fields: Object.fromEntries(SCREEN_FIELDS.map((f) => [f, s[f] ?? null])) as Record<ScreenField, string | null>,
    })),
  };
}

/** Read a stored snapshot defensively — a round may predate snapshots (null) or the
 *  JSON may be from a newer shape; either way the caller gets null, not a crash. */
export function parseSnapshot(raw: unknown): StoryboardSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<StoryboardSnapshot>;
  if (s.v !== 1 || !Array.isArray(s.screens) || typeof s.title !== "string") return null;
  return s as StoryboardSnapshot;
}

export type ScreenChange =
  | { kind: "added" }
  | { kind: "changed"; fields: ScreenField[]; titleChanged: boolean; typeChanged: boolean }
  | { kind: "unchanged" };

export type SnapshotDiff = {
  screens: Record<string, ScreenChange>; // keyed by screen id in the CURRENT snapshot
  removed: { id: string; title: string }[]; // screens in the previous round that are gone
  changedCount: number; // added + changed
};

/** Compare text content, not raw JSON — re-saving a TipTap doc can reorder attributes
 *  without changing a word, and that mustn't light up as "changed". */
export function plainText(doc: string | null): string {
  if (!doc) return "";
  try {
    const parts: string[] = [];
    const walk = (n: unknown) => {
      if (!n || typeof n !== "object") return;
      const node = n as { type?: string; text?: string; attrs?: { label?: string }; content?: unknown[] };
      if (node.type === "text" && node.text) parts.push(node.text);
      else if (node.type === "mention" && node.attrs?.label) parts.push("@" + node.attrs.label);
      else if (node.type && node.type !== "text" && node.type !== "doc") parts.push("\n");
      node.content?.forEach(walk);
    };
    walk(JSON.parse(doc));
    return parts.join("").replace(/\s+/g, " ").trim();
  } catch {
    return doc.trim();
  }
}

export function diffSnapshots(prev: StoryboardSnapshot, curr: StoryboardSnapshot): SnapshotDiff {
  const before = new Map(prev.screens.map((s) => [s.id, s]));
  const screens: Record<string, ScreenChange> = {};
  let changedCount = 0;
  for (const s of curr.screens) {
    const old = before.get(s.id);
    if (!old) {
      screens[s.id] = { kind: "added" };
      changedCount++;
      continue;
    }
    const fields = SCREEN_FIELDS.filter((f) => plainText(s.fields[f]) !== plainText(old.fields[f]));
    const titleChanged = s.title.trim() !== old.title.trim();
    const typeChanged = s.screenType !== old.screenType;
    if (fields.length || titleChanged || typeChanged) {
      screens[s.id] = { kind: "changed", fields, titleChanged, typeChanged };
      changedCount++;
    } else {
      screens[s.id] = { kind: "unchanged" };
    }
  }
  const currentIds = new Set(curr.screens.map((s) => s.id));
  const removed = prev.screens.filter((s) => !currentIds.has(s.id)).map((s) => ({ id: s.id, title: s.title }));
  return { screens, removed, changedCount };
}

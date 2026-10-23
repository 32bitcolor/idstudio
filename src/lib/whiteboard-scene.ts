// A whiteboard's Excalidraw scene as stored in Whiteboard.scene, and how two copies of it
// merge. Shared by the browser (merging changes it polls for) and the server (merging
// saves and MCP edits), so both apply the same rule: per element, the copy with the
// higher `version` wins; on a tie the lower `versionNonce` wins (Excalidraw's own
// collaboration rule). Deletions are kept as tombstones (`isDeleted`) for a while so a
// stale copy can't bring a deleted element back.

export type SceneElement = {
  id: string;
  type: string;
  version: number;
  versionNonce: number;
  isDeleted?: boolean;
  index?: string | null;
  updated?: number;
  [key: string]: unknown;
};

export type Scene = {
  elements: SceneElement[];
  appState: { viewBackgroundColor?: string };
  files: Record<string, unknown>;
};

const TOMBSTONE_MS = 7 * 24 * 60 * 60 * 1000;

export function emptyScene(): Scene {
  return { elements: [], appState: { viewBackgroundColor: "#ffffff" }, files: {} };
}

/** Tolerant of empty or unparseable scenes. */
export function parseScene(raw: string | null | undefined): Scene {
  if (!raw) return emptyScene();
  try {
    const d = JSON.parse(raw);
    return {
      elements: Array.isArray(d.elements) ? d.elements.filter((e: unknown) => e && typeof (e as SceneElement).id === "string") : [],
      appState: { viewBackgroundColor: d.appState?.viewBackgroundColor ?? "#ffffff" },
      files: d.files && typeof d.files === "object" ? d.files : {},
    };
  } catch {
    return emptyScene();
  }
}

export function serializeScene(scene: Scene): string {
  return JSON.stringify({ type: "excalidraw", version: 2, source: "tavoro", ...scene });
}

function newer(a: SceneElement, b: SceneElement): SceneElement {
  if ((a.version ?? 0) !== (b.version ?? 0)) return (a.version ?? 0) > (b.version ?? 0) ? a : b;
  return (a.versionNonce ?? 0) <= (b.versionNonce ?? 0) ? a : b;
}

/** Fractional indexes sort as plain strings; elements without one keep their order at the end. */
function byIndex(a: SceneElement, b: SceneElement) {
  if (a.index && b.index) return a.index < b.index ? -1 : a.index > b.index ? 1 : a.id < b.id ? -1 : 1;
  return a.index ? -1 : b.index ? 1 : 0;
}

export function mergeElements(ours: readonly SceneElement[], theirs: readonly SceneElement[]): SceneElement[] {
  const out = new Map<string, SceneElement>();
  for (const e of ours) out.set(e.id, e);
  for (const e of theirs) {
    const have = out.get(e.id);
    out.set(e.id, have ? newer(have, e) : e);
  }
  return [...out.values()].sort(byIndex);
}

/** Merge two scenes. `theirs` supplies the background colour; files are pooled and those
 *  no element uses any more are dropped; old tombstones are forgotten. */
export function mergeScenes(ours: Scene, theirs: Scene, now = Date.now()): Scene {
  const elements = mergeElements(ours.elements, theirs.elements).filter(
    (e) => !e.isDeleted || now - (e.updated ?? now) < TOMBSTONE_MS,
  );
  const used = new Set(elements.map((e) => e.fileId).filter((f): f is string => typeof f === "string"));
  const files = Object.fromEntries(Object.entries({ ...ours.files, ...theirs.files }).filter(([id]) => used.has(id)));
  return { elements, appState: { viewBackgroundColor: theirs.appState.viewBackgroundColor ?? ours.appState.viewBackgroundColor }, files };
}

/** Changes whenever any element changes; the browser compares it to skip saving when
 *  only the view moved (Excalidraw reports scrolls and selections as changes too). */
export function sceneSignature(elements: readonly { id: string; version: number }[], background?: string): string {
  let s = background ?? "";
  for (const e of elements) s += `|${e.id}:${e.version}`;
  return s;
}

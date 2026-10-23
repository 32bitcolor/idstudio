import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import dagre from "@dagrejs/dagre";
import { generateNKeysBetween } from "fractional-indexing";
import type { Scene, SceneElement } from "@/lib/whiteboard-scene";

// Whiteboards for assistants (MCP, docs/MCP.md). Excalidraw can't run on the server, so
// this builds its elements directly, in the shape Excalidraw saves them: labels sized,
// wrapped and centred in their shapes, arrows routed edge to edge and bound at both ends.
// Assistants talk in "items" (a box, a note, an arrow from A to B) rather than raw
// elements, and read a whiteboard back the same way.

export class ItemError extends Error {}

// ── Text measurement ──────────────────────────────────────────────────────────
// Excalifont advance widths for ASCII 32–126 at 100px, measured in the browser. Other
// characters count as an average one. Close enough that labels fit; Excalidraw re-measures
// a label when someone edits it.
const WIDTHS = [
  40, 31, 37, 78, 72, 93, 72, 22, 44, 40, 52, 55, 26, 41, 27, 56, 67, 43, 70, 61, 59, 62, 65, 55, 64, 63, 27, 29, 55, 55, 55, 46, 83, 68,
  76, 63, 78, 70, 66, 78, 57, 55, 57, 61, 54, 77, 64, 77, 70, 77, 73, 62, 85, 74, 59, 79, 63, 57, 83, 47, 59, 49, 51, 67, 60, 58, 56, 50,
  61, 54, 50, 55, 56, 25, 33, 54, 22, 66, 53, 60, 54, 55, 42, 55, 56, 55, 53, 68, 59, 53, 57, 51, 30, 54, 67,
];
const EXCALIFONT = 5;
const LINE_HEIGHT = 1.25;
const PADDING = 5; // Excalidraw's BOUND_TEXT_PADDING

function textWidth(s: string, size: number) {
  let w = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    w += c >= 32 && c < 127 ? WIDTHS[c - 32] : 60;
  }
  return (w * size) / 100;
}

/** Greedy word wrap; words longer than a line are broken. */
function wrap(text: string, maxWidth: number, size: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/ +/)) {
      const next = line ? `${line} ${word}` : word;
      if (textWidth(next, size) <= maxWidth || !line) {
        line = next;
      } else {
        out.push(line);
        line = word;
      }
      while (textWidth(line, size) > maxWidth && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && textWidth(line.slice(0, cut), size) > maxWidth) cut--;
        out.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    out.push(line);
  }
  return out;
}

const measure = (lines: string[], size: number) => ({
  width: Math.max(1, ...lines.map((l) => textWidth(l, size))),
  height: lines.length * size * LINE_HEIGHT,
});

// ── Colours ───────────────────────────────────────────────────────────────────
// Excalidraw's own palette: [stroke, fill].
export const COLORS = {
  black: ["#1e1e1e", "transparent"],
  gray: ["#495057", "#e9ecef"],
  red: ["#e03131", "#ffc9c9"],
  pink: ["#c2255c", "#fcc2d7"],
  purple: ["#6741d9", "#d0bfff"],
  blue: ["#1971c2", "#a5d8ff"],
  teal: ["#0c8599", "#96f2d7"],
  green: ["#2f9e44", "#b2f2bb"],
  yellow: ["#f08c00", "#ffec99"],
  orange: ["#e8590c", "#ffd8a8"],
} as const;
export type ColorName = keyof typeof COLORS;
export const COLOR_NAMES = Object.keys(COLORS) as [ColorName, ...ColorName[]];

function colorName(hex: unknown, which: 0 | 1): string | null {
  if (typeof hex !== "string" || hex === "transparent") return null;
  const hit = COLOR_NAMES.find((n) => COLORS[n][which].toLowerCase() === hex.toLowerCase());
  return hit ?? hex;
}

export const SIZES = { small: 16, medium: 20, large: 28, huge: 36 } as const;
export type SizeName = keyof typeof SIZES;

// ── Elements ──────────────────────────────────────────────────────────────────

const newId = () => randomBytes(15).toString("base64url");
const nonce = () => randomInt(1, 2 ** 31 - 1);

function element(type: string, x: number, y: number, width: number, height: number, extra: Record<string, unknown> = {}): SceneElement {
  return {
    id: newId(),
    type,
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: nonce(),
    version: 1,
    versionNonce: nonce(),
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    index: null,
    ...extra,
  };
}

/** Mark an element changed, so it wins the merge against older copies. */
function touch(e: SceneElement) {
  e.version = (e.version ?? 0) + 1;
  e.versionNonce = nonce();
  e.updated = Date.now();
}

type Bound = { id: string; type: string };
const bound = (e: SceneElement) => ((e.boundElements as Bound[] | null) ?? []).slice();
function bind(container: SceneElement, child: SceneElement) {
  container.boundElements = [...bound(container).filter((b) => b.id !== child.id), { id: child.id, type: child.type }];
}

const SHAPES = new Set(["rectangle", "ellipse", "diamond"]);
const isShape = (e: SceneElement) => SHAPES.has(e.type);
const isLinear = (e: SceneElement) => e.type === "arrow" || e.type === "line";
const num = (v: unknown) => (typeof v === "number" ? v : 0);
const center = (e: SceneElement) => ({ x: num(e.x) + num(e.width) / 2, y: num(e.y) + num(e.height) / 2 });

/** How wide a label may be inside its container. */
function labelMaxWidth(c: SceneElement, size: number) {
  const w = num(c.width);
  if (c.type === "ellipse") return w / Math.SQRT2 - PADDING * 2;
  if (c.type === "diamond") return w / 2 - PADDING * 2;
  if (isLinear(c)) return Math.max(size * 11, Math.hypot(num(c.width), num(c.height)) * 0.7);
  return w - PADDING * 2;
}

/** Wrap a container's label to fit, grow the container if the text needs more height,
 *  and centre the label in it (on an arrow: at its middle point). */
function layoutLabel(c: SceneElement, label: SceneElement) {
  const size = num(label.fontSize) || 20;
  const lines = wrap(String(label.originalText ?? label.text ?? ""), Math.max(size, labelMaxWidth(c, size)), size);
  const { width, height } = measure(lines, size);
  label.text = lines.join("\n");
  label.width = width;
  label.height = height;
  if (isLinear(c)) {
    const pts = c.points as [number, number][];
    const mid = pts.length % 2 ? pts[(pts.length - 1) / 2] : [(pts[pts.length / 2 - 1][0] + pts[pts.length / 2][0]) / 2, (pts[pts.length / 2 - 1][1] + pts[pts.length / 2][1]) / 2];
    label.x = num(c.x) + mid[0] - width / 2;
    label.y = num(c.y) + mid[1] - height / 2;
    return;
  }
  const need = c.type === "ellipse" ? height * Math.SQRT2 + PADDING * 2 : c.type === "diamond" ? height * 2 + PADDING * 2 : height + PADDING * 2;
  if (num(c.height) < need) c.height = Math.ceil(need);
  label.x = num(c.x) + (num(c.width) - width) / 2;
  label.y = num(c.y) + (num(c.height) - height) / 2;
}

function makeLabel(c: SceneElement, text: string, size: number, color: string) {
  const label = element("text", 0, 0, 0, 0, {
    text,
    originalText: text,
    fontSize: size,
    fontFamily: EXCALIFONT,
    textAlign: "center",
    verticalAlign: "middle",
    containerId: c.id,
    autoResize: true,
    lineHeight: LINE_HEIGHT,
    strokeColor: color,
    frameId: c.frameId ?? null,
  });
  bind(c, label);
  layoutLabel(c, label);
  return label;
}

/** Where a line from a shape's centre towards `to` leaves the shape, plus a gap. */
function edgePoint(e: SceneElement, to: { x: number; y: number }, gap: number) {
  const c = center(e);
  const dx = to.x - c.x;
  const dy = to.y - c.y;
  const len = Math.hypot(dx, dy) || 1;
  const hw = num(e.width) / 2 || 1;
  const hh = num(e.height) / 2 || 1;
  const s =
    e.type === "ellipse"
      ? 1 / Math.hypot(dx / hw, dy / hh)
      : e.type === "diamond"
        ? 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh)
        : Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
  return { x: c.x + dx * s + (dx / len) * gap, y: c.y + dy * s + (dy / len) * gap };
}

const GAP = 8;

/** Straight arrow between its bound ends (either end may be a fixed point instead). */
function route(a: SceneElement, byId: Map<string, SceneElement>) {
  const pts = (a.points as [number, number][]) ?? [[0, 0], [100, 0]];
  const sb = a.startBinding as { elementId: string } | null;
  const eb = a.endBinding as { elementId: string } | null;
  const from = sb ? byId.get(sb.elementId) : undefined;
  const to = eb ? byId.get(eb.elementId) : undefined;
  if (!from && !to) return;
  const fixedStart = { x: num(a.x) + pts[0][0], y: num(a.y) + pts[0][1] };
  const fixedEnd = { x: num(a.x) + pts[pts.length - 1][0], y: num(a.y) + pts[pts.length - 1][1] };
  const start = from ? edgePoint(from, to ? center(to) : fixedEnd, GAP) : fixedStart;
  const end = to ? edgePoint(to, from ? center(from) : fixedStart, GAP) : fixedEnd;
  a.x = Math.round(start.x);
  a.y = Math.round(start.y);
  const dx = Math.round(end.x - start.x);
  const dy = Math.round(end.y - start.y);
  a.points = [
    [0, 0],
    [dx, dy],
  ];
  a.width = Math.abs(dx);
  a.height = Math.abs(dy);
}

// ── Reading ───────────────────────────────────────────────────────────────────

const KIND: Record<string, string> = { rectangle: "box", ellipse: "ellipse", diamond: "diamond", text: "text", arrow: "arrow", line: "line", frame: "frame", image: "image", freedraw: "drawing", embeddable: "embed" };

export type WhiteboardItem = {
  id: string;
  kind: string;
  text?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  dashed?: true;
  frame?: string;
  from?: string;
  to?: string;
  link?: string;
};

/** The whiteboard as items an assistant can read: shapes with their labels, text, frames,
 *  and arrows with what they connect. Freehand strokes are only counted. */
export function describeScene(scene: Scene) {
  const live = scene.elements.filter((e) => !e.isDeleted);
  const byId = new Map(live.map((e) => [e.id, e]));
  const labelOf = (e: SceneElement) => {
    const b = bound(e).find((x) => x.type === "text");
    const t = b ? byId.get(b.id) : undefined;
    return t ? String(t.originalText ?? t.text ?? "") : undefined;
  };
  const name = (id: string | undefined) => {
    const e = id ? byId.get(id) : undefined;
    return e ? (labelOf(e) ?? (e.type === "text" ? String(e.originalText ?? e.text) : e.type === "frame" ? String(e.name ?? "") : e.id)) : undefined;
  };
  const items: WhiteboardItem[] = [];
  let drawings = 0;
  for (const e of live) {
    if (e.type === "text" && e.containerId && byId.has(String(e.containerId))) continue;
    if (e.type === "freedraw") {
      drawings++;
      continue;
    }
    const item: WhiteboardItem = { id: e.id, kind: KIND[e.type] ?? e.type, x: Math.round(num(e.x)), y: Math.round(num(e.y)), width: Math.round(num(e.width)), height: Math.round(num(e.height)) };
    const text = e.type === "text" ? String(e.originalText ?? e.text ?? "") : e.type === "frame" ? (e.name as string | null) ?? undefined : labelOf(e);
    if (text) item.text = text;
    const color = isShape(e) ? colorName(e.backgroundColor, 1) ?? colorName(e.strokeColor, 0) : colorName(e.strokeColor, 0);
    if (color && color !== "black") item.color = color;
    if (e.strokeStyle === "dashed" || e.strokeStyle === "dotted") item.dashed = true;
    if (e.frameId && byId.has(String(e.frameId))) item.frame = String(e.frameId);
    if (isLinear(e)) {
      const sb = (e.startBinding as { elementId: string } | null)?.elementId;
      const eb = (e.endBinding as { elementId: string } | null)?.elementId;
      if (sb && byId.has(sb)) item.from = sb;
      if (eb && byId.has(eb)) item.to = eb;
    }
    if (typeof e.link === "string" && e.link) item.link = e.link;
    items.push(item);
  }
  const connections = items
    .filter((i) => i.from || i.to)
    .map((i) => `${name(i.from) ?? "(free end)"} ${i.kind === "arrow" ? "→" : "—"} ${name(i.to) ?? "(free end)"}${i.text ? ` [${i.text}]` : ""}`);
  return { items, connections, freehandDrawings: drawings };
}

// ── Adding ────────────────────────────────────────────────────────────────────

export type ItemInput = {
  ref?: string;
  kind: "box" | "ellipse" | "diamond" | "note" | "text" | "frame" | "arrow" | "line";
  text?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color?: ColorName;
  size?: SizeName;
  dashed?: boolean;
  frame?: string;
  from?: string;
  to?: string;
  points?: [number, number][];
};

const DEFAULT_SIZE: Record<string, [number, number]> = {
  box: [200, 90],
  ellipse: [200, 110],
  diamond: [200, 130],
  note: [200, 150],
  frame: [800, 500],
};
// How much wider than its text a shape must be for the text to fit inside it.
const SHAPE_FACTOR: Record<string, number> = { rectangle: 1, ellipse: Math.SQRT2, diamond: 2 };
const ROW_WIDTH = 1400;
const SPACING = 60;

function bounds(els: SceneElement[]) {
  if (!els.length) return null;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const e of els) {
    x1 = Math.min(x1, num(e.x));
    y1 = Math.min(y1, num(e.y));
    x2 = Math.max(x2, num(e.x) + num(e.width));
    y2 = Math.max(y2, num(e.y) + num(e.height));
  }
  return { x1, y1, x2, y2 };
}

/** Lays items without a position out in rows: below everything on the board, or inside
 *  their frame below what's already in it (growing the frame to fit). */
class Placer {
  private rows = new Map<string, { x0: number; maxX: number; x: number; y: number; rowH: number }>();
  constructor(
    private els: SceneElement[],
    private added: SceneElement[],
  ) {}
  place(w: number, h: number, frame?: SceneElement) {
    const key = frame?.id ?? "";
    let r = this.rows.get(key);
    if (!r) {
      const live = [...this.els, ...this.added].filter((e) => !e.isDeleted && (frame ? e.frameId === frame.id : true) && !(e.type === "text" && e.containerId));
      const b = bounds(live);
      r = frame
        ? { x0: num(frame.x) + SPACING, maxX: num(frame.x) + num(frame.width) - SPACING, x: num(frame.x) + SPACING, y: b ? b.y2 + SPACING : num(frame.y) + SPACING + 20, rowH: 0 }
        : { x0: b ? b.x1 : 0, maxX: (b ? b.x1 : 0) + ROW_WIDTH, x: b ? b.x1 : 0, y: b ? b.y2 + 80 : 0, rowH: 0 };
      this.rows.set(key, r);
    }
    if (r.x > r.x0 && r.x + w > r.maxX) {
      r.x = r.x0;
      r.y += r.rowH + SPACING;
      r.rowH = 0;
    }
    const at = { x: r.x, y: r.y };
    r.x += w + SPACING;
    r.rowH = Math.max(r.rowH, h);
    if (frame) {
      frame.height = Math.max(num(frame.height), at.y + h + SPACING - num(frame.y));
      frame.width = Math.max(num(frame.width), at.x + w + SPACING - num(frame.x));
    }
    return at;
  }
}

function assignIndexes(existing: SceneElement[], added: SceneElement[]) {
  const valid = existing.map((e) => e.index).filter((i): i is string => typeof i === "string" && /^[a-zA-Z][0-9a-zA-Z]*$/.test(i));
  const max = valid.length ? valid.reduce((a, b) => (a > b ? a : b)) : null;
  try {
    const keys = generateNKeysBetween(max, null, added.length);
    added.forEach((e, i) => (e.index = keys[i]));
  } catch {
    // Excalidraw fixes missing indexes when it loads the scene.
  }
}

/** Add items to a scene. `ref`s name new items so arrows in the same call can connect
 *  them; arrows can also connect to existing elements by id. */
export function addItems(scene: Scene, items: ItemInput[]): { scene: Scene; added: { ref?: string; id: string; kind: string }[] } {
  const els = scene.elements.map((e) => ({ ...e }));
  const byId = new Map(els.filter((e) => !e.isDeleted).map((e) => [e.id, e]));
  const refs = new Map<string, SceneElement>();
  const resolve = (r: string | undefined, what: string) => {
    if (!r) return undefined;
    const hit = refs.get(r) ?? byId.get(r);
    if (!hit) throw new ItemError(`${what} "${r}" isn't on this whiteboard or earlier in this call${what === "Frame" ? " (list a frame before the items in it)" : ""}.`);
    return hit;
  };
  const added: SceneElement[] = [];
  const placer = new Placer(els, added);
  const out: { ref?: string; id: string; kind: string }[] = [];
  const push = (...e: SceneElement[]) => {
    for (const x of e) {
      added.push(x);
      byId.set(x.id, x);
    }
  };

  // In the order given (a frame before what goes in it), then arrows, which need both ends.
  const linear = (i: ItemInput) => i.kind === "arrow" || i.kind === "line";
  const order = [...items.filter((i) => !linear(i)), ...items.filter(linear)];
  for (const it of order) {
    if (it.ref && refs.has(it.ref)) throw new ItemError(`ref "${it.ref}" is used twice.`);
    const [stroke, fill] = COLORS[it.color ?? (it.kind === "note" ? "yellow" : "black")];
    const size = SIZES[it.size ?? "medium"];
    const frame = it.kind === "frame" ? undefined : resolve(it.frame, "Frame");
    if (frame && frame.type !== "frame") throw new ItemError(`"${it.frame}" isn't a frame.`);
    const dashed = it.dashed ? { strokeStyle: "dashed" } : {};
    let el: SceneElement;

    if (it.kind === "arrow" || it.kind === "line") {
      const from = resolve(it.from, "from");
      const to = resolve(it.to, "to");
      const pts = it.points?.length && it.points.length >= 2 ? it.points : null;
      if (!pts && !(from && to)) throw new ItemError(`An ${it.kind} needs from and to (refs or ids), or at least two points.`);
      const x0 = pts ? pts[0][0] : 0;
      const y0 = pts ? pts[0][1] : 0;
      el = element(it.kind, x0, y0, 0, 0, {
        strokeColor: stroke,
        points: pts ? pts.map(([x, y]) => [x - x0, y - y0]) : [[0, 0], [1, 0]],
        lastCommittedPoint: null,
        startBinding: from ? { elementId: from.id, focus: 0, gap: GAP } : null,
        endBinding: to ? { elementId: to.id, focus: 0, gap: GAP } : null,
        startArrowhead: null,
        endArrowhead: it.kind === "arrow" ? "arrow" : null,
        elbowed: false,
        roundness: { type: 2 },
        frameId: frame?.id ?? null,
        ...dashed,
      });
      if (pts) {
        const xs = pts.map((p) => p[0]);
        const ys = pts.map((p) => p[1]);
        el.width = Math.max(...xs) - Math.min(...xs);
        el.height = Math.max(...ys) - Math.min(...ys);
      }
      if (from && pts) el.startBinding = null; // explicit points win
      if (to && pts) el.endBinding = null;
      route(el, byId);
      for (const end of [from, to]) if (end && !pts) bind(end, el);
      push(el);
      if (it.text) push(makeLabel(el, it.text, SIZES[it.size ?? "small"], stroke));
    } else if (it.kind === "text") {
      if (!it.text) throw new ItemError("A text item needs text.");
      const lines = it.width ? wrap(it.text, it.width, size) : it.text.split("\n");
      const m = measure(lines, size);
      const at = it.x != null && it.y != null ? { x: it.x, y: it.y } : placer.place(m.width, m.height, frame);
      el = element("text", at.x, at.y, m.width, m.height, {
        text: lines.join("\n"),
        originalText: it.text,
        fontSize: size,
        fontFamily: EXCALIFONT,
        textAlign: "left",
        verticalAlign: "top",
        containerId: null,
        autoResize: !it.width,
        lineHeight: LINE_HEIGHT,
        strokeColor: stroke,
        frameId: frame?.id ?? null,
      });
      push(el);
    } else if (it.kind === "frame") {
      const [dw, dh] = DEFAULT_SIZE.frame;
      const w = it.width ?? dw;
      const h = it.height ?? dh;
      const at = it.x != null && it.y != null ? { x: it.x, y: it.y } : placer.place(w, h);
      el = element("frame", at.x, at.y, w, h, { name: it.text ?? null, strokeWidth: 2, roughness: 0 });
      push(el);
    } else {
      const type = it.kind === "note" || it.kind === "box" ? "rectangle" : it.kind;
      const [dw, dh] = DEFAULT_SIZE[it.kind];
      let w = it.width ?? dw;
      // Grow a default-width shape for a long one-line label rather than wrapping it tall.
      if (!it.width && it.text) w = Math.min(320, Math.max(w, (textWidth(it.text, size) + PADDING * 2 + 24) * SHAPE_FACTOR[type]));
      el = element(type, 0, 0, w, it.height ?? dh, {
        strokeColor: it.color ? stroke : "#1e1e1e",
        backgroundColor: fill,
        roundness: type === "rectangle" ? { type: 3 } : { type: 2 },
        frameId: frame?.id ?? null,
        ...(it.kind === "note" ? { roughness: 0, strokeWidth: 1 } : {}),
        ...dashed,
      });
      const label = it.text ? makeLabel(el, it.text, size, "#1e1e1e") : null; // may grow el.height
      const at = it.x != null && it.y != null ? { x: it.x, y: it.y } : placer.place(num(el.width), num(el.height), frame);
      el.x = Math.round(at.x);
      el.y = Math.round(at.y);
      push(el);
      if (label) {
        layoutLabel(el, label);
        push(label);
      }
    }
    if (it.ref) refs.set(it.ref, el);
    out.push({ ...(it.ref ? { ref: it.ref } : {}), id: el.id, kind: it.kind });
  }

  // Arrows were routed against shapes that may since have moved into place.
  for (const a of added.filter(isLinear)) {
    route(a, byId);
    const lb = bound(a).find((b) => b.type === "text");
    const label = lb ? byId.get(lb.id) : undefined;
    if (label) layoutLabel(a, label);
  }
  assignIndexes(els, added);
  return { scene: { ...scene, elements: [...els, ...added] }, added: out };
}

// ── Changing ──────────────────────────────────────────────────────────────────

export type ItemChange = {
  id: string;
  text?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color?: ColorName;
  dashed?: boolean;
  delete?: boolean;
};

/** Move, resize, relabel, recolour or delete items by id. Moving a shape takes its label
 *  along and re-routes arrows attached to it; moving a frame moves what's in it. */
export function changeItems(scene: Scene, changes: ItemChange[]): { scene: Scene; changed: string[]; deleted: string[] } {
  const els = scene.elements.map((e) => ({ ...e }));
  const byId = new Map(els.filter((e) => !e.isDeleted).map((e) => [e.id, e]));
  const dirty = new Set<SceneElement>();
  const labelOf = (e: SceneElement) => {
    const b = bound(e).find((x) => x.type === "text");
    return b ? byId.get(b.id) : undefined;
  };
  const changed: string[] = [];
  const deleted: string[] = [];
  const reroute = new Set<SceneElement>();
  const arrowsAt = (e: SceneElement) => bound(e).filter((b) => b.type === "arrow").map((b) => byId.get(b.id)).filter((a): a is SceneElement => !!a);
  const shift = (e: SceneElement, dx: number, dy: number) => {
    e.x = num(e.x) + dx;
    e.y = num(e.y) + dy;
    dirty.add(e);
    const l = labelOf(e);
    if (l) {
      l.x = num(l.x) + dx;
      l.y = num(l.y) + dy;
      dirty.add(l);
    }
    for (const a of arrowsAt(e)) reroute.add(a);
  };

  for (const ch of changes) {
    const e = byId.get(ch.id);
    if (!e || (e.type === "text" && e.containerId && byId.has(String(e.containerId)))) {
      throw new ItemError(`No item "${ch.id}" on this whiteboard. Use the ids from get_whiteboard.`);
    }
    if (ch.delete) {
      const gone = [e, ...(labelOf(e) ? [labelOf(e)!] : [])];
      for (const g of gone) {
        g.isDeleted = true;
        dirty.add(g);
      }
      // Arrows stay but come loose; a deleted arrow lets go of its shapes.
      for (const a of arrowsAt(e)) {
        if ((a.startBinding as { elementId: string } | null)?.elementId === e.id) a.startBinding = null;
        if ((a.endBinding as { elementId: string } | null)?.elementId === e.id) a.endBinding = null;
        dirty.add(a);
      }
      if (isLinear(e)) {
        for (const b of [e.startBinding, e.endBinding] as ({ elementId: string } | null)[]) {
          const s = b ? byId.get(b.elementId) : undefined;
          if (s) {
            s.boundElements = bound(s).filter((x) => x.id !== e.id);
            dirty.add(s);
          }
        }
      }
      if (e.type === "frame") for (const c of els) if (c.frameId === e.id) { c.frameId = null; dirty.add(c); }
      deleted.push(e.id);
      continue;
    }

    if (ch.x != null || ch.y != null) {
      if (isLinear(e) && (e.startBinding || e.endBinding)) throw new ItemError(`Arrow "${e.id}" follows the shapes it connects; move those instead.`);
      const dx = (ch.x ?? num(e.x)) - num(e.x);
      const dy = (ch.y ?? num(e.y)) - num(e.y);
      shift(e, dx, dy);
      if (e.type === "frame") for (const c of els) if (c.frameId === e.id && !c.isDeleted && !(c.type === "text" && c.containerId)) shift(c, dx, dy);
    }
    if (ch.width != null || ch.height != null) {
      if (isLinear(e)) throw new ItemError("Arrows and lines can't be resized; move what they connect.");
      if (ch.width != null) e.width = ch.width;
      if (ch.height != null) e.height = ch.height;
      dirty.add(e);
      for (const a of arrowsAt(e)) reroute.add(a);
    }
    if (ch.color) {
      const [stroke, fill] = COLORS[ch.color];
      if (isShape(e)) {
        e.backgroundColor = fill;
        e.strokeColor = ch.color === "black" ? "#1e1e1e" : stroke;
      } else e.strokeColor = stroke;
      dirty.add(e);
    }
    if (ch.dashed != null && e.type !== "text") {
      e.strokeStyle = ch.dashed ? "dashed" : "solid";
      dirty.add(e);
    }
    if (ch.text != null) {
      if (e.type === "frame") e.name = ch.text || null;
      else if (e.type === "text") {
        const size = num(e.fontSize) || 20;
        const lines = e.autoResize === false ? wrap(ch.text, num(e.width), size) : ch.text.split("\n");
        const m = measure(lines, size);
        Object.assign(e, { text: lines.join("\n"), originalText: ch.text, height: m.height, ...(e.autoResize === false ? {} : { width: m.width }) });
      } else {
        const l = labelOf(e);
        if (l && !ch.text) {
          l.isDeleted = true;
          e.boundElements = bound(e).filter((b) => b.id !== l.id);
          dirty.add(l);
        } else if (l) {
          l.originalText = ch.text;
          dirty.add(l);
        } else if (ch.text) {
          const label = makeLabel(e, ch.text, isLinear(e) ? SIZES.small : SIZES.medium, isLinear(e) ? String(e.strokeColor) : "#1e1e1e");
          assignIndexes(els, [label]);
          els.push(label);
          byId.set(label.id, label);
        }
      }
      dirty.add(e);
    }
    changed.push(e.id);
  }

  for (const a of reroute) {
    route(a, byId);
    dirty.add(a);
  }
  // Re-fit labels of everything that moved, resized or was relabelled.
  for (const e of [...dirty]) {
    const l = labelOf(e);
    if (l && !l.isDeleted && !e.isDeleted) {
      layoutLabel(e, l);
      dirty.add(l);
    }
  }
  for (const e of dirty) touch(e);
  return { scene: { ...scene, elements: els }, changed, deleted };
}

// ── Diagrams ──────────────────────────────────────────────────────────────────

export type DiagramInput = {
  nodes: { id: string; text: string; shape?: "box" | "ellipse" | "diamond" | "note"; color?: ColorName }[];
  edges: { from: string; to: string; text?: string; dashed?: boolean }[];
  direction?: "down" | "right";
  x?: number;
  y?: number;
  frame?: string;
  title?: string;
};

/** Lay a flowchart out (dagre) and turn it into items for addItems. With a title, the
 *  diagram goes inside a new frame of that name. */
export function diagramItems(scene: Scene, d: DiagramInput): ItemInput[] {
  const ids = new Set<string>();
  for (const n of d.nodes) {
    if (ids.has(n.id)) throw new ItemError(`Node id "${n.id}" is used twice.`);
    ids.add(n.id);
  }
  for (const e of d.edges) {
    if (!ids.has(e.from) || !ids.has(e.to)) throw new ItemError(`Edge ${e.from} → ${e.to} names a node that isn't in nodes.`);
  }
  const size = SIZES.medium;
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: d.direction === "right" ? "LR" : "TB", nodesep: 50, ranksep: 80, marginx: 0, marginy: 0 });
  g.setDefaultEdgeLabel(() => ({}));
  const dims = new Map<string, [number, number]>();
  for (const n of d.nodes) {
    const shape = n.shape ?? "box";
    const factor = SHAPE_FACTOR[shape === "box" || shape === "note" ? "rectangle" : shape];
    const lines = wrap(n.text, 200, size);
    const m = measure(lines, size);
    const w = Math.max(160, Math.min(320, (m.width + PADDING * 2 + 24) * factor));
    const h = Math.max(shape === "diamond" ? 110 : 70, (m.height + PADDING * 2 + 24) * factor);
    dims.set(n.id, [Math.round(w), Math.round(h)]);
    g.setNode(n.id, { width: w, height: h });
  }
  for (const e of d.edges) g.setEdge(e.from, e.to, e.text ? { width: textWidth(e.text, SIZES.small) + 10, height: 24, labelpos: "c" } : {});
  dagre.layout(g);

  const frameItems: ItemInput[] = [];
  let origin: { x: number; y: number };
  const graph = g.graph();
  const gw = graph.width ?? 0;
  const gh = graph.height ?? 0;
  if (d.x != null && d.y != null) origin = { x: d.x, y: d.y };
  else {
    const frame = d.frame ? scene.elements.find((e) => e.id === d.frame && !e.isDeleted) : undefined;
    if (d.frame && !frame) throw new ItemError(`Frame "${d.frame}" isn't on this whiteboard.`);
    const b = bounds(scene.elements.filter((e) => !e.isDeleted && (frame ? e.frameId === frame.id : true) && !(e.type === "text" && e.containerId)));
    origin = frame ? { x: num(frame.x) + SPACING, y: b ? b.y2 + SPACING : num(frame.y) + SPACING + 20 } : { x: b ? b.x1 : 0, y: b ? b.y2 + 80 : 0 };
  }
  let frameRef = d.frame;
  if (d.title) {
    frameRef = "__diagram_frame";
    frameItems.push({ ref: frameRef, kind: "frame", text: d.title, x: origin.x, y: origin.y, width: Math.round(gw + SPACING * 2), height: Math.round(gh + SPACING * 2 + 20) });
    origin = { x: origin.x + SPACING, y: origin.y + SPACING + 20 };
  }
  const nodes: ItemInput[] = d.nodes.map((n) => {
    const p = g.node(n.id);
    const [w, h] = dims.get(n.id)!;
    return { ref: `node:${n.id}`, kind: n.shape ?? "box", text: n.text, color: n.color, x: Math.round(origin.x + p.x - w / 2), y: Math.round(origin.y + p.y - h / 2), width: w, height: h, frame: frameRef };
  });
  const edges: ItemInput[] = d.edges.map((e) => ({ kind: "arrow", from: `node:${e.from}`, to: `node:${e.to}`, text: e.text, dashed: e.dashed, frame: frameRef }));
  return [...frameItems, ...nodes, ...edges];
}

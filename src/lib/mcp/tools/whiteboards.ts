import "server-only";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { prisma } from "@/lib/db";
import { getCardForUser, getStoryboardForUser, getWhiteboardForUser, whiteboardVisibilityWhere } from "@/lib/authz";
import { renameWhiteboard } from "@/app/actions/whiteboards";
import { commitScene, loadScene, SceneTooLarge } from "@/lib/whiteboard-store";
import {
  addItems,
  changeItems,
  COLOR_NAMES,
  describeScene,
  diagramItems,
  ItemError,
  SIZES,
  type ItemInput,
} from "@/lib/whiteboard-elements";
import type { Scene } from "@/lib/whiteboard-scene";
import { check, iso, link, principal, resolveCardId, tool, ToolError } from "@/lib/mcp/util";

// Whiteboards (Excalidraw) as items: shapes with labels, notes, text, frames and arrows.
// Writes merge into the stored scene (lib/whiteboard-store.ts), so they show up on an
// open whiteboard within seconds and nobody's drawing is overwritten.

const whiteboardRef = z.string().min(1).describe("Whiteboard id (from list_whiteboards)");
const color = z.enum(COLOR_NAMES).describe("Excalidraw palette colour; shapes are filled with its light shade");
const size = z.enum(Object.keys(SIZES) as [keyof typeof SIZES, ...(keyof typeof SIZES)[]]).describe("Text size: small 16, medium 20 (default), large 28, huge 36");

const itemInput = z.object({
  ref: z.string().max(60).optional().describe("Your name for this item, so arrows later in the same call can connect to it"),
  kind: z.enum(["box", "ellipse", "diamond", "note", "text", "frame", "arrow", "line"]).describe("note = a sticky note (yellow unless coloured); frame = a named area that holds other items"),
  text: z.string().max(5000).optional().describe("The label inside a shape, the text of a text item, a frame's name, or an arrow's label"),
  x: z.number().optional().describe("Left edge. Leave x and y out to place it automatically below what's there (or inside its frame)"),
  y: z.number().optional().describe("Top edge"),
  width: z.number().positive().max(5000).optional(),
  height: z.number().positive().max(5000).optional(),
  color: color.optional(),
  size: size.optional(),
  dashed: z.boolean().optional(),
  frame: z.string().optional().describe("Put it in this frame: the ref of a frame listed earlier in this call, or a frame's id"),
  from: z.string().optional().describe("Arrows and lines: the ref or id of the item it starts at"),
  to: z.string().optional().describe("Arrows and lines: the ref or id of the item it points to"),
  points: z.array(z.tuple([z.number(), z.number()])).min(2).max(50).optional().describe("Arrows and lines not attached to items: absolute [x, y] points"),
});

const keyOf = (prefix: string | null | undefined, seq: number | null) => (prefix && seq != null ? `${prefix}-${seq}` : null);

async function access(id: string) {
  const wb = await getWhiteboardForUser(id);
  if (!wb) throw new ToolError("Whiteboard not found, or you can't see it.");
  return wb;
}

/** Apply a change to the scene; item mistakes come back to the model as tool errors. */
async function edit<T>(id: string, change: (scene: Scene) => { scene: Scene } & T): Promise<T & { version: number }> {
  let result: T | undefined;
  try {
    const res = await commitScene(id, (current) => {
      const { scene, ...rest } = change(current);
      result = rest as T;
      return scene;
    });
    return { ...(result as T), version: res.version };
  } catch (e) {
    if (e instanceof ItemError) throw new ToolError(e.message);
    if (e instanceof SceneTooLarge) throw new ToolError("That would make the whiteboard too large.");
    throw e;
  }
}

export async function loadWhiteboard(id: string) {
  await access(id);
  const wb = await prisma.whiteboard.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      createdBy: { select: { name: true, email: true } },
      storyboard: { select: { id: true, title: true } },
      card: { select: { id: true, title: true, keySeq: true, column: { select: { board: { select: { cardKeyPrefix: true } } } } } },
    },
  });
  const { scene } = (await loadScene(id))!;
  return {
    id: wb.id,
    title: wb.title,
    url: link(`/whiteboards/${wb.id}`),
    updatedAt: iso(wb.updatedAt),
    owner: wb.createdBy ? (wb.createdBy.name ?? wb.createdBy.email) : null,
    storyboard: wb.storyboard,
    card: wb.card
      ? { id: wb.card.id, title: wb.card.title, key: keyOf(wb.card.column?.board.cardKeyPrefix, wb.card.keySeq) }
      : null,
    ...describeScene(scene),
  };
}

export function registerWhiteboardTools(server: McpServer) {
  tool(
    server,
    "list_whiteboards",
    {
      title: "List whiteboards",
      description: "Whiteboards in the workspace you can see, most recently changed first, with what each is linked to.",
      kind: "read",
      input: { query: z.string().optional().describe("Only titles containing this") },
    },
    async ({ query }) => {
      const rows = await prisma.whiteboard.findMany({
        where: {
          workspaceId: principal().workspaceId,
          ...(query ? { title: { contains: query, mode: "insensitive" as const } } : {}),
          ...(await whiteboardVisibilityWhere()),
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
        select: { id: true, title: true, updatedAt: true, storyboard: { select: { id: true, title: true } }, card: { select: { id: true, title: true } } },
      });
      return { whiteboards: rows.map((w) => ({ ...w, updatedAt: iso(w.updatedAt), url: link(`/whiteboards/${w.id}`) })) };
    },
  );

  tool(
    server,
    "get_whiteboard",
    {
      title: "Get whiteboard",
      description:
        "A whiteboard's contents as items (id, kind, text, position, size, colour, frame), arrows with the ids they connect (from/to), and the connections spelled out by label. Coordinates are canvas pixels; y grows downward. Freehand drawings are counted, not described; images are listed without their content.",
      kind: "read",
      input: { whiteboard: whiteboardRef },
    },
    async ({ whiteboard }) => loadWhiteboard(whiteboard),
  );

  tool(
    server,
    "create_whiteboard",
    {
      title: "Create whiteboard",
      description: "Create an empty whiteboard, optionally linked to a card or a storyboard. Add to it with add_to_whiteboard or add_diagram.",
      kind: "write",
      input: {
        title: z.string().trim().min(1).max(180),
        card: z.string().optional().describe("Link it to this card (id or key such as SEC-12)"),
        storyboard: z.string().optional().describe("Link it to this storyboard (id)"),
      },
    },
    async ({ title, card, storyboard }) => {
      const p = principal();
      let cardId: string | null = null;
      if (card) {
        cardId = await resolveCardId(card);
        const c = await getCardForUser(cardId);
        const board = c ? await prisma.board.findUnique({ where: { id: c.boardId }, select: { workspaceId: true } }) : null;
        if (!c || board?.workspaceId !== p.workspaceId) throw new ToolError("Card not found, or you can't see it.");
      }
      if (storyboard) {
        const sb = await getStoryboardForUser(storyboard);
        if (!sb || sb.workspaceId !== p.workspaceId) throw new ToolError("Storyboard not found, or you can't see it.");
      }
      const wb = await prisma.whiteboard.create({
        data: { workspaceId: p.workspaceId, createdById: p.userId, title, cardId, storyboardId: storyboard ?? null },
        select: { id: true },
      });
      return { id: wb.id, url: link(`/whiteboards/${wb.id}`) };
    },
  );

  tool(
    server,
    "add_to_whiteboard",
    {
      title: "Add to whiteboard",
      description:
        "Add shapes, sticky notes, text, frames and arrows. Labels are sized to fit and shapes grow to hold them. Give items a ref to connect them with arrows in the same call (from/to), or connect to existing items by id. Items without x and y are laid out in rows below what's there (or inside their frame). For a flowchart or process, add_diagram lays it out for you. Shows up on open copies of the whiteboard within a few seconds.",
      kind: "write",
      input: { whiteboard: whiteboardRef, items: z.array(itemInput).min(1).max(200) },
    },
    async ({ whiteboard, items }) => {
      await access(whiteboard);
      const res = await edit(whiteboard, (scene) => addItems(scene, items as ItemInput[]));
      return { added: res.added, url: link(`/whiteboards/${whiteboard}`) };
    },
  );

  tool(
    server,
    "add_diagram",
    {
      title: "Add diagram",
      description:
        "Add a laid-out flowchart: nodes (boxes, ellipses, diamonds for decisions, notes) and arrows between them, arranged automatically top-down or left-to-right. Good for learner journeys, branching scenarios, process maps, course structures. With a title it goes inside a new frame of that name. Placed below what's on the whiteboard unless x/y or a frame is given.",
      kind: "write",
      input: {
        whiteboard: whiteboardRef,
        nodes: z
          .array(
            z.object({
              id: z.string().min(1).max(60).describe("Your id for the node, used by edges"),
              text: z.string().min(1).max(500),
              shape: z.enum(["box", "ellipse", "diamond", "note"]).optional().describe("box (default); diamond for a decision; ellipse for start/end"),
              color: color.optional(),
            }),
          )
          .min(1)
          .max(100),
        edges: z
          .array(z.object({ from: z.string(), to: z.string(), text: z.string().max(200).optional().describe("Label on the arrow, e.g. Yes / No"), dashed: z.boolean().optional() }))
          .max(200)
          .default([]),
        direction: z.enum(["down", "right"]).optional().describe("down (default) or right"),
        title: z.string().max(180).optional().describe("Put the diagram in a new frame with this name"),
        frame: z.string().optional().describe("Or place it inside this existing frame (id)"),
        x: z.number().optional(),
        y: z.number().optional(),
      },
    },
    async ({ whiteboard, ...d }) => {
      await access(whiteboard);
      const res = await edit(whiteboard, (scene) => addItems(scene, diagramItems(scene, d)));
      const nodes = Object.fromEntries(res.added.filter((a) => a.ref?.startsWith("node:")).map((a) => [a.ref!.slice(5), a.id]));
      const frame = res.added.find((a) => a.kind === "frame")?.id;
      return { nodes, ...(frame ? { frame } : {}), arrows: res.added.filter((a) => a.kind === "arrow").length, url: link(`/whiteboards/${whiteboard}`) };
    },
  );

  tool(
    server,
    "update_whiteboard",
    {
      title: "Update whiteboard",
      description:
        "Rename the whiteboard, and/or change items by the ids from get_whiteboard: move (x, y), resize, relabel (text; empty removes a shape's label), recolour, dash, or delete. Moving a shape takes its label and re-routes its arrows; moving a frame moves what's in it. Deleting a shape leaves its arrows unattached. Ask the user before deleting things they drew.",
      kind: "write",
      input: {
        whiteboard: whiteboardRef,
        title: z.string().trim().min(1).max(180).optional(),
        changes: z
          .array(
            z.object({
              id: z.string(),
              text: z.string().max(5000).optional(),
              x: z.number().optional(),
              y: z.number().optional(),
              width: z.number().positive().max(5000).optional(),
              height: z.number().positive().max(5000).optional(),
              color: color.optional(),
              dashed: z.boolean().optional(),
              delete: z.boolean().optional(),
            }),
          )
          .max(200)
          .optional(),
      },
    },
    async ({ whiteboard, title, changes }) => {
      await access(whiteboard);
      if (title) check(await renameWhiteboard(whiteboard, title));
      if (!changes?.length) return { renamed: !!title };
      const res = await edit(whiteboard, (scene) => changeItems(scene, changes));
      return { changed: res.changed, deleted: res.deleted, url: link(`/whiteboards/${whiteboard}`) };
    },
  );
}

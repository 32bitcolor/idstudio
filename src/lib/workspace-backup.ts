import "server-only";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/db";
import { getObjectBytes, putObjectBytes, buildObjectKey } from "@/lib/storage";

// Full logical backup of a single workspace: the entire content graph plus its
// members (by email) and attachment media. Restore recreates it as a NEW
// workspace with freshly-generated ids (every foreign key remapped), so a backup
// can be restored into the same instance (a copy) or a fresh one (disaster
// recovery). Media re-uploads to object storage under new keys.

export const BACKUP_FORMAT = 3; // bump when the shape changes

const WS = "__ws";
const USER = "__user";

type Spec = {
  key: string | null; // entity id-map key; null = junction table (no own id)
  model: string; // prisma delegate name
  where: (wsId: string) => any; // export filter scoping the table to the workspace
  fks: Record<string, string>; // column -> map key (an entity key, WS, or USER)
  sort?: (rows: any[]) => any[]; // reorder before import, for self-referential fks
};

// A card's column is null when it's a subtask — reach it via its parent's
// column instead, same one-hop pattern as getCardForUser in authz.ts.
function cardInWorkspace(w: string): any {
  return {
    OR: [
      { column: { board: { workspaceId: w } } },
      { parentCard: { column: { board: { workspaceId: w } } } },
    ],
  };
}

// Ordered by foreign-key dependency so parents exist before children on restore.
const SPECS: Spec[] = [
  { key: "group", model: "group", where: (w) => ({ workspaceId: w }), fks: { workspaceId: WS } },
  { key: "board", model: "board", where: (w) => ({ workspaceId: w }), fks: { workspaceId: WS } },
  { key: "column", model: "column", where: (w) => ({ board: { workspaceId: w } }), fks: { boardId: "board" } },
  // A subtask is a Card with columnId null and parentCardId set — the OR clause
  // pulls both top-level cards (via their column) and subtask-cards (via their
  // parent's column) into the same export bucket. On import, self-referential
  // parentCardId can only remap once the parent row already exists, so `sort`
  // puts top-level cards (parentCardId null) before subtask-cards.
  {
    key: "card",
    model: "card",
    where: cardInWorkspace,
    fks: { columnId: "column", parentCardId: "card" },
    sort: (rows) => [...rows].sort((a, b) => (a.parentCardId ? 1 : 0) - (b.parentCardId ? 1 : 0)),
  },
  { key: "label", model: "label", where: (w) => ({ board: { workspaceId: w } }), fks: { boardId: "board" } },
  { key: "project", model: "project", where: (w) => ({ workspaceId: w }), fks: { workspaceId: WS } },
  { key: "phase", model: "phase", where: (w) => ({ project: { workspaceId: w } }), fks: { projectId: "project" } },
  { key: "deliverable", model: "deliverable", where: (w) => ({ project: { workspaceId: w } }), fks: { projectId: "project", phaseId: "phase", cardId: "card" } },
  { key: "milestone", model: "milestone", where: (w) => ({ project: { workspaceId: w } }), fks: { projectId: "project" } },
  { key: "learningObjective", model: "learningObjective", where: (w) => ({ project: { workspaceId: w } }), fks: { projectId: "project" } },
  { key: "assessmentItem", model: "assessmentItem", where: (w) => ({ project: { workspaceId: w } }), fks: { projectId: "project" } },
  { key: "storyboard", model: "storyboard", where: (w) => ({ workspaceId: w }), fks: { workspaceId: WS, deliverableId: "deliverable" } },
  { key: "screen", model: "screen", where: (w) => ({ storyboard: { workspaceId: w } }), fks: { storyboardId: "storyboard" } },
  { key: "course", model: "course", where: (w) => ({ workspaceId: w }), fks: { workspaceId: WS, deliverableId: "deliverable" } },
  { key: "lesson", model: "lesson", where: (w) => ({ course: { workspaceId: w } }), fks: { courseId: "course" } },
  { key: "block", model: "block", where: (w) => ({ lesson: { course: { workspaceId: w } } }), fks: { lessonId: "lesson" } },
  { key: "whiteboard", model: "whiteboard", where: (w) => ({ workspaceId: w }), fks: { workspaceId: WS, storyboardId: "storyboard", cardId: "card", createdById: USER } },
  { key: "reviewCycle", model: "reviewCycle", where: (w) => ({ deliverable: { project: { workspaceId: w } } }), fks: { deliverableId: "deliverable", reviewerId: USER, requestedById: USER } },
  { key: "timeEntry", model: "timeEntry", where: (w) => ({ project: { workspaceId: w } }), fks: { projectId: "project", deliverableId: "deliverable", userId: USER } },
  { key: "comment", model: "comment", where: (w) => ({ card: cardInWorkspace(w) }), fks: { cardId: "card", authorId: USER } },
  // junctions
  { key: null, model: "cardLabel", where: (w) => ({ card: cardInWorkspace(w) }), fks: { cardId: "card", labelId: "label" } },
  { key: null, model: "cardAssignee", where: (w) => ({ card: cardInWorkspace(w) }), fks: { cardId: "card", userId: USER } },
  { key: null, model: "boardGroup", where: (w) => ({ board: { workspaceId: w } }), fks: { boardId: "board", groupId: "group" } },
  { key: null, model: "projectGroup", where: (w) => ({ project: { workspaceId: w } }), fks: { projectId: "project", groupId: "group" } },
  { key: null, model: "storyboardGroup", where: (w) => ({ storyboard: { workspaceId: w } }), fks: { storyboardId: "storyboard", groupId: "group" } },
  { key: null, model: "whiteboardGroup", where: (w) => ({ whiteboard: { workspaceId: w } }), fks: { whiteboardId: "whiteboard", groupId: "group" } },
  { key: null, model: "courseGroup", where: (w) => ({ course: { workspaceId: w } }), fks: { courseId: "course", groupId: "group" } },
  { key: null, model: "screenObjective", where: (w) => ({ objective: { project: { workspaceId: w } } }), fks: { screenId: "screen", objectiveId: "learningObjective" } },
  { key: null, model: "assessmentItemObjective", where: (w) => ({ objective: { project: { workspaceId: w } } }), fks: { itemId: "assessmentItem", objectiveId: "learningObjective" } },
  { key: null, model: "groupMembership", where: (w) => ({ group: { workspaceId: w } }), fks: { groupId: "group", userId: USER } },
];

export type WorkspaceExport = {
  format: number;
  exportedAt: string;
  workspace: { name: string; slug: string };
  users: { id: string; email: string; name: string | null }[];
  members: { email: string; role: string }[];
  data: Record<string, any[]>;
  // attachment media is stored alongside in the zip, keyed by attachment id
};

function slugify(input: string): string {
  return (
    input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "workspace"
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export async function exportWorkspace(workspaceId: string): Promise<{
  json: WorkspaceExport;
  media: Record<string, Uint8Array>;
}> {
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { name: true, slug: true },
  });
  const memberships = await prisma.membership.findMany({
    where: { workspaceId },
    select: { role: true, user: { select: { id: true, email: true, name: true } } },
  });

  const data: Record<string, any[]> = {};
  for (const spec of SPECS) {
    const rows = await (prisma as any)[spec.model].findMany({ where: spec.where(workspaceId) });
    data[spec.model] = spec.sort ? spec.sort(rows) : rows;
  }
  const attachments = await prisma.attachment.findMany({ where: { workspaceId } });
  data.attachment = attachments;

  // media bytes for each attachment (best-effort — a missing object is skipped)
  const media: Record<string, Uint8Array> = {};
  for (const a of attachments) {
    const bytes = await getObjectBytes(a.storageKey);
    if (bytes) media[a.id] = bytes;
  }

  return {
    json: {
      format: BACKUP_FORMAT,
      exportedAt: new Date().toISOString(),
      workspace: { name: workspace.name, slug: workspace.slug },
      users: memberships.map((m) => ({ id: m.user.id, email: m.user.email, name: m.user.name })),
      members: memberships.map((m) => ({ email: m.user.email, role: m.role })),
      data,
      // attachment rows live in data.attachment; bytes in media
    } as WorkspaceExport,
    media,
  };
}

// ── Import ────────────────────────────────────────────────────────────────────

const NO_LOGIN_HASH = "!restored:no-login"; // invalid argon2 → login always fails until reset

function remapBlockObjectives(content: string, objMap: Record<string, string>): string {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed.objectiveIds)) {
      parsed.objectiveIds = parsed.objectiveIds.map((id: string) => objMap[id]).filter(Boolean);
      return JSON.stringify(parsed);
    }
  } catch {
    /* leave as-is */
  }
  return content;
}

export async function importWorkspace(
  exp: WorkspaceExport,
  media: Record<string, Uint8Array>,
  importerUserId: string,
): Promise<{ workspaceId: string; name: string }> {
  const maps: Record<string, Record<string, string>> = {};
  const userMap: Record<string, string> = {}; // old userId -> new userId
  const emailToUser: Record<string, string> = {};

  // 1. new workspace with a unique slug
  const name = `${exp.workspace.name} (restored)`;
  const slug = `${slugify(exp.workspace.name)}-${Math.abs(hashStr(exp.exportedAt + name)) % 100000}`;
  const ws = await prisma.workspace.create({ data: { name, slug } });

  // 2. users (find-or-create by email) + memberships
  for (const u of exp.users) {
    let user = await prisma.user.findUnique({ where: { email: u.email }, select: { id: true } });
    if (!user) {
      user = await prisma.user.create({
        data: { email: u.email, name: u.name, passwordHash: NO_LOGIN_HASH },
        select: { id: true },
      });
    }
    userMap[u.id] = user.id;
    emailToUser[u.email] = user.id;
  }
  for (const m of exp.members) {
    const uid = emailToUser[m.email];
    if (!uid) continue;
    const role = m.role === "ADMIN" || m.role === "MANAGER" ? m.role : "MEMBER";
    await prisma.membership.create({
      data: { userId: uid, workspaceId: ws.id, role },
    });
  }
  // ensure the importer can reach the restored workspace as an admin
  const importerHasMembership = await prisma.membership.findFirst({
    where: { userId: importerUserId, workspaceId: ws.id },
    select: { id: true },
  });
  if (!importerHasMembership) {
    await prisma.membership.create({ data: { userId: importerUserId, workspaceId: ws.id, role: "ADMIN" } });
  }

  const remap = (target: string, val: string | null): string | null => {
    if (val == null) return null;
    if (target === WS) return ws.id;
    if (target === USER) return userMap[val] ?? importerUserId;
    return maps[target]?.[val] ?? null;
  };

  // 3. content graph, in dependency order
  for (const spec of SPECS) {
    if (spec.key) maps[spec.key] = {};
    const rows = spec.sort ? spec.sort(exp.data[spec.model] ?? []) : (exp.data[spec.model] ?? []);
    for (const row of rows) {
      const d: any = { ...row };
      delete d.id;
      delete d.updatedAt; // let @updatedAt default
      for (const col of Object.keys(spec.fks)) d[col] = remap(spec.fks[col], row[col] ?? null);
      if (spec.model === "block" && row.blockType === "knowledge_check") {
        d.content = remapBlockObjectives(row.content, maps.learningObjective ?? {});
      }
      const created = await (prisma as any)[spec.model].create({ data: d });
      if (spec.key) maps[spec.key][row.id] = created.id;
    }
  }

  // 4. attachments + media (needs remapped cardId + a fresh storage key)
  maps.attachment = {};
  for (const a of exp.data.attachment ?? []) {
    const newCardId = maps.card?.[a.cardId];
    if (!newCardId) continue;
    const key = buildObjectKey(ws.id, newCardId, a.fileName);
    const bytes = media[a.id];
    if (bytes) await putObjectBytes(key, bytes, a.mimeType || "application/octet-stream");
    const created = await prisma.attachment.create({
      data: {
        cardId: newCardId,
        workspaceId: ws.id,
        fileName: a.fileName,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        storageKey: key,
        uploadedById: userMap[a.uploadedById] ?? importerUserId,
      },
      select: { id: true },
    });
    maps.attachment[a.id] = created.id;
  }

  return { workspaceId: ws.id, name };
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

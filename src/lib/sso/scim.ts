import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { sha256 } from "@/lib/api-tokens";
import { scimBaseUrl } from "@/lib/sso/urls";
import { CONN_SELECT } from "@/lib/sso/connection";
import {
  changeEmail,
  fullName,
  ProvisionError,
  recomputeRoles,
  setActive,
  upsertMember,
  type Conn,
} from "@/lib/sso/provision";

// SCIM 2.0 service provider (RFC 7643/7644; docs/SSO.md). Written to JumpCloud's
// custom SCIM connector, and lenient in the ways identity providers differ: PATCH ops
// in any case, paths with or without filters, "True"/"False" strings for booleans,
// add-or-replace without a path. User ids are SsoIdentity ids; group ids IdpGroup ids.

export const SCHEMA = {
  user: "urn:ietf:params:scim:schemas:core:2.0:User",
  enterprise: "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User",
  group: "urn:ietf:params:scim:schemas:core:2.0:Group",
  list: "urn:ietf:params:scim:api:messages:2.0:ListResponse",
  patch: "urn:ietf:params:scim:api:messages:2.0:PatchOp",
  error: "urn:ietf:params:scim:api:messages:2.0:Error",
};

export type ScimConn = Conn & { id: string };

export class ScimError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly scimType?: string,
  ) {
    super(message);
  }
}

export function scimJson(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/scim+json; charset=utf-8", ...headers },
  });
}

export function scimError(e: unknown) {
  if (e instanceof ScimError || e instanceof ProvisionError) {
    const status = e instanceof ScimError ? e.status : e.status;
    return scimJson({ schemas: [SCHEMA.error], status: String(status), ...(e.scimType ? { scimType: e.scimType } : {}), detail: e.message }, status);
  }
  console.error("[scim] failed", e);
  return scimJson({ schemas: [SCHEMA.error], status: "500", detail: "Something went wrong." }, 500);
}

/** The connection a bearer token belongs to. JumpCloud's "Token Key" arrives as
 *  `Authorization: Bearer <token>`; a bare token is accepted too. */
export async function authenticateScim(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token.startsWith("tavscim_")) return null;
  const conn = await prisma.ssoConnection.findUnique({ where: { scimTokenHash: sha256(token) }, select: { ...CONN_SELECT, scimEnabled: true } });
  return conn?.scimEnabled ? conn : null;
}

// ── rendering ────────────────────────────────────────────────────────────────

type IdentityRow = { id: string; externalId: string | null; userName: string; active: boolean; createdAt: Date; updatedAt: Date; user: { name: string | null; email: string } };
export const IDENTITY_SELECT = { id: true, externalId: true, userName: true, active: true, createdAt: true, updatedAt: true, user: { select: { name: true, email: true } } } as const;

export function userResource(i: IdentityRow) {
  const [given, ...rest] = (i.user.name ?? "").split(" ");
  return {
    schemas: [SCHEMA.user],
    id: i.id,
    ...(i.externalId ? { externalId: i.externalId } : {}),
    userName: i.user.email,
    name: { formatted: i.user.name ?? i.user.email, givenName: given || "", familyName: rest.join(" ") },
    displayName: i.user.name ?? i.user.email,
    emails: [{ value: i.user.email, type: "work", primary: true }],
    active: i.active,
    meta: { resourceType: "User", created: i.createdAt.toISOString(), lastModified: i.updatedAt.toISOString(), location: `${scimBaseUrl()}/Users/${i.id}` },
  };
}

type GroupRow = { id: string; displayName: string; externalId: string | null; createdAt: Date; updatedAt: Date };
export async function groupResource(connId: string, g: GroupRow, withMembers = true) {
  let members: { value: string; display: string; $ref: string }[] | undefined;
  if (withMembers) {
    const rows = await prisma.idpGroupMember.findMany({
      where: { groupId: g.id },
      select: { user: { select: { email: true, ssoIdentities: { where: { connectionId: connId }, select: { id: true } } } } },
    });
    members = rows.flatMap((r) => r.user.ssoIdentities.map((s) => ({ value: s.id, display: r.user.email, $ref: `${scimBaseUrl()}/Users/${s.id}` })));
  }
  return {
    schemas: [SCHEMA.group],
    id: g.id,
    displayName: g.displayName,
    ...(g.externalId ? { externalId: g.externalId } : {}),
    ...(members ? { members } : {}),
    meta: { resourceType: "Group", created: g.createdAt.toISOString(), lastModified: g.updatedAt.toISOString(), location: `${scimBaseUrl()}/Groups/${g.id}` },
  };
}

export function listResponse(resources: unknown[], total: number, startIndex: number) {
  return { schemas: [SCHEMA.list], totalResults: total, startIndex, itemsPerPage: resources.length, Resources: resources };
}

export function paging(url: URL) {
  const startIndex = Math.max(1, Number(url.searchParams.get("startIndex")) || 1);
  const count = Math.min(200, Math.max(0, Number(url.searchParams.get("count") ?? 100) || 0));
  return { startIndex, count, skip: startIndex - 1 };
}

// ── filters ──────────────────────────────────────────────────────────────────

/** The `attr eq "value"` filters identity providers send (and `emails[value eq "x"]`). */
export function parseFilter(filter: string | null): { attr: string; value: string } | null {
  if (!filter) return null;
  const f = filter.trim();
  let m = /^([\w.:]+)\s+eq\s+"((?:[^"\\]|\\.)*)"$/i.exec(f);
  if (m) return { attr: m[1].toLowerCase(), value: m[2].replace(/\\(.)/g, "$1") };
  m = /^(\w+)\[(?:type\s+eq\s+"\w+"\s+and\s+)?value\s+eq\s+"((?:[^"\\]|\\.)*)"\]$/i.exec(f);
  if (m) return { attr: `${m[1].toLowerCase()}.value`, value: m[2].replace(/\\(.)/g, "$1") };
  throw new ScimError(400, `Unsupported filter: ${filter}`, "invalidFilter");
}

export function userWhere(connId: string, f: { attr: string; value: string } | null): Prisma.SsoIdentityWhereInput {
  const base = { connectionId: connId };
  if (!f) return base;
  switch (f.attr) {
    case "username":
    case "emails.value":
    case "emails":
      return { ...base, user: { email: { equals: f.value, mode: "insensitive" } } };
    case "externalid":
      return { ...base, externalId: f.value };
    case "id":
      return { ...base, id: f.value };
    default:
      throw new ScimError(400, `Can't filter users by ${f.attr}.`, "invalidFilter");
  }
}

export function groupWhere(connId: string, f: { attr: string; value: string } | null): Prisma.IdpGroupWhereInput {
  const base = { connectionId: connId };
  if (!f) return base;
  switch (f.attr) {
    case "displayname":
      return { ...base, displayName: { equals: f.value, mode: "insensitive" } };
    case "externalid":
      return { ...base, externalId: f.value };
    case "id":
      return { ...base, id: f.value };
    default:
      throw new ScimError(400, `Can't filter groups by ${f.attr}.`, "invalidFilter");
  }
}

// ── users ────────────────────────────────────────────────────────────────────

type UserFields = { email?: string; given?: string | null; family?: string | null; display?: string | null; active?: boolean; externalId?: string | null };

const bool = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : typeof v === "string" ? v.toLowerCase() === "true" : undefined);

function primaryEmail(emails: unknown): string | undefined {
  if (!Array.isArray(emails)) return undefined;
  const list = emails as { value?: unknown; primary?: unknown; type?: unknown }[];
  const pick = list.find((e) => bool(e.primary)) ?? list.find((e) => e.type === "work") ?? list[0];
  return typeof pick?.value === "string" ? pick.value : undefined;
}

/** The fields Tavoro keeps, from a full SCIM user body (POST/PUT). */
export function fieldsFromUser(body: Record<string, unknown>): UserFields {
  const name = (body.name ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  return {
    email: str(body.userName) ?? primaryEmail(body.emails),
    given: str(name.givenName) ?? null,
    family: str(name.familyName) ?? null,
    display: str(body.displayName) ?? str(name.formatted) ?? null,
    active: bool(body.active),
    externalId: str(body.externalId) ?? null,
  };
}

/** Fold PATCH operations into the fields they change. */
export function fieldsFromUserPatch(ops: PatchOp[]): UserFields {
  const out: UserFields = {};
  const set = (path: string, value: unknown) => {
    const p = path.toLowerCase();
    if (p === "active") out.active = bool(value);
    else if (p === "username") out.email = String(value);
    else if (p === "displayname") out.display = String(value);
    else if (p === "externalid") out.externalId = value == null ? null : String(value);
    else if (p === "name.givenname") out.given = String(value);
    else if (p === "name.familyname") out.family = String(value);
    else if (p === "name.formatted") out.display = String(value);
    else if (p === "name" && value && typeof value === "object") {
      const n = value as Record<string, unknown>;
      if (typeof n.givenName === "string") out.given = n.givenName;
      if (typeof n.familyName === "string") out.family = n.familyName;
      if (typeof n.formatted === "string") out.display = n.formatted;
    } else if (p === "emails") out.email = primaryEmail(value) ?? out.email;
    else if (/^emails\[.*\]\.value$/.test(p) || p === "emails.value") out.email = String(Array.isArray(value) ? value[0] : value);
    // Anything else (phone numbers, addresses, the enterprise extension) Tavoro doesn't keep.
  };
  for (const op of ops) {
    const kind = op.op.toLowerCase();
    if (kind === "remove") {
      if (op.path?.toLowerCase() === "externalid") out.externalId = null;
      continue;
    }
    if (op.path) set(op.path, op.value);
    else if (op.value && typeof op.value === "object") for (const [k, v] of Object.entries(op.value)) set(k.replace(`${SCHEMA.user}:`, ""), v);
  }
  return out;
}

export async function applyUserFields(conn: ScimConn, identityId: string, f: UserFields) {
  const identity = await prisma.ssoIdentity.findFirst({ where: { id: identityId, connectionId: conn.id }, select: { userId: true, user: { select: { name: true } } } });
  if (!identity) throw new ScimError(404, "User not found.");
  if (f.email) await changeEmail(conn, identity.userId, f.email);
  if (f.given !== undefined || f.family !== undefined || f.display !== undefined) {
    const [g0, ...rest] = (identity.user.name ?? "").split(" ");
    const name = f.display ?? fullName(f.given !== undefined ? f.given : g0, f.family !== undefined ? f.family : rest.join(" "));
    if (name) await prisma.user.update({ where: { id: identity.userId }, data: { name } });
  }
  if (f.externalId !== undefined) await prisma.ssoIdentity.update({ where: { id: identityId }, data: { externalId: f.externalId } });
  if (f.active !== undefined) await setActive(conn, identity.userId, f.active);
  await prisma.ssoIdentity.update({ where: { id: identityId }, data: { updatedAt: new Date() } });
}

export async function createUser(conn: ScimConn, body: Record<string, unknown>) {
  const f = fieldsFromUser(body);
  if (!f.email) throw new ScimError(400, "userName is required.", "invalidValue");
  const existing = await prisma.ssoIdentity.findFirst({ where: { connectionId: conn.id, user: { email: { equals: f.email, mode: "insensitive" } } }, select: { id: true } });
  if (existing) throw new ScimError(409, "A user with that userName is already provisioned.", "uniqueness");
  const { identityId } = await upsertMember(conn, { email: f.email, name: fullName(f.given, f.family, f.display), externalId: f.externalId, active: f.active ?? true });
  return identityId;
}

/** DELETE: the member is suspended (their work stays) and the link to the provider ends. */
export async function deleteUser(conn: ScimConn, identityId: string) {
  const identity = await prisma.ssoIdentity.findFirst({ where: { id: identityId, connectionId: conn.id }, select: { userId: true } });
  if (!identity) throw new ScimError(404, "User not found.");
  await setActive(conn, identity.userId, false);
  await prisma.idpGroupMember.deleteMany({ where: { userId: identity.userId, group: { connectionId: conn.id } } });
  await prisma.ssoIdentity.delete({ where: { id: identityId } });
}

// ── groups ───────────────────────────────────────────────────────────────────

export type PatchOp = { op: string; path?: string; value?: unknown };

export function readOps(body: unknown): PatchOp[] {
  const ops = (body as { Operations?: unknown })?.Operations;
  if (!Array.isArray(ops)) throw new ScimError(400, "PATCH needs an Operations array.", "invalidSyntax");
  return ops.map((o) => {
    const op = o as Record<string, unknown>;
    if (typeof op.op !== "string") throw new ScimError(400, "Each operation needs an op.", "invalidSyntax");
    return { op: op.op, path: typeof op.path === "string" ? op.path : undefined, value: op.value };
  });
}

/** SCIM user ids (SsoIdentity ids) → Tavoro user ids, in this connection. Unknown ids are skipped. */
async function usersFor(connId: string, members: unknown): Promise<string[]> {
  const ids = (Array.isArray(members) ? members : members ? [members] : [])
    .map((m) => (typeof m === "string" ? m : (m as { value?: unknown })?.value))
    .filter((v): v is string => typeof v === "string");
  if (!ids.length) return [];
  const rows = await prisma.ssoIdentity.findMany({ where: { connectionId: connId, id: { in: ids } }, select: { userId: true } });
  return rows.map((r) => r.userId);
}

async function memberIds(groupId: string) {
  return (await prisma.idpGroupMember.findMany({ where: { groupId }, select: { userId: true } })).map((m) => m.userId);
}

async function setMembers(groupId: string, userIds: string[]) {
  const before = await memberIds(groupId);
  await prisma.idpGroupMember.deleteMany({ where: { groupId, userId: { notIn: userIds } } });
  if (userIds.length) await prisma.idpGroupMember.createMany({ data: userIds.map((userId) => ({ groupId, userId })), skipDuplicates: true });
  return [...before, ...userIds];
}

export async function createGroup(conn: ScimConn, body: Record<string, unknown>) {
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  if (!displayName) throw new ScimError(400, "displayName is required.", "invalidValue");
  const externalId = typeof body.externalId === "string" ? body.externalId : null;
  const existing = await prisma.idpGroup.findFirst({ where: { connectionId: conn.id, displayName: { equals: displayName, mode: "insensitive" } }, select: { id: true, fromScim: true } });
  // A group first seen in a SAML sign-in is taken over; one SCIM already manages isn't.
  if (existing?.fromScim) throw new ScimError(409, "A group with that displayName already exists.", "uniqueness");
  const group = existing
    ? await prisma.idpGroup.update({ where: { id: existing.id }, data: { displayName, externalId, fromScim: true }, select: { id: true } })
    : await prisma.idpGroup.create({ data: { connectionId: conn.id, displayName, externalId, fromScim: true }, select: { id: true } });
  const affected = await setMembers(group.id, await usersFor(conn.id, body.members));
  await recomputeRoles(conn, affected);
  return group.id;
}

export async function replaceGroup(conn: ScimConn, groupId: string, body: Record<string, unknown>) {
  await requireGroup(conn.id, groupId);
  const data: Prisma.IdpGroupUpdateInput = { fromScim: true };
  if (typeof body.displayName === "string" && body.displayName.trim()) data.displayName = body.displayName.trim();
  if (typeof body.externalId === "string") data.externalId = body.externalId;
  await prisma.idpGroup.update({ where: { id: groupId }, data });
  const affected = await setMembers(groupId, await usersFor(conn.id, body.members));
  await recomputeRoles(conn, affected);
}

export async function patchGroup(conn: ScimConn, groupId: string, ops: PatchOp[]) {
  await requireGroup(conn.id, groupId);
  const affected = new Set<string>();
  for (const op of ops) {
    const kind = op.op.toLowerCase();
    const path = op.path?.trim() ?? "";
    const filtered = /^members\[\s*value\s+eq\s+"([^"]+)"\s*\]$/i.exec(path);
    if (kind === "remove" && filtered) {
      for (const u of await usersFor(conn.id, filtered[1])) {
        await prisma.idpGroupMember.deleteMany({ where: { groupId, userId: u } });
        affected.add(u);
      }
    } else if (path.toLowerCase() === "members") {
      const users = await usersFor(conn.id, op.value);
      if (kind === "add") {
        if (users.length) await prisma.idpGroupMember.createMany({ data: users.map((userId) => ({ groupId, userId })), skipDuplicates: true });
        users.forEach((u) => affected.add(u));
      } else if (kind === "remove") {
        // With a value: those members. Without: everyone (RFC 7644 §3.5.2.2).
        const gone = op.value === undefined || (Array.isArray(op.value) && !op.value.length) ? await memberIds(groupId) : users;
        await prisma.idpGroupMember.deleteMany({ where: { groupId, userId: { in: gone } } });
        gone.forEach((u) => affected.add(u));
      } else if (kind === "replace") {
        (await setMembers(groupId, users)).forEach((u) => affected.add(u));
      }
    } else if (path.toLowerCase() === "displayname" && (kind === "replace" || kind === "add") && typeof op.value === "string") {
      await prisma.idpGroup.update({ where: { id: groupId }, data: { displayName: op.value.trim() } });
      // The name may now match (or stop matching) a role mapping.
      (await memberIds(groupId)).forEach((u) => affected.add(u));
    } else if (path.toLowerCase() === "externalid" && typeof op.value === "string") {
      await prisma.idpGroup.update({ where: { id: groupId }, data: { externalId: op.value } });
    } else if (!path && op.value && typeof op.value === "object") {
      const v = op.value as Record<string, unknown>;
      if (typeof v.displayName === "string") {
        await prisma.idpGroup.update({ where: { id: groupId }, data: { displayName: v.displayName.trim() } });
        (await memberIds(groupId)).forEach((u) => affected.add(u));
      }
      if (typeof v.externalId === "string") await prisma.idpGroup.update({ where: { id: groupId }, data: { externalId: v.externalId } });
      if (v.members !== undefined) {
        const users = await usersFor(conn.id, v.members);
        if (kind === "replace") (await setMembers(groupId, users)).forEach((u) => affected.add(u));
        else if (users.length) {
          await prisma.idpGroupMember.createMany({ data: users.map((userId) => ({ groupId, userId })), skipDuplicates: true });
          users.forEach((u) => affected.add(u));
        }
      }
    } else {
      throw new ScimError(400, `Unsupported PATCH operation: ${op.op} ${path || "(no path)"}`, "invalidPath");
    }
  }
  await prisma.idpGroup.update({ where: { id: groupId }, data: { updatedAt: new Date() } });
  await recomputeRoles(conn, [...affected]);
}

export async function deleteGroup(conn: ScimConn, groupId: string) {
  await requireGroup(conn.id, groupId);
  const affected = await memberIds(groupId);
  await prisma.idpGroup.delete({ where: { id: groupId } });
  await recomputeRoles(conn, affected);
}

async function requireGroup(connId: string, groupId: string) {
  const g = await prisma.idpGroup.findFirst({ where: { id: groupId, connectionId: connId }, select: { id: true } });
  if (!g) throw new ScimError(404, "Group not found.");
}

// ── troubleshooting log ──────────────────────────────────────────────────────

/** Keep a short record of each request for Settings → Single sign-on (passwords dropped). */
export async function logScim(connId: string, req: { method: string; path: string; status: number; summary: string; body?: unknown }) {
  const scrub = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(scrub) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, /password/i.test(k) ? "[removed]" : scrub(x)])) : v;
  try {
    await prisma.scimLog.create({
      data: {
        connectionId: connId,
        method: req.method,
        path: req.path.slice(0, 500),
        status: req.status,
        summary: req.summary.slice(0, 300),
        ...(req.body !== undefined ? { request: scrub(req.body) as Prisma.InputJsonValue } : {}),
      },
    });
    await prisma.ssoConnection.update({ where: { id: connId }, data: { lastScimAt: new Date() } });
    const old = await prisma.scimLog.findMany({ where: { connectionId: connId }, orderBy: { createdAt: "desc" }, skip: 200, select: { id: true } });
    if (old.length) await prisma.scimLog.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  } catch (e) {
    console.warn("[scim] couldn't log a request", e);
  }
}

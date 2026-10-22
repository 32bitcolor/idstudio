import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import type { Principal } from "@/lib/principal";

// Credentials for MCP clients (docs/MCP.md). Two kinds share one table:
//   personal  "tav_…"   made in Settings → AI & MCP, pasted into a client
//   oauth     "tavo_…"  issued to a client after the consent screen; it expires
//                         after an hour and the client renews it with "tavr_…"
// Only SHA-256 hashes are stored. A secret has 256 bits of entropy, so a fast hash is
// the right tool (a password hash would only slow every request down).

export const SCOPES = ["read", "read write"] as const;
export type Scope = (typeof SCOPES)[number];

export const ACCESS_TOKEN_TTL_S = 60 * 60; // OAuth access tokens: 1 hour
export const REFRESH_TOKEN_TTL_S = 60 * 60 * 24 * 30; // OAuth refresh tokens: 30 days

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function newSecret(prefix: "tav_" | "tavo_" | "tavr_" | "tavc_" | "tavs_" | "tavscim_"): string {
  return prefix + randomBytes(32).toString("base64url");
}

/** Compare two strings without leaking where they differ. */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function canWrite(scope: string): boolean {
  return scope.split(" ").includes("write");
}

/** Normalise a requested scope string: anything that asks for write gets "read write". */
export function normaliseScope(raw: string | null | undefined): Scope {
  return raw && raw.split(/\s+/).includes("write") ? "read write" : "read";
}

export async function createPersonalToken(input: {
  userId: string;
  workspaceId: string;
  name: string;
  scope: Scope;
  expiresAt: Date | null;
}) {
  const token = newSecret("tav_");
  const row = await prisma.apiToken.create({
    data: {
      userId: input.userId,
      workspaceId: input.workspaceId,
      name: input.name,
      kind: "personal",
      scope: input.scope,
      tokenHash: sha256(token),
      prefix: token.slice(0, 12),
      expiresAt: input.expiresAt,
    },
    select: { id: true },
  });
  return { token, id: row.id };
}

/** A fresh access + refresh token pair for an OAuth connection (new or renewed). */
export function newOAuthPair() {
  const accessToken = newSecret("tavo_");
  const refreshToken = newSecret("tavr_");
  const now = Date.now();
  return {
    accessToken,
    refreshToken,
    data: {
      tokenHash: sha256(accessToken),
      refreshHash: sha256(refreshToken),
      prefix: accessToken.slice(0, 12),
      expiresAt: new Date(now + ACCESS_TOKEN_TTL_S * 1000),
      refreshExpiresAt: new Date(now + REFRESH_TOKEN_TTL_S * 1000),
    },
  };
}

/** Resolve `Authorization: Bearer …` to the principal it acts as, or null. A token
 *  stops working the moment it's revoked, expires, or its user leaves the workspace. */
export async function authenticateBearer(req: Request): Promise<Principal | null> {
  const header = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(\S+)$/i.exec(header);
  // idst_/idsto_ are tokens issued before the rename to Tavoro; they keep working.
  if (!m || !/^(tav|idst)o?_/.test(m[1])) return null;
  const row = await prisma.apiToken.findUnique({
    where: { tokenHash: sha256(m[1]) },
    select: { id: true, userId: true, workspaceId: true, scope: true, expiresAt: true, revokedAt: true, lastUsedAt: true },
  });
  if (!row || row.revokedAt || (row.expiresAt && row.expiresAt.getTime() <= Date.now())) return null;
  const member = await prisma.membership.findFirst({
    where: { userId: row.userId, workspaceId: row.workspaceId, suspendedAt: null },
    select: { id: true },
  });
  if (!member) return null;
  // "Last used" is for the Settings list; a minute's resolution is plenty.
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
    await prisma.apiToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
  }
  return { userId: row.userId, workspaceId: row.workspaceId, tokenId: row.id, canWrite: canWrite(row.scope) };
}

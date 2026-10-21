import { prisma } from "@/lib/db";
import { ACCESS_TOKEN_TTL_S, newOAuthPair, sha256 } from "@/lib/api-tokens";
import { CORS, oauthError, pkceMatches, preflight, readParams } from "@/lib/oauth";

// The token endpoint: trade an authorization code (with its PKCE verifier) for an
// access + refresh token, or rotate a refresh token. One ApiToken row is one
// connection; renewing updates that row, so Settings shows one entry per client.
function tokens(pair: ReturnType<typeof newOAuthPair>, scope: string) {
  return Response.json(
    {
      access_token: pair.accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL_S,
      refresh_token: pair.refreshToken,
      scope: scope === "read write" ? "read write" : "read",
    },
    { headers: { ...CORS, "Cache-Control": "no-store", Pragma: "no-cache" } },
  );
}

export async function POST(req: Request) {
  const p = await readParams(req);
  if (p.grant_type === "authorization_code") {
    if (!p.code || !p.client_id || !p.code_verifier) return oauthError("invalid_request", "code, client_id and code_verifier are required.");
    const code = await prisma.oAuthCode.findUnique({ where: { codeHash: sha256(p.code) }, include: { client: { select: { name: true } } } });
    if (!code || code.usedAt || code.expiresAt.getTime() < Date.now()) return oauthError("invalid_grant", "The code is invalid, used or expired.");
    // Spend it first: a code works once, even if the rest of this request fails.
    const spent = await prisma.oAuthCode.updateMany({ where: { id: code.id, usedAt: null }, data: { usedAt: new Date() } });
    if (spent.count !== 1) return oauthError("invalid_grant", "The code was already used.");
    if (code.clientId !== p.client_id) return oauthError("invalid_grant", "The code was issued to another client.");
    if (p.redirect_uri && p.redirect_uri !== code.redirectUri) return oauthError("invalid_grant", "redirect_uri doesn't match.");
    if (!pkceMatches(p.code_verifier, code.codeChallenge)) return oauthError("invalid_grant", "PKCE verification failed.");
    const member = await prisma.membership.findFirst({ where: { userId: code.userId, workspaceId: code.workspaceId }, select: { id: true } });
    if (!member) return oauthError("invalid_grant", "You're no longer a member of that workspace.");

    const pair = newOAuthPair();
    await prisma.apiToken.create({
      data: {
        userId: code.userId,
        workspaceId: code.workspaceId,
        name: code.client.name,
        kind: "oauth",
        clientId: code.clientId,
        scope: code.scope,
        ...pair.data,
      },
    });
    return tokens(pair, code.scope);
  }

  if (p.grant_type === "refresh_token") {
    if (!p.refresh_token) return oauthError("invalid_request", "refresh_token is required.");
    const row = await prisma.apiToken.findUnique({ where: { refreshHash: sha256(p.refresh_token) } });
    if (!row || row.kind !== "oauth" || row.revokedAt || !row.refreshExpiresAt || row.refreshExpiresAt.getTime() < Date.now()) {
      return oauthError("invalid_grant", "The refresh token is invalid, revoked or expired.");
    }
    if (p.client_id && p.client_id !== row.clientId) return oauthError("invalid_grant", "The refresh token belongs to another client.");
    // Rotation: the old refresh token stops working the moment this one is issued.
    const pair = newOAuthPair();
    const updated = await prisma.apiToken.updateMany({ where: { id: row.id, refreshHash: row.refreshHash }, data: pair.data });
    if (updated.count !== 1) return oauthError("invalid_grant", "The refresh token was already used.");
    return tokens(pair, row.scope);
  }

  return oauthError("unsupported_grant_type", "Use authorization_code or refresh_token.");
}

export const OPTIONS = preflight;

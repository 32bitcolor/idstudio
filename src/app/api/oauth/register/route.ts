import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { newSecret, sha256 } from "@/lib/api-tokens";
import { checkThrottle, clientIp } from "@/lib/throttle";
import { CORS, isAllowedRedirectUri, oauthError, preflight } from "@/lib/oauth";

// RFC 7591 dynamic client registration. Anyone may register a client (that's how
// Claude.ai connects from just a URL); a client alone can do nothing until a signed-in
// member approves it on the consent screen. Public clients (PKCE only) are the norm;
// a client that asks to be confidential gets a secret it must present at the token
// endpoint, alongside PKCE.
const Body = z.object({
  redirect_uris: z.array(z.string()).min(1).max(10),
  client_name: z.string().max(120).optional(),
  token_endpoint_auth_method: z.string().optional(),
});

export async function POST(req: Request) {
  if (!(await checkThrottle(`oauth-register:${await clientIp()}`, 20, 3600))) {
    return oauthError("invalid_client_metadata", "Too many registrations from this network; try again later.", 429);
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return oauthError("invalid_client_metadata", "redirect_uris is required.");
  const bad = parsed.data.redirect_uris.find((u) => !isAllowedRedirectUri(u));
  if (bad) return oauthError("invalid_redirect_uri", `Redirect URI not allowed: ${bad}`);
  const authMethod = parsed.data.token_endpoint_auth_method ?? "none";
  if (!["none", "client_secret_basic", "client_secret_post"].includes(authMethod)) {
    return oauthError("invalid_client_metadata", "token_endpoint_auth_method must be none, client_secret_basic or client_secret_post.");
  }
  const secret = authMethod === "none" ? null : newSecret("tavs_");

  const client = await prisma.oAuthClient.create({
    data: {
      id: `tavc_${randomBytes(16).toString("base64url")}`,
      name: parsed.data.client_name?.trim() || "MCP client",
      redirectUris: parsed.data.redirect_uris,
      authMethod,
      secretHash: secret ? sha256(secret) : null,
    },
  });
  return Response.json(
    {
      client_id: client.id,
      client_name: client.name,
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: authMethod,
      ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
    },
    { status: 201, headers: { ...CORS, "Cache-Control": "no-store" } },
  );
}

export const OPTIONS = preflight;

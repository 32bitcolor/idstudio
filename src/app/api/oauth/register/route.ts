import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { checkThrottle, clientIp } from "@/lib/throttle";
import { CORS, isAllowedRedirectUri, oauthError, preflight } from "@/lib/oauth";

// RFC 7591 dynamic client registration. Anyone may register a client (that's how
// Claude.ai connects from just a URL); a client alone can do nothing until a signed-in
// member approves it on the consent screen.
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
  if (parsed.data.token_endpoint_auth_method && parsed.data.token_endpoint_auth_method !== "none") {
    return oauthError("invalid_client_metadata", "Only public clients (token_endpoint_auth_method none, with PKCE) are supported.");
  }

  const client = await prisma.oAuthClient.create({
    data: {
      id: `idsc_${randomBytes(16).toString("base64url")}`,
      name: parsed.data.client_name?.trim() || "MCP client",
      redirectUris: parsed.data.redirect_uris,
    },
  });
  return Response.json(
    {
      client_id: client.id,
      client_name: client.name,
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
    },
    { status: 201, headers: { ...CORS, "Cache-Control": "no-store" } },
  );
}

export const OPTIONS = preflight;

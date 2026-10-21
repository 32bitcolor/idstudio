import { authorizationServerMetadata, CORS, preflight } from "@/lib/oauth";

// Served at /.well-known/oauth-authorization-server (and openid-configuration) via
// rewrites in next.config.ts: Next.js can't route a folder that starts with a dot.
export function GET(req: Request) {
  return Response.json(authorizationServerMetadata(req), { headers: { ...CORS, "Cache-Control": "public, max-age=3600" } });
}

export const OPTIONS = preflight;

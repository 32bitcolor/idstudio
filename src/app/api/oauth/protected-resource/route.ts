import { CORS, preflight, protectedResourceMetadata } from "@/lib/oauth";

// Served at /.well-known/oauth-protected-resource[/api/mcp] via next.config.ts rewrites.
export function GET(req: Request) {
  return Response.json(protectedResourceMetadata(req), { headers: { ...CORS, "Cache-Control": "public, max-age=3600" } });
}

export const OPTIONS = preflight;

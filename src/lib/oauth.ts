import "server-only";
import { createHash } from "node:crypto";
import { SCOPES } from "@/lib/api-tokens";

// OAuth 2.1 for MCP clients (docs/MCP.md): Tavoro is both the authorization server
// and the resource server. PKCE (S256) always; clients identify themselves with a
// Client ID Metadata Document URL (ChatGPT, newer clients) or register dynamically
// (RFC 7591), so any MCP client can connect from just the URL.

export const CODE_TTL_MS = 10 * 60 * 1000;
export const MCP_PATH = "/api/mcp";

/** The public base URL: APP_URL, or what the request says it was sent to. */
export function baseUrl(req?: Request): string {
  const env = process.env.APP_URL?.replace(/\/+$/, "");
  if (env) return env;
  if (!req) return "";
  const h = req.headers;
  const proto = h.get("x-forwarded-proto")?.split(",")[0] ?? new URL(req.url).protocol.replace(":", "");
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? new URL(req.url).host;
  return `${proto}://${host}`;
}

export function resourceUrl(req?: Request) {
  return `${baseUrl(req)}${MCP_PATH}`;
}

/** RFC 9728: where clients learn which authorization server guards /api/mcp. */
export function protectedResourceMetadata(req: Request) {
  const base = baseUrl(req);
  return {
    resource: `${base}${MCP_PATH}`,
    authorization_servers: [base],
    scopes_supported: [...new Set(SCOPES.flatMap((s) => s.split(" ")))],
    bearer_methods_supported: ["header"],
    resource_name: "Tavoro",
    resource_documentation: `${base}/help/ai-mcp`,
  };
}

/** RFC 8414 authorization server metadata. */
export function authorizationServerMetadata(req: Request) {
  const base = baseUrl(req);
  return {
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/api/oauth/token`,
    registration_endpoint: `${base}/api/oauth/register`,
    revocation_endpoint: `${base}/api/oauth/revoke`,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_basic", "client_secret_post"],
    revocation_endpoint_auth_methods_supported: ["none", "client_secret_basic", "client_secret_post"],
    // RFC 9207: every authorization response, errors included, carries `iss`.
    authorization_response_iss_parameter_supported: true,
    // MCP 2025-11-25: a client_id may be the URL of its metadata document.
    client_id_metadata_document_supported: true,
    scopes_supported: ["read", "write"],
    service_documentation: `${base}/help/ai-mcp`,
  };
}

/** A redirect URI a public client may register: https anywhere, http only to this
 *  machine (native apps, RFC 8252), or an app's own scheme. Never script-ish schemes. */
export function isAllowedRedirectUri(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.hash) return false;
  const scheme = u.protocol.slice(0, -1).toLowerCase();
  if (["javascript", "data", "file", "vbscript", "blob", "about"].includes(scheme)) return false;
  if (scheme === "http") return ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  return true;
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Whether a requested redirect_uri is one the client registered. Exact match, except
 *  that a loopback http redirect may use any port (RFC 8252 §7.3): native clients like
 *  VS Code, Cursor and Codex pick a free port at sign-in time. */
export function redirectAllowed(registered: string[], requested: string): boolean {
  if (registered.includes(requested)) return true;
  let r: URL;
  try {
    r = new URL(requested);
  } catch {
    return false;
  }
  if (r.protocol !== "http:" || !LOOPBACK.has(r.hostname)) return false;
  return registered.some((u) => {
    try {
      const g = new URL(u);
      return g.protocol === "http:" && g.hostname === r.hostname && g.pathname === r.pathname && g.search === r.search;
    } catch {
      return false;
    }
  });
}

/** RFC 8707: a `resource` a client asks for must be this server (the MCP endpoint, or
 *  its origin). Absent is fine. */
export function resourceAllowed(resource: string | null | undefined, req?: Request): boolean {
  if (!resource) return true;
  const strip = (u: string) => u.replace(/\/+$/, "");
  const r = strip(resource);
  return r === strip(resourceUrl(req)) || r === strip(baseUrl(req));
}

/** PKCE S256: base64url(sha256(verifier)) must equal the challenge. */
export function pkceMatches(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  return createHash("sha256").update(verifier).digest("base64url") === challenge;
}

export function oauthError(error: string, description: string, status = 400) {
  return Response.json(
    { error, error_description: description },
    { status, headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } },
  );
}

/** Browser-based MCP clients call the discovery, registration and token endpoints
 *  cross-origin. They carry no cookies, so allowing any origin is safe. */
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, MCP-Protocol-Version",
};

export function preflight() {
  return new Response(null, { status: 204, headers: { ...CORS, "Access-Control-Max-Age": "86400" } });
}

/** Read a token/revoke request body: form-encoded per spec, JSON tolerated. */
export async function readParams(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(body).filter(([, v]) => typeof v === "string")) as Record<string, string>;
  }
  const text = await req.text();
  return Object.fromEntries(new URLSearchParams(text));
}

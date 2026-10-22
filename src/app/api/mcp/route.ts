import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateBearer } from "@/lib/api-tokens";
import { runAsPrincipal } from "@/lib/principal";
import { buildMcpServer } from "@/lib/mcp/server";
import { checkThrottle } from "@/lib/throttle";
import { baseUrl, CORS, preflight } from "@/lib/oauth";

// The MCP endpoint (Streamable HTTP, stateless). Every request carries a bearer token
// (personal or OAuth); without one, the 401 points the client at the OAuth metadata,
// which is how Claude.ai and Claude Desktop discover the sign-in flow.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function unauthorized(req: Request, description: string) {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32001, message: description }, id: null },
    {
      status: 401,
      headers: {
        ...CORS,
        "Access-Control-Expose-Headers": "WWW-Authenticate",
        "WWW-Authenticate": `Bearer resource_metadata="${baseUrl(req)}/.well-known/oauth-protected-resource/api/mcp", scope="read write", error="invalid_token", error_description="${description}"`,
      },
    },
  );
}

/** The SDK answers 406 unless Accept lists both application/json and text/event-stream,
 *  as the spec asks clients to. Some clients send only one; since this server always
 *  replies with plain JSON, accept them rather than turn them away. */
function lenientAccept(req: Request): Request {
  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("application/json") && accept.includes("text/event-stream")) return req;
  const headers = new Headers(req.headers);
  headers.set("accept", "application/json, text/event-stream");
  return new Request(req.url, { method: req.method, headers, body: req.body, duplex: "half" } as RequestInit);
}

async function handle(req: Request) {
  const principal = await authenticateBearer(req);
  if (!principal) {
    return unauthorized(req, req.headers.get("authorization") ? "The token is invalid, expired or revoked." : "Sign in to Tavoro to use this server.");
  }
  // Generous: a model working through a task makes many calls, but a runaway loop stops.
  if (!(await checkThrottle(`mcp:${principal.tokenId}`, 600, 60))) {
    return Response.json({ jsonrpc: "2.0", error: { code: -32000, message: "Too many requests; slow down." }, id: null }, { status: 429, headers: CORS });
  }
  return runAsPrincipal(principal, async () => {
    const server = buildMcpServer();
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    const res = await transport.handleRequest(lenientAccept(req));
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
    return new Response(res.body, { status: res.status, headers });
  });
}

/** Stateless server: no standalone event stream to open (GET) and no session to end
 *  (DELETE). The spec's answer to both is 405, which clients handle. */
function notAllowed() {
  return new Response(null, { status: 405, headers: { ...CORS, Allow: "POST, OPTIONS" } });
}

export { handle as POST, notAllowed as GET, notAllowed as DELETE };
export const OPTIONS = preflight;

import { getActiveMembership, getCurrentUser } from "@/lib/dal";
import { baseUrl } from "@/lib/oauth";
import { checkThrottle } from "@/lib/throttle";
import { runTurn, type AgentEvent } from "@/lib/assistant/agent";

// One assistant turn, streamed to the panel as server-sent events (docs/ASSISTANT.md).
// Signed-in members only, from Tavoro's own pages: the Origin must be this app, and the
// JSON body means a cross-site form can't post here at all.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Body = { conversationId?: string; message?: string; decisions?: Record<string, "approve" | "decline">; path?: string; model?: string };

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== baseUrl(req)) return Response.json({ error: "Wrong origin." }, { status: 403 });
  if (!req.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "Expected JSON." }, { status: 415 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });
  const membership = await getActiveMembership();
  if (!membership) return Response.json({ error: "No workspace." }, { status: 403 });
  if (!(await checkThrottle(`assistant:${user.id}`, 40, 60))) return Response.json({ error: "Too many messages; wait a minute." }, { status: 429 });

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || (typeof body.message !== "string" && !body.decisions)) return Response.json({ error: "Nothing to send." }, { status: 400 });
  if (typeof body.message === "string" && body.message.length > 20_000) return Response.json({ error: "That message is too long." }, { status: 413 });

  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort());
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: AgentEvent) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {}
      };
      try {
        await runTurn({
          userId: user.id,
          workspaceId: membership.workspaceId,
          conversationId: typeof body.conversationId === "string" ? body.conversationId : undefined,
          message: typeof body.message === "string" ? body.message : undefined,
          decisions: body.decisions && typeof body.decisions === "object" ? body.decisions : undefined,
          path: typeof body.path === "string" ? body.path.slice(0, 500) : undefined,
          model: typeof body.model === "string" ? body.model.slice(0, 120) : undefined,
          signal: abort.signal,
          emit,
        });
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
    cancel() {
      abort.abort();
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", "x-accel-buffering": "no" },
  });
}

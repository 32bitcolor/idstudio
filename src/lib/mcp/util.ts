import "server-only";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import { currentPrincipal, type Principal } from "@/lib/principal";
import { appUrl } from "@/lib/app-url";
import { resolveCardKey } from "@/lib/authz";

// Shared plumbing for the MCP tools (docs/MCP.md). Tools return JSON as text: every
// MCP client shows text, and models read JSON reliably. Rich text goes in and out as
// Markdown (lib/markdown.ts). Failures come back as tool errors (isError), never as
// thrown exceptions, so the model can read the message and recover.

export function principal(): Principal {
  const p = currentPrincipal();
  if (!p) throw new Error("No MCP principal for this request.");
  return p;
}

/** An absolute link into the app, for the model to hand to the user. */
export function link(path: string): string {
  return appUrl(path) ?? path;
}

/** A result as text (every client shows it) and, for objects, as structuredContent
 *  (clients that read structured output, ChatGPT among them, use that). */
export function ok(data: unknown): CallToolResult {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  const structured = data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : undefined;
  return { content: [{ type: "text", text }], ...(structured ? { structuredContent: structured } : {}) };
}

export function fail(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

/** Thrown inside a tool to stop with a message the model sees. */
export class ToolError extends Error {}

/** Unwrap a server action's `{ error }` convention. */
export function check<T>(res: T): Exclude<T, { error: string }> {
  if (res && typeof res === "object" && "error" in res && typeof (res as { error: unknown }).error === "string") {
    throw new ToolError((res as { error: string }).error);
  }
  return res as Exclude<T, { error: string }>;
}

type Shape = Record<string, z.ZodType>;

type ToolSpec<S extends Shape> = {
  title: string;
  description: string;
  input: S;
  /** read: lists everything; write: changes data; destructive: deletes or overrides. */
  kind: "read" | "write" | "destructive";
  /** Calling it twice with the same input changes nothing more (set status, rename…). */
  idempotent?: boolean;
  /** Declared result shape: clients can validate structuredContent against it. */
  output?: Shape;
};

/** Register a tool. Write tools are left out entirely for read-only connections, so
 *  the client never offers them. */
export function tool<S extends Shape>(
  server: McpServer,
  name: string,
  spec: ToolSpec<S>,
  run: (args: z.infer<z.ZodObject<S>>) => Promise<CallToolResult | unknown>,
) {
  if (spec.kind !== "read" && !principal().canWrite) return;
  server.registerTool(
    name,
    {
      title: spec.title,
      description: spec.description,
      inputSchema: spec.input,
      ...(spec.output ? { outputSchema: spec.output } : {}),
      annotations: {
        title: spec.title,
        readOnlyHint: spec.kind === "read",
        destructiveHint: spec.kind === "destructive",
        idempotentHint: spec.kind === "read" || !!spec.idempotent,
        openWorldHint: false,
      },
    },
    // The SDK's callback type is generic over the schema; the shape is validated by it.
    (async (args: z.infer<z.ZodObject<S>>) => {
      try {
        const out = await run(args);
        if (out && typeof out === "object" && "content" in out) return out as CallToolResult;
        return ok(out ?? { ok: true });
      } catch (e) {
        if (e instanceof ToolError) return fail(e.message);
        // next/navigation's redirect() throws; a tool never wants one.
        if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) {
          return fail("That action isn't available through MCP.");
        }
        console.error(`[mcp] ${name} failed`, e);
        return fail("Something went wrong running that tool.");
      }
    }) as never,
  );
}

/** A card by id or by key ("SEC-12"). */
export async function resolveCardId(ref: string): Promise<string> {
  const m = /^([A-Za-z][A-Za-z0-9]{0,9})-(\d+)$/.exec(ref.trim());
  if (m) {
    const hit = await resolveCardKey(m[1], Number(m[2]));
    if (!hit) throw new ToolError(`No card ${ref.toUpperCase()} that you can see.`);
    return hit.cardId;
  }
  return ref.trim();
}

export const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
export const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

/** Parse a YYYY-MM-DD (or full ISO) date from a tool argument. */
export function parseDate(s: string | null | undefined): string | null {
  if (s == null || s === "") return null;
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T17:00:00.000Z` : s);
  if (Number.isNaN(d.getTime())) throw new ToolError(`"${s}" isn't a date. Use YYYY-MM-DD.`);
  return d.toISOString();
}

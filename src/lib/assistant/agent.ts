import "server-only";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { runAsPrincipal } from "@/lib/principal";
import { buildMcpServer, INSTRUCTIONS } from "@/lib/mcp/server";
import { openSecret } from "@/lib/assistant/crypto";
import { describePage } from "@/lib/assistant/context";
import { DEFAULT_MODEL, ProviderError, streamChat, type ChatMessage, type ToolCall, type ToolDef, type Usage } from "@/lib/assistant/openrouter";

// The in-app assistant's loop (docs/ASSISTANT.md). It drives the same MCP tools that
// outside assistants use, but in-process: an MCP server and client joined by an
// in-memory transport, inside runAsPrincipal(), so every tool runs as the signed-in
// member with the app's own permission checks. Reads run straight away. A change
// (any tool not marked read-only) stops the loop and waits for the member to approve
// it in the panel; the next request carries the decisions and the loop carries on.

export type AgentEvent =
  | { type: "conversation"; id: string; title: string }
  | { type: "text"; delta: string }
  | { type: "tool"; id: string; name: string; title: string; args: unknown; status: "running" | "done" | "error" | "declined"; result?: string; write: boolean }
  | { type: "approval"; calls: PendingCall[] }
  | { type: "done"; usage: Usage | null }
  | { type: "error"; message: string };

export type PendingCall = { id: string; name: string; title: string; args: unknown; destructive: boolean };

type ToolMeta = { title: string; readOnly: boolean; destructive: boolean };

let catalogCache: Map<string, ToolMeta> | null = null;

/** Every tool's title and kind. The same for every member (all can write), so built once. */
export async function toolCatalog(userId: string, workspaceId: string): Promise<Map<string, ToolMeta>> {
  if (catalogCache) return catalogCache;
  return runAsPrincipal({ userId, workspaceId, tokenId: "assistant", canWrite: true }, async () => {
    const server = buildMcpServer();
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    const client = new Client({ name: "tavoro-assistant", version: "1.0.0" });
    await client.connect(b);
    try {
      catalogCache = metaOf((await client.listTools()).tools);
      return catalogCache;
    } finally {
      await client.close().catch(() => {});
      await server.close().catch(() => {});
    }
  });
}

function metaOf(tools: { name: string; title?: string; annotations?: { title?: string; readOnlyHint?: boolean; destructiveHint?: boolean } }[]) {
  return new Map<string, ToolMeta>(
    tools.map((t) => [t.name, { title: t.annotations?.title ?? t.title ?? t.name, readOnly: !!t.annotations?.readOnlyHint, destructive: !!t.annotations?.destructiveHint }]),
  );
}

const MAX_STEPS = 12;
const MAX_RESULT_CHARS = 24_000;
const HISTORY_MESSAGES = 80;
const busy = new Set<string>();

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

/** Calls in the last assistant message that have no tool result yet. */
function pendingCalls(history: ChatMessage[]): ToolCall[] {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m.role === "assistant") {
      const answered = new Set(history.slice(i + 1).flatMap((x) => (x.role === "tool" ? [x.tool_call_id] : [])));
      return (m.tool_calls ?? []).filter((c) => !answered.has(c.id));
    }
    if (m.role === "user") return [];
  }
  return [];
}

/** The tail of a long conversation, starting at a user message so tool results never
 *  arrive without the call that asked for them. */
function trimHistory(history: ChatMessage[]): ChatMessage[] {
  if (history.length <= HISTORY_MESSAGES) return history;
  let start = history.length - HISTORY_MESSAGES;
  while (start < history.length && history[start].role !== "user") start++;
  return history.slice(start);
}

function systemPrompt(o: { name: string; email: string; role: string; workspace: string; page: string }) {
  return `${INSTRUCTIONS}

You are the assistant built into Tavoro, in a panel beside the page ${o.name} (${o.email}, ${o.role.toLowerCase()} of the "${o.workspace}" workspace) has open. Today is ${new Date().toISOString().slice(0, 10)}.
${o.page}

How this panel works:
- Tools that only read run immediately. Every tool that changes something is shown to the user as an approval card, and runs only if they approve. So don't ask "shall I?" in text first: when the user wants a change, call the tool and the app asks them. If a call comes back declined, accept it and ask what they'd like instead.
- Prefer one well-formed call over several speculative ones. Look things up before changing them.
- Answer in short Markdown. Link to things with the url fields tools return, e.g. [SEC-12](url).
- You can't upload files, edit whiteboards, or change workspace settings; say so if asked.`;
}

async function save(conversationId: string, msg: ChatMessage, usage?: Usage | null) {
  await prisma.assistantMessage.create({
    data: { conversationId, role: msg.role, data: msg as unknown as Prisma.InputJsonValue, ...(usage ? { usage: usage as Prisma.InputJsonValue } : {}) },
  });
}

export async function runTurn(input: {
  userId: string;
  workspaceId: string;
  conversationId?: string;
  message?: string;
  decisions?: Record<string, "approve" | "decline">;
  path?: string;
  model?: string;
  signal: AbortSignal;
  emit: (e: AgentEvent) => void;
}) {
  const { userId, workspaceId, emit, signal } = input;
  const [connection, member] = await Promise.all([
    prisma.assistantConnection.findUnique({ where: { userId } }),
    prisma.membership.findFirst({
      where: { userId, workspaceId },
      select: { role: true, user: { select: { name: true, email: true } }, workspace: { select: { name: true, assistantEnabled: true } } },
    }),
  ]);
  if (!member) return emit({ type: "error", message: "You're not a member of this workspace." });
  if (!member.workspace.assistantEnabled) return emit({ type: "error", message: "An admin has turned the assistant off for this workspace." });
  const apiKey = connection ? openSecret(connection.keyCipher) : null;
  if (!apiKey) return emit({ type: "error", message: "Connect OpenRouter to use the assistant." });
  const model = input.model || connection?.model || DEFAULT_MODEL;

  let conversation = input.conversationId
    ? await prisma.assistantConversation.findFirst({ where: { id: input.conversationId, userId, workspaceId }, select: { id: true, title: true } })
    : null;
  if (input.conversationId && !conversation) return emit({ type: "error", message: "That conversation no longer exists." });
  if (!conversation) {
    const text = input.message?.trim() ?? "";
    const title = text.length > 60 ? `${text.slice(0, 57).trimEnd()}…` : text || "New chat";
    conversation = await prisma.assistantConversation.create({ data: { userId, workspaceId, title }, select: { id: true, title: true } });
  }
  const conversationId = conversation.id;
  emit({ type: "conversation", id: conversationId, title: conversation.title });

  if (busy.has(conversationId)) return emit({ type: "error", message: "This chat is still answering. Wait for it, or stop it first." });
  busy.add(conversationId);
  try {
    await runAsPrincipal({ userId, workspaceId, tokenId: "assistant", canWrite: true }, async () => {
      const server = buildMcpServer();
      const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
      await server.connect(serverSide);
      const client = new Client({ name: "tavoro-assistant", version: "1.0.0" });
      await client.connect(clientSide);
      try {
        const listed = (await client.listTools()).tools;
        const meta = metaOf(listed);
        const tools: ToolDef[] = listed.map((t) => ({ type: "function", function: { name: t.name, description: t.description ?? "", parameters: t.inputSchema } }));

        const execute = async (call: ToolCall): Promise<void> => {
          const m = meta.get(call.function.name);
          const args = parseArgs(call.function.arguments);
          const base = { id: call.id, name: call.function.name, title: m?.title ?? call.function.name, args, write: !m?.readOnly };
          let text: string;
          let isError = false;
          if (!m) {
            text = `There is no tool called ${call.function.name}.`;
            isError = true;
          } else {
            emit({ type: "tool", ...base, status: "running" });
            try {
              const r = await client.callTool({ name: call.function.name, arguments: args });
              isError = !!r.isError;
              text = ((r.content as { type: string; text?: string }[] | undefined) ?? []).map((c) => (c.type === "text" ? c.text : `[${c.type}]`)).join("\n");
            } catch (e) {
              isError = true;
              text = e instanceof Error ? e.message : "The tool failed.";
            }
          }
          if (text.length > MAX_RESULT_CHARS) text = `${text.slice(0, MAX_RESULT_CHARS)}\n… (cut off; ask for less, or use a more specific tool)`;
          emit({ type: "tool", ...base, status: isError ? "error" : "done", result: text.slice(0, 4000) });
          await save(conversationId, { role: "tool", tool_call_id: call.id, content: isError ? `Error: ${text}` : text });
        };
        const decline = async (call: ToolCall, why: string) => {
          const m = meta.get(call.function.name);
          emit({ type: "tool", id: call.id, name: call.function.name, title: m?.title ?? call.function.name, args: parseArgs(call.function.arguments), status: "declined", write: true });
          await save(conversationId, { role: "tool", tool_call_id: call.id, content: why });
        };

        const rows = await prisma.assistantMessage.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" }, select: { data: true } });
        const history = rows.map((r) => r.data as unknown as ChatMessage);

        // Settle what was waiting on the member: their decisions, or a new message
        // (which means they moved on without approving).
        const waiting = pendingCalls(history);
        for (const call of waiting) {
          const d = input.decisions?.[call.id];
          if (d === "approve") await execute(call);
          else await decline(call, d === "decline" ? "The user declined this action. Don't retry it unless they ask." : "The user moved on without approving this action.");
        }
        if (input.message?.trim()) await save(conversationId, { role: "user", content: input.message.trim() });
        if (!waiting.length && !input.message?.trim()) return emit({ type: "done", usage: null });

        const sys: ChatMessage = {
          role: "system",
          content: systemPrompt({
            name: member.user.name ?? member.user.email,
            email: member.user.email,
            role: member.role,
            workspace: member.workspace.name,
            page: describePage(input.path),
          }),
        };
        let total: Usage = { prompt_tokens: 0, completion_tokens: 0, cost: 0 };
        for (let step = 0; step < MAX_STEPS; step++) {
          const msgs = await prisma.assistantMessage.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" }, select: { data: true } });
          let partial = "";
          let turn;
          try {
            turn = await streamChat({
              apiKey,
              model,
              messages: [sys, ...trimHistory(msgs.map((r) => r.data as unknown as ChatMessage))],
              tools,
              signal,
              onText: (delta) => {
                partial += delta;
                emit({ type: "text", delta });
              },
            });
          } catch (e) {
            // Keep whatever the model had said before a stop or a dropped connection.
            if (partial) await save(conversationId, { role: "assistant", content: partial });
            throw e;
          }
          total = {
            prompt_tokens: (total.prompt_tokens ?? 0) + (turn.usage?.prompt_tokens ?? 0),
            completion_tokens: (total.completion_tokens ?? 0) + (turn.usage?.completion_tokens ?? 0),
            cost: (total.cost ?? 0) + (turn.usage?.cost ?? 0),
          };
          await save(conversationId, { role: "assistant", content: turn.content || null, ...(turn.toolCalls.length ? { tool_calls: turn.toolCalls } : {}) }, turn.usage);
          if (!turn.toolCalls.length) break;

          const writes: ToolCall[] = [];
          for (const call of turn.toolCalls) {
            const m = meta.get(call.function.name);
            if (m && !m.readOnly) writes.push(call);
            else await execute(call);
          }
          if (writes.length) {
            emit({
              type: "approval",
              calls: writes.map((c) => {
                const m = meta.get(c.function.name)!;
                return { id: c.id, name: c.function.name, title: m.title, args: parseArgs(c.function.arguments), destructive: m.destructive };
              }),
            });
            break;
          }
          if (step === MAX_STEPS - 1) emit({ type: "text", delta: "\n\n_I've stopped after a lot of steps. Tell me to keep going if you'd like._" });
        }
        await prisma.assistantConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
        emit({ type: "done", usage: total });
      } finally {
        await client.close().catch(() => {});
        await server.close().catch(() => {});
      }
    });
  } catch (e) {
    if (signal.aborted) return;
    if (!(e instanceof ProviderError)) console.error("[assistant] turn failed", e);
    emit({ type: "error", message: e instanceof Error ? e.message : "Something went wrong." });
  } finally {
    busy.delete(conversationId);
  }
}

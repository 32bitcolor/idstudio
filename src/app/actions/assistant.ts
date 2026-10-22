"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getActiveMembership } from "@/lib/dal";
import { currentPrincipal } from "@/lib/principal";
import { Role } from "@/generated/prisma/client";
import { DEFAULT_MODEL, listModels, RECOMMENDED_MODELS, type ChatMessage, type ModelOption } from "@/lib/assistant/openrouter";
import { toolCatalog, type PendingCall } from "@/lib/assistant/agent";

// The in-app assistant's panel and settings (docs/ASSISTANT.md). Browser only: none of
// this is reachable through MCP, so an assistant can't reconfigure itself.

async function member() {
  if (currentPrincipal()) return null;
  return getActiveMembership();
}

export async function assistantModels(): Promise<{ recommended: ModelOption[]; all: ModelOption[]; current: string } | { error: string }> {
  const m = await member();
  if (!m) return { error: "Not signed in." };
  const [all, conn] = await Promise.all([listModels(), prisma.assistantConnection.findUnique({ where: { userId: m.userId }, select: { model: true } })]);
  const byId = new Map(all.map((x) => [x.id, x]));
  return { recommended: RECOMMENDED_MODELS.flatMap((id) => byId.get(id) ?? []), all, current: conn?.model ?? DEFAULT_MODEL };
}

export async function setAssistantModel(model: string) {
  const m = await member();
  if (!m) return { error: "Not signed in." };
  const id = model.trim().slice(0, 120);
  if (!/^[\w.-]+\/[\w.:-]+$/.test(id)) return { error: "That isn't an OpenRouter model id." };
  await prisma.assistantConnection.update({ where: { userId: m.userId }, data: { model: id } }).catch(() => null);
  return { ok: true };
}

export async function disconnectAssistant() {
  const m = await member();
  if (!m) return { error: "Not signed in." };
  await prisma.assistantConnection.deleteMany({ where: { userId: m.userId } });
  revalidatePath("/settings/ai");
  return { ok: true };
}

export async function setWorkspaceAssistantEnabled(enabled: boolean) {
  const m = await member();
  if (!m || m.role !== Role.ADMIN) return { error: "Only admins can change this." };
  await prisma.workspace.update({ where: { id: m.workspaceId }, data: { assistantEnabled: enabled } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function listAssistantConversations() {
  const m = await member();
  if (!m) return [];
  return prisma.assistantConversation.findMany({
    where: { userId: m.userId, workspaceId: m.workspaceId },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, title: true, updatedAt: true },
  });
}

export async function deleteAssistantConversation(id: string) {
  const m = await member();
  if (!m) return { error: "Not signed in." };
  await prisma.assistantConversation.deleteMany({ where: { id, userId: m.userId } });
  return { ok: true };
}

export type ChatItem =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "tool"; id: string; name: string; title: string; args: unknown; status: "running" | "done" | "error" | "declined"; result?: string; write: boolean };

/** A saved conversation as the panel shows it, plus any change still awaiting approval. */
export async function loadAssistantConversation(id: string): Promise<{ items: ChatItem[]; pending: PendingCall[] } | { error: string }> {
  const m = await member();
  if (!m) return { error: "Not signed in." };
  const conv = await prisma.assistantConversation.findFirst({
    where: { id, userId: m.userId, workspaceId: m.workspaceId },
    select: { messages: { orderBy: { createdAt: "asc" }, select: { data: true } } },
  });
  if (!conv) return { error: "That conversation no longer exists." };
  const catalog = await toolCatalog(m.userId, m.workspaceId);
  const msgs = conv.messages.map((x) => x.data as unknown as ChatMessage);
  const results = new Map<string, string>();
  for (const x of msgs) if (x.role === "tool") results.set(x.tool_call_id, x.content);

  const items: ChatItem[] = [];
  let pending: PendingCall[] = [];
  for (const x of msgs) {
    if (x.role === "user") items.push({ kind: "user", text: x.content });
    if (x.role !== "assistant") continue;
    if (x.content) items.push({ kind: "assistant", text: x.content });
    const open: PendingCall[] = [];
    for (const c of x.tool_calls ?? []) {
      const meta = catalog.get(c.function.name);
      let args: unknown = {};
      try {
        args = JSON.parse(c.function.arguments || "{}");
      } catch {}
      const result = results.get(c.id);
      const title = meta?.title ?? c.function.name;
      if (result === undefined) {
        open.push({ id: c.id, name: c.function.name, title, args, destructive: !!meta?.destructive });
        continue;
      }
      const status = /^The user (declined|moved on)/.test(result) ? "declined" : result.startsWith("Error:") ? "error" : "done";
      items.push({ kind: "tool", id: c.id, name: c.function.name, title, args, status, result: result.slice(0, 4000), write: !meta?.readOnly });
    }
    pending = open;
  }
  return { items, pending };
}

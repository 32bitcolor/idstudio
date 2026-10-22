import { prisma } from "@/lib/db";
import { getActiveMembership, requireUser } from "@/lib/dal";
import { appUrl } from "@/lib/app-url";
import { Role } from "@/generated/prisma/client";
import { AiSettings, type ConnectionRow } from "@/components/settings/ai-settings";
import { AssistantSettings } from "@/components/settings/assistant-settings";
import { openSecret } from "@/lib/assistant/crypto";
import { DEFAULT_MODEL, keyInfo } from "@/lib/assistant/openrouter";

export const metadata = { title: "AI & MCP · Tavoro" };

const SELECT = {
  id: true,
  name: true,
  kind: true,
  scope: true,
  prefix: true,
  createdAt: true,
  lastUsedAt: true,
  expiresAt: true,
  refreshExpiresAt: true,
  user: { select: { id: true, name: true, email: true } },
} as const;

export default async function AiSettingsPage() {
  const me = await requireUser();
  const membership = (await getActiveMembership())!;
  const isAdmin = membership.role === Role.ADMIN;
  const now = new Date();
  // A live connection: not revoked, and either unexpired or (OAuth) still renewable.
  const live = {
    workspaceId: membership.workspaceId,
    revokedAt: null,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }, { kind: "oauth", refreshExpiresAt: { gt: now } }],
  };
  const rows = await prisma.apiToken.findMany({
    where: isAdmin ? live : { ...live, userId: me.id },
    orderBy: { createdAt: "desc" },
    select: SELECT,
  });
  const toRow = (r: (typeof rows)[number]): ConnectionRow => ({
    id: r.id,
    name: r.name,
    kind: r.kind === "oauth" ? "oauth" : "personal",
    access: r.scope === "read write" ? "Read and change" : "Read only",
    prefix: r.kind === "oauth" ? null : r.prefix,
    createdAt: r.createdAt.toISOString(),
    lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
    expiresAt: r.kind === "oauth" ? null : (r.expiresAt?.toISOString() ?? null),
    owner: r.user.id === me.id ? null : (r.user.name ?? r.user.email),
  });
  const assistant = await prisma.assistantConnection.findUnique({ where: { userId: me.id } });
  const key = assistant ? openSecret(assistant.keyCipher) : null;
  const info = key ? await keyInfo(key) : null;
  return (
    <div className="flex flex-col gap-8">
      <AssistantSettings
        enabled={membership.workspace.assistantEnabled}
        isAdmin={isAdmin}
        connection={
          assistant
            ? {
                keyHint: assistant.keyHint,
                model: assistant.model ?? DEFAULT_MODEL,
                connectedAt: assistant.createdAt.toISOString(),
                usage: info?.usage ?? null,
                limitRemaining: info?.limitRemaining ?? null,
              }
            : null
        }
      />
      <AiSettings
      mcpUrl={appUrl("/api/mcp") ?? "/api/mcp"}
      workspaceName={membership.workspace.name}
      mine={rows.filter((r) => r.user.id === me.id).map(toRow)}
      others={isAdmin ? rows.filter((r) => r.user.id !== me.id).map(toRow) : null}
      />
    </div>
  );
}

import { getCurrentUser, getActiveMembership } from "@/lib/dal";
import { exportWorkspace } from "@/lib/workspace-backup";
import { zipSync, strToU8 } from "fflate";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const membership = await getActiveMembership();
  if (!membership || membership.role !== "ADMIN") return new Response("Forbidden", { status: 403 });

  const { json, media } = await exportWorkspace(membership.workspaceId);

  const files: Record<string, Uint8Array> = { "backup.json": strToU8(JSON.stringify(json)) };
  for (const [id, bytes] of Object.entries(media)) files[`media/${id}`] = bytes;
  const zip = zipSync(files, { level: 6 });

  const filename = `idstudio-${json.workspace.slug}-${json.exportedAt.slice(0, 10)}.zip`;
  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

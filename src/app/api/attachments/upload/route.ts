import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { getCardForUser } from "@/lib/authz";
import { buildObjectKey, putObjectBytes, MAX_UPLOAD_BYTES } from "@/lib/storage";

// Uploads stream THROUGH the app to MinIO (server-side PutObject) rather than the
// browser PUT-ing to a presigned MinIO URL directly. That URL points at MinIO's
// own endpoint, which the browser can't reach over the public tunnel and which
// is plain-HTTP on the LAN (blocked as mixed content from the HTTPS app). Routing
// through the app keeps everything on the same HTTPS origin.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });

  const form = await req.formData();
  const cardId = String(form.get("cardId") ?? "");
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file provided." }, { status: 400 });

  const card = await getCardForUser(cardId);
  if (!card) return Response.json({ error: "Card not found." }, { status: 404 });
  const board = await prisma.board.findUnique({ where: { id: card.boardId }, select: { workspaceId: true } });
  if (!board) return Response.json({ error: "Board not found." }, { status: 404 });

  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: "File exceeds the 25 MB limit." }, { status: 400 });
  }
  const name = z.string().trim().min(1).max(255).safeParse(file.name);
  if (!name.success) return Response.json({ error: "Invalid file name." }, { status: 400 });

  const contentType = file.type || "application/octet-stream";
  const key = buildObjectKey(board.workspaceId, cardId, name.data);
  await putObjectBytes(key, new Uint8Array(await file.arrayBuffer()), contentType);

  const att = await prisma.attachment.create({
    data: {
      cardId,
      workspaceId: board.workspaceId,
      fileName: name.data.slice(0, 255),
      mimeType: contentType,
      sizeBytes: file.size,
      storageKey: key,
      uploadedById: user.id,
    },
    select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true },
  });
  revalidatePath(`/boards/${card.boardId}`);
  return Response.json({ attachment: { ...att, createdAt: att.createdAt.toISOString() } });
}

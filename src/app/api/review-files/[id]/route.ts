import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { getDeliverableForUser } from "@/lib/authz";
import { serveReviewFile } from "@/lib/review-files";

// A review file, for members: readable by anyone who can see its deliverable.
// Guests read theirs through /review/g/<guestId>/file instead.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const file = await prisma.reviewFile.findUnique({
    where: { id },
    select: { storageKey: true, fileName: true, mimeType: true, sizeBytes: true, deliverableId: true },
  });
  if (!file || !(await getDeliverableForUser(file.deliverableId))) return new Response("Not found", { status: 404 });
  return serveReviewFile(req, file);
}

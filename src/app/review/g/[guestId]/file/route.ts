import { prisma } from "@/lib/db";
import { getGuestSession } from "@/lib/review-guest";
import { serveReviewFile } from "@/lib/review-files";

// The file under review, for a guest: only the one attached to their own round. The
// guest cookie is scoped to /review/g/<guestId>, so it's sent with this request too.
export async function GET(req: Request, { params }: { params: Promise<{ guestId: string }> }) {
  const { guestId } = await params;
  const result = await getGuestSession(guestId);
  if ("blocked" in result) return new Response("Not found", { status: 404 });
  const round = await prisma.reviewRound.findUnique({
    where: { id: result.session.roundId },
    select: { file: { select: { storageKey: true, fileName: true, mimeType: true, sizeBytes: true } } },
  });
  if (!round?.file) return new Response("Not found", { status: 404 });
  return serveReviewFile(req, round.file);
}

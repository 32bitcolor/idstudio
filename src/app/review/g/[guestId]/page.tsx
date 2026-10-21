import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getGuestSession } from "@/lib/review-guest";
import { diffSnapshots, parseSnapshot } from "@/lib/review-snapshot";
import { COMMENT_SELECT, memberName, toCommentDTO } from "@/lib/review-comments";
import { ReviewRoundView } from "@/components/review/review-round-view";

// A guest's review page. Everything here is reached through the guest's session, which
// names exactly one round — no authz.ts, no workspace lists, no member emails.

export default async function GuestReviewPage({ params }: { params: Promise<{ guestId: string }> }) {
  const { guestId } = await params;
  const result = await getGuestSession(guestId);
  if ("blocked" in result) redirect(`/review/unavailable?reason=${result.blocked}`);
  const s = result.session;

  // Opening the page counts as starting the review.
  if (s.canDecide && s.status === "requested") {
    await prisma.reviewCycle.update({ where: { id: s.assignmentId }, data: { status: "in_review" } });
  }

  const round = await prisma.reviewRound.findUniqueOrThrow({
    where: { id: s.roundId },
    select: {
      id: true,
      number: true,
      snapshot: true,
      file: { select: { id: true, fileName: true, mimeType: true } },
      dueDate: true,
      outcome: true,
      overriddenAt: true,
      createdBy: { select: { name: true, email: true } },
      deliverable: {
        select: {
          id: true,
          name: true,
          storyboard: { select: { id: true } },
          project: { select: { id: true, name: true } },
        },
      },
      assignments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          status: true,
          feedback: true,
          decidedAt: true,
          reviewer: { select: { id: true, name: true, email: true } },
          guest: { select: { id: true, name: true } },
        },
      },
      comments: { orderBy: { createdAt: "asc" }, select: COMMENT_SELECT },
    },
  });

  const previous = await prisma.reviewRound.findFirst({
    where: { deliverableId: s.deliverableId, number: { lt: round.number } },
    orderBy: { number: "desc" },
    select: { number: true, snapshot: true, fileId: true, file: { select: { fileName: true } } },
  });
  const snapshot = parseSnapshot(round.snapshot);
  const prevSnapshot = previous ? parseSnapshot(previous.snapshot) : null;
  const diff = snapshot && prevSnapshot ? diffSnapshots(prevSnapshot, snapshot) : null;

  return (
    <ReviewRoundView
      viewer={{
        kind: "guest",
        id: s.guestId,
        name: s.name,
        canComment: s.canComment,
        canDecide: s.canDecide,
        superseded: s.superseded,
        closed: s.closed,
        expiresAt: s.expiresAt.toISOString(),
      }}
      members={[]}
      round={{
        id: round.id,
        number: round.number,
        dueDate: round.dueDate ? round.dueDate.toISOString() : null,
        outcome: round.outcome,
        // Who overrode, and why, is the team's business; the guest just sees the outcome.
        overridden: null,
        requestedBy: round.createdBy ? memberName(round.createdBy, "guest") : null,
        file: round.file ? { url: `/review/g/${s.guestId}/file`, fileName: round.file.fileName, mimeType: round.file.mimeType } : null,
        previousFile:
          round.file && previous?.file
            ? { number: previous.number, fileName: previous.file.fileName, same: previous.fileId === round.file.id }
            : null,
        hasStoryboardNow: false,
      }}
      deliverable={{ id: round.deliverable.id, name: round.deliverable.name }}
      project={{ id: round.deliverable.project.id, name: round.deliverable.project.name }}
      assignments={round.assignments.map((a) => ({
        id: a.id,
        status: a.status,
        feedback: a.feedback,
        decidedAt: a.decidedAt ? a.decidedAt.toISOString() : null,
        reviewer: a.reviewer ? { id: a.reviewer.id, name: memberName(a.reviewer, "guest") } : null,
        guest: a.guest ? { id: a.guest.id, name: a.guest.name, email: null, link: null } : null,
      }))}
      snapshot={snapshot}
      previousNumber={previous && prevSnapshot ? previous.number : null}
      diff={diff}
      initialComments={round.comments.map((c) => toCommentDTO(c, "guest"))}
    />
  );
}

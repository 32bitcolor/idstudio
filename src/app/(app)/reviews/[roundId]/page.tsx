import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { getReviewRoundForUser, isElevatedInWorkspace } from "@/lib/authz";
import { diffSnapshots, parseSnapshot } from "@/lib/review-snapshot";
import { COMMENT_SELECT, toCommentDTO } from "@/lib/review-comments";
import { ReviewRoundView } from "@/components/review/review-round-view";

export const metadata = { title: "Review · IDStudio" };

export default async function ReviewRoundPage({
  params,
  searchParams,
}: {
  params: Promise<{ roundId: string }>;
  searchParams: Promise<{ thread?: string }>;
}) {
  const { roundId } = await params;
  const { thread } = await searchParams;
  const access = await getReviewRoundForUser(roundId);
  if (!access) notFound();
  const me = await getCurrentUser();
  if (!me) notFound();

  const round = await prisma.reviewRound.findUniqueOrThrow({
    where: { id: roundId },
    select: {
      id: true,
      number: true,
      targetKind: true,
      snapshot: true,
      file: { select: { id: true, fileName: true, mimeType: true } },
      dueDate: true,
      outcome: true,
      closedAt: true,
      overriddenAt: true,
      overrideReason: true,
      createdAt: true,
      overriddenBy: { select: { name: true, email: true } },
      createdBy: { select: { name: true, email: true } },
      deliverable: {
        select: {
          id: true,
          name: true,
          storyboard: { select: { id: true } },
          project: { select: { id: true, name: true, workspaceId: true } },
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
          guest: { select: { id: true, name: true, email: true, lastSeenAt: true, expiresAt: true, revokedAt: true } },
        },
      },
      comments: { orderBy: { createdAt: "asc" }, select: COMMENT_SELECT },
    },
  });

  const [previous, members, elevated] = await Promise.all([
    prisma.reviewRound.findFirst({
      where: { deliverableId: access.deliverableId, number: { lt: round.number } },
      orderBy: { number: "desc" },
      select: { number: true, snapshot: true, fileId: true, file: { select: { fileName: true } } },
    }),
    prisma.user.findMany({
      where: { memberships: { some: { workspaceId: round.deliverable.project.workspaceId } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    isElevatedInWorkspace(round.deliverable.project.workspaceId),
  ]);

  const snapshot = parseSnapshot(round.snapshot);
  const prevSnapshot = previous ? parseSnapshot(previous.snapshot) : null;
  const diff = snapshot && prevSnapshot ? diffSnapshots(prevSnapshot, snapshot) : null;

  return (
    <ReviewRoundView
      viewer={{ kind: "member", id: me.id, canModerate: elevated }}
      members={members}
      round={{
        id: round.id,
        number: round.number,
        dueDate: round.dueDate ? round.dueDate.toISOString() : null,
        outcome: round.outcome,
        overridden: round.overriddenAt
          ? {
              by: round.overriddenBy ? round.overriddenBy.name ?? round.overriddenBy.email : "Someone",
              at: round.overriddenAt.toISOString(),
              reason: round.overrideReason ?? "",
            }
          : null,
        requestedBy: round.createdBy ? round.createdBy.name ?? round.createdBy.email : null,
        file: round.file ? { url: `/api/review-files/${round.file.id}`, fileName: round.file.fileName, mimeType: round.file.mimeType } : null,
        previousFile:
          round.file && previous?.file
            ? { number: previous.number, fileName: previous.file.fileName, same: previous.fileId === round.file.id }
            : null,
        hasStoryboardNow: !!round.deliverable.storyboard,
      }}
      deliverable={{ id: round.deliverable.id, name: round.deliverable.name }}
      project={{ id: round.deliverable.project.id, name: round.deliverable.project.name }}
      assignments={round.assignments.map((a) => ({
        id: a.id,
        status: a.status,
        feedback: a.feedback,
        decidedAt: a.decidedAt ? a.decidedAt.toISOString() : null,
        reviewer: a.reviewer ? { id: a.reviewer.id, name: a.reviewer.name ?? a.reviewer.email } : null,
        guest: a.guest
          ? {
              id: a.guest.id,
              name: a.guest.name,
              email: a.guest.email,
              link: {
                lastSeenAt: a.guest.lastSeenAt ? a.guest.lastSeenAt.toISOString() : null,
                expiresAt: a.guest.expiresAt.toISOString(),
                revoked: !!a.guest.revokedAt,
              },
            }
          : null,
      }))}
      snapshot={snapshot}
      previousNumber={previous && prevSnapshot ? previous.number : null}
      diff={diff}
      initialComments={round.comments.map((c) => toCommentDTO(c, "member"))}
      focusThread={typeof thread === "string" ? thread : null}
    />
  );
}

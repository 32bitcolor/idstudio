"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/dal";
import {
  getDeliverableForUser,
  getReviewForUser,
  getReviewRoundForUser,
  getReviewCommentForUser,
  isElevatedInWorkspace,
} from "@/lib/authz";
import { REVIEW_STATUSES, isDecided } from "@/lib/methodology";
import { enqueueEmail } from "@/lib/queues";
import { reviewRequested, guestReviewInvite, mentioned, withLink } from "@/lib/email-templates";
import { notificationsEnabled } from "@/lib/notify";
import { appUrl } from "@/lib/app-url";
import { buildSnapshot } from "@/lib/review-snapshot";
import { notifyReviewDecided, syncRoundOutcome } from "@/lib/review-rounds";
import { createRoundComment, toCommentDTO, COMMENT_SELECT } from "@/lib/review-comments";
import { guestExpiry, guestLinkPath, newGuestNonce } from "@/lib/review-guest-token";
import { deleteObject } from "@/lib/storage";
import { extractMentionIds, extractText } from "@/lib/mentions";

function fmtDate(d: Date | null): string | null {
  return d ? d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : null;
}

// Review changes surface in the personal "My Work" hub too — refresh the whole
// /my-work subtree (Overview + Review History), the project page, the round's own
// page, and the root layout (the header's "awaiting your review" notification badge).
function revalidateReview(projectId: string, roundId?: string) {
  revalidatePath(`/projects/${projectId}`);
  if (roundId) revalidatePath(`/reviews/${roundId}`);
  revalidatePath("/my-work", "layout");
  revalidatePath("/", "layout");
}

// ── Reviewers: members and guests ────────────────────────────────────────────

const GuestInput = z.object({
  name: z.string().trim().min(1, "Give each guest a name.").max(120),
  email: z.string().trim().toLowerCase().email("One of the guest emails isn't valid.").max(254),
});
const ReviewersInput = z.object({
  memberIds: z.array(z.string().min(1)).max(20),
  guests: z.array(GuestInput).max(20),
});
export type ReviewersInput = z.input<typeof ReviewersInput>;

/** Validate reviewers against the workspace. A "guest" whose email belongs to a
 *  workspace member is quietly treated as that member — they have an account. */
async function resolveReviewers(workspaceId: string, raw: unknown) {
  const parsed = ReviewersInput.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid reviewers." } as const;
  const memberIds = new Set(parsed.data.memberIds);
  const guestsByEmail = new Map(parsed.data.guests.map((g) => [g.email, g]));

  if (guestsByEmail.size) {
    const existing = await prisma.user.findMany({
      where: { email: { in: [...guestsByEmail.keys()], mode: "insensitive" }, memberships: { some: { workspaceId } } },
      select: { id: true, email: true },
    });
    for (const u of existing) {
      memberIds.add(u.id);
      guestsByEmail.delete(u.email.toLowerCase());
    }
  }
  if (memberIds.size) {
    const ok = await prisma.membership.count({ where: { userId: { in: [...memberIds] }, workspaceId } });
    if (ok !== memberIds.size) return { error: "Every member reviewer must belong to this workspace." } as const;
  }
  if (memberIds.size + guestsByEmail.size === 0) return { error: "Add at least one reviewer." } as const;
  if (memberIds.size + guestsByEmail.size > 20) return { error: "Too many reviewers." } as const;
  return { memberIds: [...memberIds], guests: [...guestsByEmail.values()] } as const;
}

/** Email a guest their personal link. */
async function sendGuestInvite(guestId: string, requesterName: string) {
  const g = await prisma.reviewGuest.findUnique({
    where: { id: guestId },
    select: {
      id: true,
      name: true,
      email: true,
      nonce: true,
      expiresAt: true,
      assignment: {
        select: {
          reviewRound: {
            select: {
              number: true,
              dueDate: true,
              deliverable: { select: { name: true, project: { select: { workspace: { select: { id: true, name: true } } } } } },
            },
          },
        },
      },
    },
  });
  if (!g?.assignment) return;
  const round = g.assignment.reviewRound;
  const ws = round.deliverable.project.workspace;
  if (!(await notificationsEnabled(ws.id, "review"))) return;
  await enqueueEmail({
    to: g.email,
    ...withLink(
      guestReviewInvite({
        guestName: g.name,
        requesterName,
        deliverableName: round.deliverable.name,
        workspaceName: ws.name,
        roundNumber: round.number,
        dueDate: fmtDate(round.dueDate),
        expires: fmtDate(g.expiresAt)!,
      }),
      appUrl(guestLinkPath(g)),
      "Open the review →",
    ),
  });
}

async function sendMemberInvite(
  reviewer: { id: string; name: string | null; email: string },
  me: { id: string; name: string | null; email: string },
  meta: { roundId: string; deliverableName: string; projectName: string; workspaceId: string; dueDate: Date | null },
) {
  if (!reviewer.email || reviewer.id === me.id) return;
  if (!(await notificationsEnabled(meta.workspaceId, "review"))) return;
  await enqueueEmail({
    to: reviewer.email,
    ...withLink(
      reviewRequested({
        reviewerName: reviewer.name ?? reviewer.email,
        deliverableName: meta.deliverableName,
        projectName: meta.projectName,
        requesterName: me.name ?? me.email,
        dueDate: fmtDate(meta.dueDate),
      }),
      appUrl(`/reviews/${meta.roundId}`),
    ),
  });
}

// ── Rounds ────────────────────────────────────────────────────────────────────

/** What a round reviews: the linked storyboard (frozen into a snapshot), or an uploaded
 *  PDF/image. Without a target, the storyboard if there is one. */
export type RoundTarget = { kind: "storyboard" } | { kind: "file"; fileId: string };

/** Start the next review round on a deliverable: freeze what's being reviewed (the
 *  linked storyboard, or an uploaded file), assign members and/or guests, and email
 *  each of them. Guests get a fresh personal link per round; earlier rounds' links go
 *  read-only. */
export async function startReviewRound(
  deliverableId: string,
  reviewers: ReviewersInput,
  dueIso: string | null,
  target?: RoundTarget,
) {
  const me = await getCurrentUser();
  if (!me) return { error: "Not signed in." };
  const d = await getDeliverableForUser(deliverableId);
  if (!d) return { error: "Deliverable not found." };

  const project = await prisma.project.findUnique({ where: { id: d.projectId }, select: { workspaceId: true, name: true } });
  if (!project) return { error: "Project not found." };
  const who = await resolveReviewers(project.workspaceId, reviewers);
  if ("error" in who) return { error: who.error };

  const dueDate = dueIso ? new Date(dueIso) : null;
  if (dueIso && Number.isNaN(dueDate!.getTime())) return { error: "Invalid date." };

  // Freeze the linked storyboard (screens in order) — comments anchor to this copy.
  const storyboard = await prisma.storyboard.findUnique({
    where: { deliverableId },
    select: {
      id: true,
      title: true,
      screens: {
        orderBy: { position: "asc" },
        select: {
          id: true, title: true, screenType: true,
          onScreenText: true, narration: true, visualNotes: true, interactionNotes: true, developerNotes: true,
        },
      },
    },
  });
  let fileId: string | null = null;
  if (target?.kind === "file") {
    const file = await prisma.reviewFile.findFirst({ where: { id: target.fileId, deliverableId }, select: { id: true } });
    if (!file) return { error: "That file isn't attached to this deliverable — upload it again." };
    fileId = file.id;
  } else if (target?.kind === "storyboard" && !storyboard) {
    return { error: "This deliverable has no storyboard to review." };
  }
  const snapshot = !fileId && storyboard ? buildSnapshot(storyboard) : null;
  const expiresAt = guestExpiry(dueDate);

  // Next number + insert atomically under Serializable isolation, so two concurrent
  // requests can't mint the same round.
  let round;
  try {
    round = await prisma.$transaction(
      async (tx) => {
        const last = await tx.reviewRound.findFirst({
          where: { deliverableId },
          orderBy: { number: "desc" },
          select: { number: true },
        });
        const number = (last?.number ?? 0) + 1;
        const created = await tx.reviewRound.create({
          data: {
            deliverableId,
            number,
            targetKind: fileId ? "file" : snapshot ? "storyboard" : "none",
            snapshot: snapshot ?? Prisma.JsonNull,
            fileId,
            dueDate,
            createdById: me.id,
            assignments: {
              create: who.memberIds.map((reviewerId) => ({ deliverableId, reviewerId, requestedById: me.id, round: number, dueDate })),
            },
          },
          select: { id: true, number: true },
        });
        const guestIds: string[] = [];
        for (const g of who.guests) {
          const guest = await tx.reviewGuest.create({
            data: {
              name: g.name,
              email: g.email,
              nonce: newGuestNonce(),
              expiresAt,
              assignment: { create: { deliverableId, roundId: created.id, requestedById: me.id, round: number, dueDate } },
            },
            select: { id: true },
          });
          guestIds.push(guest.id);
        }
        return { ...created, guestIds };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch {
    return { error: "Couldn't start the review — please try again." };
  }
  revalidateReview(d.projectId, round.id);

  const deliverable = await prisma.deliverable.findUnique({ where: { id: deliverableId }, select: { name: true } });
  const members = await prisma.user.findMany({ where: { id: { in: [...who.memberIds] } }, select: { id: true, name: true, email: true } });
  for (const reviewer of members) {
    await sendMemberInvite(reviewer, me, {
      roundId: round.id,
      deliverableName: deliverable?.name ?? "",
      projectName: project.name,
      workspaceId: project.workspaceId,
      dueDate,
    });
  }
  for (const guestId of round.guestIds) await sendGuestInvite(guestId, me.name ?? me.email);

  return { roundId: round.id, number: round.number };
}

/** Add another reviewer — a member or a guest — to an open round. */
export async function addRoundReviewer(roundId: string, reviewer: { memberId: string } | { guest: { name: string; email: string } }) {
  const me = await getCurrentUser();
  if (!me) return { error: "Not signed in." };
  const r = await getReviewRoundForUser(roundId);
  if (!r) return { error: "Review round not found." };
  const round = await prisma.reviewRound.findUnique({
    where: { id: roundId },
    select: { outcome: true, dueDate: true, deliverable: { select: { name: true, project: { select: { name: true } } } } },
  });
  if (!round || round.outcome) return { error: "This round is closed — start a new round instead." };
  const workspaceId = r.deliverable.project.workspaceId;
  const who = await resolveReviewers(workspaceId, {
    memberIds: "memberId" in reviewer ? [reviewer.memberId] : [],
    guests: "guest" in reviewer ? [reviewer.guest] : [],
  });
  if ("error" in who) return { error: who.error };

  const base = { deliverableId: r.deliverableId, roundId, requestedById: me.id, round: r.number, dueDate: round.dueDate };
  try {
    if (who.memberIds.length) {
      await prisma.reviewCycle.create({ data: { ...base, reviewerId: who.memberIds[0] } });
      const u = await prisma.user.findUnique({ where: { id: who.memberIds[0] }, select: { id: true, name: true, email: true } });
      if (u) {
        await sendMemberInvite(u, me, {
          roundId,
          deliverableName: round.deliverable.name,
          projectName: round.deliverable.project.name,
          workspaceId,
          dueDate: round.dueDate,
        });
      }
    } else {
      const g = who.guests[0];
      const dupe = await prisma.reviewCycle.findFirst({ where: { roundId, guest: { email: g.email } }, select: { id: true } });
      if (dupe) return { error: "They're already reviewing this round." };
      const guest = await prisma.reviewGuest.create({
        data: { name: g.name, email: g.email, nonce: newGuestNonce(), expiresAt: guestExpiry(round.dueDate), assignment: { create: base } },
        select: { id: true },
      });
      await sendGuestInvite(guest.id, me.name ?? me.email);
    }
  } catch {
    return { error: "They're already reviewing this round." };
  }
  // A new, undecided reviewer reopens a round that was waiting on nobody.
  await syncRoundOutcome(roundId);
  revalidateReview(r.deliverable.projectId, roundId);
}

/** ADMIN/MANAGER only: pass a round without every approval (e.g. an SME went silent).
 *  The reason is required and recorded; reviewers' own decisions are left as they are. */
export async function overrideReviewRound(roundId: string, reason: string) {
  const me = await getCurrentUser();
  if (!me) return { error: "Not signed in." };
  const r = await getReviewRoundForUser(roundId);
  if (!r) return { error: "Review round not found." };
  if (!(await isElevatedInWorkspace(r.deliverable.project.workspaceId))) {
    return { error: "Only admins and managers can override a review." };
  }
  const why = z.string().trim().min(3).max(1000).safeParse(reason);
  if (!why.success) return { error: "Give a short reason for the override." };
  const round = await prisma.reviewRound.findUnique({ where: { id: roundId }, select: { outcome: true } });
  if (round?.outcome === "passed") return { error: "This round has already passed." };

  await prisma.reviewRound.update({
    where: { id: roundId },
    data: { outcome: "passed", closedAt: new Date(), overriddenById: me.id, overriddenAt: new Date(), overrideReason: why.data },
  });
  revalidateReview(r.deliverable.projectId, roundId);
}

export async function deleteReviewRound(roundId: string) {
  const r = await getReviewRoundForUser(roundId);
  if (!r) return { error: "Review round not found." };
  const guests = await prisma.reviewCycle.findMany({ where: { roundId, guestId: { not: null } }, select: { guestId: true } });
  const round = await prisma.reviewRound.delete({ where: { id: roundId }, select: { fileId: true } });
  // Their assignments and comments are gone with the round; the credentials go too.
  await prisma.reviewGuest.deleteMany({ where: { id: { in: guests.map((g) => g.guestId!) } } });
  if (round.fileId) await deleteFileIfUnused(round.fileId);
  revalidateReview(r.deliverable.projectId);
}

/** A file no round reviews any more (round deleted, or uploaded then abandoned). */
async function deleteFileIfUnused(fileId: string) {
  const file = await prisma.reviewFile.findUnique({
    where: { id: fileId },
    select: { storageKey: true, _count: { select: { rounds: true } } },
  });
  if (!file || file._count.rounds > 0) return;
  await prisma.reviewFile.delete({ where: { id: fileId } });
  await deleteObject(file.storageKey);
}

/** Throw away an uploaded file that never made it into a round (the designer picked
 *  another file, or cancelled). Files a round already reviews are kept. */
export async function discardReviewFile(fileId: string) {
  const file = await prisma.reviewFile.findUnique({ where: { id: fileId }, select: { deliverableId: true } });
  if (!file || !(await getDeliverableForUser(file.deliverableId))) return { error: "File not found." };
  await deleteFileIfUnused(fileId);
}

// ── One reviewer's assignment ────────────────────────────────────────────────

/** A member's own decision. Guests decide from their link (actions/review-guest.ts) —
 *  nobody can decide on a guest's behalf. */
export async function setReviewStatus(reviewId: string, status: string) {
  const me = await getCurrentUser();
  if (!me) return { error: "Not signed in." };
  const r = await getReviewForUser(reviewId);
  if (!r) return { error: "Review not found." };
  if (r.guestId) return { error: "Guests decide from their own review link." };
  const parsed = z.enum(REVIEW_STATUSES).safeParse(status);
  if (!parsed.success) return { error: "Invalid status." };
  const decided = isDecided(parsed.data);
  await prisma.reviewCycle.update({
    where: { id: reviewId },
    data: { status: parsed.data, decidedAt: decided ? new Date() : null },
  });
  await syncRoundOutcome(r.roundId);
  revalidateReview(r.deliverable.projectId, r.roundId);
  if (decided) await notifyReviewDecided(reviewId, me.id);
}

export async function setReviewFeedback(reviewId: string, feedback: string) {
  const r = await getReviewForUser(reviewId);
  if (!r) return { error: "Review not found." };
  if (r.guestId) return { error: "Guests write their own summary." };
  await prisma.reviewCycle.update({
    where: { id: reviewId },
    data: { feedback: feedback.trim() ? feedback.slice(0, 5000) : null },
  });
  revalidateReview(r.deliverable.projectId, r.roundId);
}

export async function setReviewDue(reviewId: string, dueIso: string | null) {
  const r = await getReviewForUser(reviewId);
  if (!r) return { error: "Review not found." };
  const dueDate = dueIso ? new Date(dueIso) : null;
  if (dueIso && Number.isNaN(dueDate!.getTime())) return { error: "Invalid date." };
  await prisma.reviewCycle.update({ where: { id: reviewId }, data: { dueDate } });
  revalidateReview(r.deliverable.projectId, r.roundId);
}

/** Remove one reviewer from a round; removing the last one removes the round. A guest's
 *  link is revoked, not deleted, so their comments keep their name. */
export async function deleteReviewCycle(reviewId: string) {
  const r = await getReviewForUser(reviewId);
  if (!r) return { error: "Review not found." };
  await prisma.reviewCycle.delete({ where: { id: reviewId } });
  if (r.guestId) await prisma.reviewGuest.update({ where: { id: r.guestId }, data: { revokedAt: new Date() } });
  const left = await prisma.reviewCycle.count({ where: { roundId: r.roundId } });
  if (left === 0) {
    await deleteReviewRound(r.roundId);
    return;
  }
  await syncRoundOutcome(r.roundId);
  revalidateReview(r.deliverable.projectId, r.roundId);
}

// ── Guest links (managed by members) ─────────────────────────────────────────

async function guestAssignment(reviewId: string) {
  const r = await getReviewForUser(reviewId);
  if (!r?.guestId) return null;
  const guest = await prisma.reviewGuest.findUnique({ where: { id: r.guestId }, select: { id: true, nonce: true } });
  return guest ? { r, guest } : null;
}

/** The guest's current link, for pasting into chat or email by hand. */
export async function getGuestLink(reviewId: string) {
  const a = await guestAssignment(reviewId);
  if (!a) return { error: "Guest not found." };
  const path = guestLinkPath(a.guest);
  return { url: appUrl(path) ?? path };
}

/** Issue a new link: the old one stops working at once. Also clears a revoke and
 *  restarts the expiry clock, so it doubles as "extend". Emails the new link. */
export async function resetGuestLink(reviewId: string) {
  const me = await getCurrentUser();
  if (!me) return { error: "Not signed in." };
  const a = await guestAssignment(reviewId);
  if (!a) return { error: "Guest not found." };
  const round = await prisma.reviewRound.findUnique({ where: { id: a.r.roundId }, select: { dueDate: true } });
  const guest = await prisma.reviewGuest.update({
    where: { id: a.guest.id },
    data: { nonce: newGuestNonce(), revokedAt: null, expiresAt: guestExpiry(round?.dueDate ?? null) },
    select: { id: true, nonce: true },
  });
  await sendGuestInvite(guest.id, me.name ?? me.email);
  revalidatePath(`/reviews/${a.r.roundId}`);
  const path = guestLinkPath(guest);
  return { url: appUrl(path) ?? path };
}

export async function revokeGuestLink(reviewId: string) {
  const a = await guestAssignment(reviewId);
  if (!a) return { error: "Guest not found." };
  await prisma.reviewGuest.update({ where: { id: a.guest.id }, data: { revokedAt: new Date() } });
  revalidatePath(`/reviews/${a.r.roundId}`);
}

export async function resendGuestInvite(reviewId: string) {
  const me = await getCurrentUser();
  if (!me) return { error: "Not signed in." };
  const a = await guestAssignment(reviewId);
  if (!a) return { error: "Guest not found." };
  await sendGuestInvite(a.guest.id, me.name ?? me.email);
}

// ── Comments ─────────────────────────────────────────────────────────────────

/** Comment on a round — on a storyboard field, or the round as a whole — or reply to
 *  a comment (replies inherit their parent's anchor; one level of threading). */
export async function addReviewComment(roundId: string, anchorRaw: unknown, body: string, parentId?: string | null) {
  const me = await getCurrentUser();
  if (!me) return { error: "Not signed in." };
  const r = await getReviewRoundForUser(roundId);
  if (!r) return { error: "Review round not found." };

  const created = await createRoundComment({ roundId, by: { authorId: me.id }, anchor: anchorRaw, body, parentId });
  if ("error" in created) return { error: created.error };
  revalidatePath(`/reviews/${roundId}`);

  // @-mentions notify the people mentioned (members only — guests can't be mentioned).
  const ids = extractMentionIds(body).filter((id) => id !== me.id);
  if (ids.length && (await notificationsEnabled(r.deliverable.project.workspaceId, "mention"))) {
    const [people, deliverable] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: ids }, memberships: { some: { workspaceId: r.deliverable.project.workspaceId } } },
        select: { name: true, email: true },
      }),
      prisma.deliverable.findUnique({ where: { id: r.deliverableId }, select: { name: true, project: { select: { name: true } } } }),
    ]);
    const excerpt = extractText(body).slice(0, 280);
    for (const p of people) {
      if (!p.email) continue;
      await enqueueEmail({
        to: p.email,
        ...withLink(
          mentioned({
            recipientName: p.name ?? p.email,
            mentionerName: me.name ?? me.email,
            context: `a review comment (round ${r.number})`,
            cardTitle: deliverable?.name ?? "",
            boardName: deliverable?.project.name ?? "",
            excerpt,
          }),
          appUrl(`/reviews/${roundId}`),
        ),
      });
    }
  }

  return { comment: toCommentDTO(created.row, "member") };
}

/** Resolve / won't-fix / reopen a top-level comment, with an optional note the
 *  reviewer sees. */
export async function setReviewCommentStatus(commentId: string, status: string, note?: string | null) {
  const me = await getCurrentUser();
  if (!me) return { error: "Not signed in." };
  const c = await getReviewCommentForUser(commentId);
  if (!c) return { error: "Comment not found." };
  if (c.parentId) return { error: "Only a thread's first comment has a status." };
  const parsed = z.enum(["open", "resolved", "wont_fix"]).safeParse(status);
  if (!parsed.success) return { error: "Invalid status." };
  const closing = parsed.data !== "open";
  const updated = await prisma.reviewComment.update({
    where: { id: commentId },
    data: {
      status: parsed.data,
      resolvedById: closing ? me.id : null,
      resolvedAt: closing ? new Date() : null,
      resolvedNote: closing ? (note?.trim() ? note.trim().slice(0, 1000) : null) : null,
    },
    select: COMMENT_SELECT,
  });
  revalidatePath(`/reviews/${c.roundId}`);
  return { comment: toCommentDTO(updated, "member") };
}

/** Delete your own comment (admins/managers can delete any, guests' included).
 *  Deleting a thread's first comment removes its replies. */
export async function deleteReviewComment(commentId: string) {
  const me = await getCurrentUser();
  if (!me) return { error: "Not signed in." };
  const c = await getReviewCommentForUser(commentId);
  if (!c) return { error: "Comment not found." };
  if (c.authorId !== me.id) {
    const round = await getReviewRoundForUser(c.roundId);
    if (!round || !(await isElevatedInWorkspace(round.deliverable.project.workspaceId))) {
      return { error: "You can only delete your own comments." };
    }
  }
  await prisma.reviewComment.delete({ where: { id: commentId } });
  revalidatePath(`/reviews/${c.roundId}`);
}


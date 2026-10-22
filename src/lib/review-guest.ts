import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { isDecided } from "@/lib/methodology";
import { tokenMatches } from "@/lib/review-guest-token";

// Everything a guest reviewer can reach goes through here, and it can only reach the
// one round its credential names (docs/REVIEW-LINKS.md, locked decision 1). Nothing in
// this file touches authz.ts, User or Membership — a guest is not a user.

export const GUEST_COOKIE = "tavoro_review";

/** The token-free page a guest lands on. The cookie is scoped to exactly this path, so
 *  one browser can hold links for several reviews without them overwriting each other. */
export function guestPagePath(guestId: string): string {
  return `/review/g/${guestId}`;
}

const GUEST_SELECT = {
  id: true,
  name: true,
  email: true,
  nonce: true,
  expiresAt: true,
  revokedAt: true,
  lastSeenAt: true,
  assignment: {
    select: {
      id: true,
      status: true,
      feedback: true,
      roundId: true,
      reviewRound: {
        select: {
          id: true,
          number: true,
          outcome: true,
          deliverableId: true,
          deliverable: { select: { project: { select: { workspaceId: true } } } },
        },
      },
    },
  },
} as const;

export type GuestBlock = "expired" | "revoked" | "invalid";

export type GuestSession = {
  guestId: string;
  name: string;
  email: string;
  expiresAt: Date;
  assignmentId: string;
  status: string;
  feedback: string | null;
  roundId: string;
  roundNumber: number;
  deliverableId: string;
  workspaceId: string;
  /** A later round exists — this link is history now, read-only. */
  superseded: boolean;
  /** The round has an outcome (everyone decided, or an override). */
  closed: boolean;
  /** This guest has handed down a decision (they can reopen it while the round is open). */
  decided: boolean;
  canComment: boolean;
  canDecide: boolean;
};

/** Check a guest + token pair: the credential itself, then revocation and expiry. */
async function resolve(
  guestId: string,
  token: string | undefined,
): Promise<{ session: GuestSession } | { blocked: GuestBlock }> {
  if (!token) return { blocked: "invalid" };
  const g = await prisma.reviewGuest.findUnique({ where: { id: guestId }, select: GUEST_SELECT });
  if (!g || !g.assignment || !tokenMatches(token, g)) return { blocked: "invalid" };
  if (g.revokedAt) return { blocked: "revoked" };
  if (g.expiresAt.getTime() < Date.now()) return { blocked: "expired" };

  const round = g.assignment.reviewRound;
  const newer = await prisma.reviewRound.count({
    where: { deliverableId: round.deliverableId, number: { gt: round.number } },
  });
  const superseded = newer > 0;
  const closed = round.outcome != null;
  const decided = isDecided(g.assignment.status);
  const live = !superseded && !closed;

  // Last-seen is for the designer ("opened 2h ago"); a minute's resolution is plenty.
  if (!g.lastSeenAt || Date.now() - g.lastSeenAt.getTime() > 60_000) {
    await prisma.reviewGuest.update({ where: { id: g.id }, data: { lastSeenAt: new Date() } });
  }

  return {
    session: {
      guestId: g.id,
      name: g.name,
      email: g.email,
      expiresAt: g.expiresAt,
      assignmentId: g.assignment.id,
      status: g.assignment.status,
      feedback: g.assignment.feedback,
      roundId: round.id,
      roundNumber: round.number,
      deliverableId: round.deliverableId,
      workspaceId: round.deliverable.project.workspaceId,
      superseded,
      closed,
      decided,
      // After deciding, the page goes read-only until they reopen their decision.
      canComment: live && !decided,
      canDecide: live,
    },
  };
}

/** The guest session for a page or server action, from the path-scoped cookie. */
export async function getGuestSession(guestId: string) {
  const jar = await cookies();
  return resolve(guestId, jar.get(GUEST_COOKIE)?.value);
}

/** For the link-exchange route: validate a raw token from the URL. */
export async function checkGuestToken(guestId: string, token: string) {
  return resolve(guestId, token);
}

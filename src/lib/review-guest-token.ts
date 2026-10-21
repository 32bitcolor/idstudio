import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Guest review links (docs/REVIEW-LINKS.md, locked decision 2, as amended for phase 2).
// A link is "<guestId>.<mac>", where mac = HMAC-SHA256(SESSION_SECRET, guestId:nonce).
// Only the random nonce is stored, so a database dump can't mint or replay a link,
// yet the app can re-create one to re-send it (reminders, "Copy link"). Rotating the
// nonce kills every earlier link for that guest; so does rotating SESSION_SECRET.
// No "server-only" import: the worker builds links for reminder emails too.

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set.");
  return s;
}

export function newGuestNonce(): string {
  return randomBytes(24).toString("base64url");
}

function mac(guestId: string, nonce: string): string {
  return createHmac("sha256", secret()).update(`review-guest:${guestId}:${nonce}`).digest("base64url");
}

export function guestToken(guest: { id: string; nonce: string }): string {
  return `${guest.id}.${mac(guest.id, guest.nonce)}`;
}

/** Split a token into its guest id and MAC; null if it isn't shaped like one. */
export function parseGuestToken(token: string): { guestId: string; mac: string } | null {
  const m = /^([a-z0-9]{20,40})\.([A-Za-z0-9_-]{43})$/.exec(token);
  return m ? { guestId: m[1], mac: m[2] } : null;
}

/** Constant-time check of a token against the guest's current nonce. */
export function tokenMatches(token: string, guest: { id: string; nonce: string }): boolean {
  const expected = Buffer.from(guestToken(guest));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Where a guest's link lands: GET /review/<token> swaps it for a cookie. */
export function guestLinkPath(guest: { id: string; nonce: string }): string {
  return `/review/${guestToken(guest)}`;
}

const DAY = 86_400_000;

/** Links last until the round's due date + 14 days, capped at 90 days from now;
 *  30 days when the round has no due date. */
export function guestExpiry(due: Date | null, now = new Date()): Date {
  const cap = now.getTime() + 90 * DAY;
  const want = due ? due.getTime() + 14 * DAY : now.getTime() + 30 * DAY;
  return new Date(Math.min(Math.max(want, now.getTime() + DAY), cap));
}

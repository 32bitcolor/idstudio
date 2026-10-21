import { NextResponse, type NextRequest } from "next/server";
import { parseGuestToken } from "@/lib/review-guest-token";
import { checkGuestToken, GUEST_COOKIE, guestPagePath } from "@/lib/review-guest";
import { checkThrottle, clientIp } from "@/lib/throttle";

// A guest's review link: GET /review/<token>. Swap the token for an httpOnly cookie
// scoped to the guest's own page, then redirect to that token-free URL — so the token
// leaves the address bar, history, screenshots and Referer headers after first use
// (docs/REVIEW-LINKS.md, locked decision 2).

const NO_LEAK = { "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store" };

function to(path: string) {
  // Relative Location: correct behind Caddy/Cloudflare without knowing the public host.
  return new NextResponse(null, { status: 303, headers: { Location: path, ...NO_LEAK } });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Guessing is hopeless (256-bit MAC), but cap it anyway: 30 tries / 10 min per IP.
  if (!(await checkThrottle(`review-link:${await clientIp()}`, 30, 600))) {
    return new NextResponse("Too many attempts. Try again in a few minutes.", { status: 429, headers: NO_LEAK });
  }

  const parsed = parseGuestToken(token);
  if (!parsed) return to("/review/unavailable?reason=invalid");
  const result = await checkGuestToken(parsed.guestId, token);
  if ("blocked" in result) return to(`/review/unavailable?reason=${result.blocked}`);

  const res = to(guestPagePath(parsed.guestId));
  res.cookies.set(GUEST_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: guestPagePath(parsed.guestId),
    expires: result.session.expiresAt,
  });
  return res;
}

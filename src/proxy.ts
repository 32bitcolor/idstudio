import { NextResponse, type NextRequest } from "next/server";
import { decrypt, SESSION_COOKIE } from "@/lib/session";

// Next.js 16: "Middleware" is now "Proxy" (same functionality).
// Optimistic auth gate only — the real authorization happens in the DAL,
// close to the data. Here we just pre-filter obvious unauthenticated access.

const PUBLIC_ROUTES = ["/login", "/signup"];
// Reachable with no session at all: the public intake form (/request/<workspace-slug>),
// where external stakeholders submit requests, and guest review links (/review/…),
// where outside SMEs review one round. Note "/review/" doesn't match "/reviews/".
const PUBLIC_PREFIXES = ["/request/", "/review/"];

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await decrypt(req.cookies.get(SESSION_COOKIE)?.value);
  const isAuthPage = PUBLIC_ROUTES.includes(pathname);
  const isPublic = isAuthPage || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  if (!session && !isPublic && pathname !== "/") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Only bounce a logged-in session away from /login and /signup — a Member
  // should still be able to load the public intake form like anyone else.
  if (session && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const res = NextResponse.next();
  // Guest review pages: keep the guest's page URL out of Referer headers and search engines.
  if (pathname.startsWith("/review/")) {
    res.headers.set("Referrer-Policy", "no-referrer");
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return res;
}

export const config = {
  // Skip API routes, Next internals, and anything with a file extension.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};

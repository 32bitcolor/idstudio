import { NextResponse, type NextRequest } from "next/server";
import { decrypt, SESSION_COOKIE } from "@/lib/session";

// Next.js 16: "Middleware" is now "Proxy" (same functionality).
// Optimistic auth gate only — the real authorization happens in the DAL,
// close to the data. Here we just pre-filter obvious unauthenticated access.

const PUBLIC_ROUTES = ["/login", "/signup"];
// The public intake form (/request/<workspace-slug>) is the one part of the app
// meant to be reachable with no session at all — external stakeholders submitting
// a request never log in.
const PUBLIC_PREFIXES = ["/request/"];

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

  return NextResponse.next();
}

export const config = {
  // Skip API routes, Next internals, and anything with a file extension.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};

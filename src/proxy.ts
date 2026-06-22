import { NextResponse, type NextRequest } from "next/server";
import { decrypt, SESSION_COOKIE } from "@/lib/session";

// Next.js 16: "Middleware" is now "Proxy" (same functionality).
// Optimistic auth gate only — the real authorization happens in the DAL,
// close to the data. Here we just pre-filter obvious unauthenticated access.

const PUBLIC_ROUTES = ["/login", "/signup"];

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await decrypt(req.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_ROUTES.includes(pathname);

  if (!session && !isPublic && pathname !== "/") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (session && isPublic) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Skip API routes, Next internals, and anything with a file extension.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};

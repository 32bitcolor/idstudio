import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/dal";
import { baseUrl } from "@/lib/oauth";
import { authorizeUrl } from "@/lib/assistant/openrouter";

// Sign in with OpenRouter (docs/ASSISTANT.md): PKCE, with the verifier and the page to
// come back to held in a short-lived cookie scoped to the callback.

export const dynamic = "force-dynamic";

const COOKIE = "tavoro_openrouter";

export async function GET(req: Request) {
  const base = baseUrl(req);
  if (!(await getCurrentUser())) return Response.redirect(`${base}/login`, 303);
  const back = new URL(req.url).searchParams.get("return") ?? "/dashboard";
  // Same-site paths only.
  const ret = back.startsWith("/") && !back.startsWith("//") ? back : "/dashboard";
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  (await cookies()).set(COOKIE, JSON.stringify({ verifier, ret }), {
    httpOnly: true,
    secure: base.startsWith("https://"),
    sameSite: "lax",
    path: "/api/assistant/openrouter",
    maxAge: 600,
  });
  return Response.redirect(authorizeUrl(`${base}/api/assistant/openrouter/callback`, challenge), 303);
}

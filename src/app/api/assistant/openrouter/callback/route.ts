import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { baseUrl } from "@/lib/oauth";
import { sealSecret } from "@/lib/assistant/crypto";
import { exchangeCode } from "@/lib/assistant/openrouter";

// OpenRouter sends the member back here with a code; it becomes an API key that only
// this member's assistant uses. A previous key is replaced (the member can delete old
// ones in OpenRouter's settings).

export const dynamic = "force-dynamic";

const COOKIE = "tavoro_openrouter";

export async function GET(req: Request) {
  const base = baseUrl(req);
  const user = await getCurrentUser();
  if (!user) return Response.redirect(`${base}/login`, 303);
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  jar.delete({ name: COOKIE, path: "/api/assistant/openrouter" });
  let state: { verifier?: string; ret?: string } = {};
  try {
    state = raw ? JSON.parse(raw) : {};
  } catch {}
  const ret = state.ret?.startsWith("/") && !state.ret.startsWith("//") ? state.ret : "/dashboard";
  const back = (status: string) => {
    const u = new URL(ret, base);
    u.searchParams.set("assistant", status);
    return Response.redirect(u.toString(), 303);
  };
  const code = new URL(req.url).searchParams.get("code");
  if (!code || !state.verifier) return back("cancelled");
  try {
    const key = await exchangeCode(code, state.verifier);
    const data = { provider: "openrouter", keyCipher: sealSecret(key), keyHint: key.slice(-4) };
    await prisma.assistantConnection.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
    return back("connected");
  } catch (e) {
    console.error("[assistant] OpenRouter code exchange failed", e);
    return back("failed");
  }
}

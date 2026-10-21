import { prisma } from "@/lib/db";
import { sha256 } from "@/lib/api-tokens";
import { CORS, preflight, readParams } from "@/lib/oauth";

// RFC 7009: revoking either token of a connection ends the whole connection. Always
// 200, so the endpoint can't be used to test whether a token exists.
export async function POST(req: Request) {
  const { token } = await readParams(req);
  if (token) {
    const h = sha256(token);
    await prisma.apiToken.updateMany({
      where: { kind: "oauth", revokedAt: null, OR: [{ tokenHash: h }, { refreshHash: h }] },
      data: { revokedAt: new Date() },
    });
  }
  return new Response(null, { status: 200, headers: CORS });
}

export const OPTIONS = preflight;

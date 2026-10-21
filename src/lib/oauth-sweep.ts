import type { PrismaClient } from "../generated/prisma/client";

// Nightly clean-up of MCP credentials (docs/MCP.md), run by the worker next to the
// review-file sweep (no "server-only" imports; the Prisma client is passed in).
// Dynamic client registration is open to anyone, so clients that never got approved
// would pile up; spent codes and long-dead tokens are just clutter.

const DAY = 86_400_000;

export async function sweepOAuth(prisma: PrismaClient, now = new Date()) {
  const ago = (days: number) => new Date(now.getTime() - days * DAY);
  const codes = await prisma.oAuthCode.deleteMany({ where: { expiresAt: { lt: ago(1) } } });
  // Revoked, or expired with no way to renew, for 30 days: gone from Settings already.
  const tokens = await prisma.apiToken.deleteMany({
    where: {
      OR: [
        { revokedAt: { lt: ago(30) } },
        { kind: "personal", expiresAt: { lt: ago(30) } },
        { kind: "oauth", refreshExpiresAt: { lt: ago(30) } },
      ],
    },
  });
  // Registered a week ago and never connected (or every connection since deleted).
  const clients = await prisma.oAuthClient.deleteMany({ where: { createdAt: { lt: ago(7) }, tokens: { none: {} }, codes: { none: {} } } });
  return { codes: codes.count, tokens: tokens.count, clients: clients.count };
}

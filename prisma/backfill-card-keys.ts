import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// One-off maintenance script: assigns a card-key prefix to every board that
// doesn't have one yet (derived from its name, unique within its workspace),
// then backfills keys onto all of that board's existing cards and subtasks
// in creation order — the same backfill setBoardCardKeyPrefix does when an
// admin sets a prefix by hand, just run for every prefix-less board at once.
// Safe to re-run: boards that already have a prefix, and cards that already
// have a key, are left untouched.

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
const prisma = new PrismaClient({ adapter });

function deriveInitials(name: string): string {
  const words = name.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (words.length >= 2) {
    const initials = words
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 6);
    if (/^[A-Z]/.test(initials) && initials.length >= 2) return initials;
  }
  const word = (words[0] ?? "BOARD").replace(/[^a-zA-Z]/g, "");
  return (word.slice(0, 4) || "BOARD").toUpperCase().padEnd(2, "X");
}

function uniquePrefix(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  let candidate = `${base}${n}`.slice(0, 8);
  while (taken.has(candidate)) {
    n += 1;
    candidate = `${base}${n}`.slice(0, 8);
  }
  return candidate;
}

async function main() {
  const boards = await prisma.board.findMany({
    where: { cardKeyPrefix: null },
    select: { id: true, name: true, workspaceId: true },
  });
  if (boards.length === 0) {
    console.log("No prefix-less boards found — nothing to do.");
    return;
  }

  const byWorkspace = new Map<string, typeof boards>();
  for (const b of boards) {
    if (!byWorkspace.has(b.workspaceId)) byWorkspace.set(b.workspaceId, []);
    byWorkspace.get(b.workspaceId)!.push(b);
  }

  for (const [workspaceId, wsBoards] of byWorkspace) {
    const existing = await prisma.board.findMany({
      where: { workspaceId, cardKeyPrefix: { not: null } },
      select: { cardKeyPrefix: true },
    });
    const taken = new Set(existing.map((e) => e.cardKeyPrefix!));

    for (const board of wsBoards) {
      const prefix = uniquePrefix(deriveInitials(board.name), taken);
      taken.add(prefix);

      await prisma.board.update({ where: { id: board.id }, data: { cardKeyPrefix: prefix } });

      const cards = await prisma.card.findMany({
        where: {
          keySeq: null,
          OR: [
            { columnId: { not: null }, column: { boardId: board.id } },
            { parentCardId: { not: null }, parentCard: { column: { boardId: board.id } } },
          ],
        },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });

      let seq = 0;
      for (const c of cards) {
        seq += 1;
        await prisma.card.update({ where: { id: c.id }, data: { keySeq: seq } });
      }
      if (cards.length > 0) {
        await prisma.board.update({ where: { id: board.id }, data: { cardKeySeq: seq } });
      }

      console.log(`[backfill] "${board.name}" -> ${prefix} (${cards.length} card${cards.length === 1 ? "" : "s"} labeled)`);
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect().finally(() => process.exit(1));
  });

-- Sequential per-board card keys (e.g. "WP-1", "WP-2"), covering top-level
-- cards and subtask-cards alike. Purely additive — no data movement, so this
-- is hand-authored only to keep it non-interactive, not because of any diff
-- prisma's auto-generator couldn't express.

ALTER TABLE "Board" ADD COLUMN "cardKeyPrefix" TEXT;
ALTER TABLE "Board" ADD COLUMN "cardKeySeq" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Card" ADD COLUMN "keySeq" INTEGER;

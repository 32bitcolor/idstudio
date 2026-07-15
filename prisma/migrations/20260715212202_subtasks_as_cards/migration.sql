-- Subtasks become real Card rows (parentCardId), replacing ChecklistItem entirely.
-- Hand-authored: this moves data between tables, which prisma's auto-diff can't express.

-- 1. Extend Card
ALTER TABLE "Card" ADD COLUMN "parentCardId" TEXT;
ALTER TABLE "Card" ADD COLUMN "done" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Card" ALTER COLUMN "columnId" DROP NOT NULL;

ALTER TABLE "Card" ADD CONSTRAINT "Card_parentCardId_fkey"
  FOREIGN KEY ("parentCardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Card_parentCardId_position_idx" ON "Card"("parentCardId", "position");

-- 2. Migrate every existing ChecklistItem row into Card, preserving id (nothing else
--    references ChecklistItem.id via FK, so reusing it is safe and traceable).
INSERT INTO "Card" (id, "columnId", "parentCardId", title, "dueDate", position, done, "createdAt", "updatedAt")
SELECT id, NULL, "cardId", text, "dueDate", position, done, now(), now()
FROM "ChecklistItem";

-- 3. Migrate assigneeId -> CardAssignee join rows
INSERT INTO "CardAssignee" ("cardId", "userId")
SELECT id, "assigneeId" FROM "ChecklistItem" WHERE "assigneeId" IS NOT NULL;

-- 4. Drop the now-fully-migrated table
DROP TABLE "ChecklistItem";

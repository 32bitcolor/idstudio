-- Labels move from board-scoped to workspace-scoped (Phase 5 of the Projects↔Boards
-- redesign) so a label means the same thing everywhere and cross-project views — the
-- team sprint board — can filter by it.
--
-- The risky part is the merge: two boards in one workspace may each own a label with
-- the same name. Those collapse into a single label, which means CardLabel rows have
-- to be repointed and de-duplicated before the old column can go.

-- 1. New column, nullable while we backfill.
ALTER TABLE "Label" ADD COLUMN "workspaceId" TEXT;

-- 2. Backfill from the owning board.
UPDATE "Label" l
SET "workspaceId" = b."workspaceId"
FROM "Board" b
WHERE b.id = l."boardId";

-- Defensive: a label whose board vanished can't be assigned a workspace, and would
-- block the NOT NULL below. The Board FK makes this unreachable today; belt and braces.
DELETE FROM "CardLabel" WHERE "labelId" IN (SELECT id FROM "Label" WHERE "workspaceId" IS NULL);
DELETE FROM "Label" WHERE "workspaceId" IS NULL;

-- 3. Elect one surviving label per (workspace, case-insensitive name).
--    Winner = the most-used one, tie-broken by id so the result is deterministic and
--    identical across every environment this migration runs in. The winner's colour and
--    name-casing are what survive.
CREATE TEMP TABLE label_merge AS
WITH uses AS (
  SELECT l.id,
         l."workspaceId" AS ws,
         lower(l.name)   AS lname,
         COALESCE(c.n, 0) AS n
  FROM "Label" l
  LEFT JOIN (SELECT "labelId", count(*) AS n FROM "CardLabel" GROUP BY "labelId") c
         ON c."labelId" = l.id
)
SELECT id AS old_id,
       first_value(id) OVER (PARTITION BY ws, lname ORDER BY n DESC, id ASC) AS keep_id
FROM uses;

-- 4. Repoint card↔label links onto the surviving label.
--    Drop links that would collide first: a card can legitimately carry two labels that
--    are about to merge (nothing stopped a single board having two same-named labels),
--    and (cardId, labelId) is the primary key.
DELETE FROM "CardLabel" cl
USING label_merge m
WHERE cl."labelId" = m.old_id
  AND m.old_id <> m.keep_id
  AND EXISTS (
    SELECT 1 FROM "CardLabel" x
    WHERE x."cardId" = cl."cardId" AND x."labelId" = m.keep_id
  );

UPDATE "CardLabel" cl
SET "labelId" = m.keep_id
FROM label_merge m
WHERE cl."labelId" = m.old_id
  AND m.old_id <> m.keep_id;

-- 5. Retire the merged-away labels.
DELETE FROM "Label" l
USING label_merge m
WHERE l.id = m.old_id
  AND m.old_id <> m.keep_id;

DROP TABLE label_merge;

-- 6. Swap the ownership column over.
ALTER TABLE "Label" DROP CONSTRAINT "Label_boardId_fkey";
DROP INDEX "Label_boardId_idx";
ALTER TABLE "Label" DROP COLUMN "boardId";
ALTER TABLE "Label" ALTER COLUMN "workspaceId" SET NOT NULL;

ALTER TABLE "Label" ADD CONSTRAINT "Label_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Label_workspaceId_name_idx" ON "Label"("workspaceId", "name");

-- Case-insensitive uniqueness: "Rework" and "rework" are the same label. Functional
-- index, so it lives here rather than in schema.prisma (Prisma can't express it).
CREATE UNIQUE INDEX "Label_workspaceId_lower_name_key" ON "Label"("workspaceId", lower("name"));

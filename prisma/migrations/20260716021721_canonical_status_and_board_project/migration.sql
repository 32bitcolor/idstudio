-- Phase 0 of the Projects↔Boards item-first redesign (see
-- docs/PROJECTS-BOARDS-REDESIGN.md). Adds a canonical per-workspace status
-- vocabulary, maps each board column to a status, denormalizes the status onto
-- the card (source of truth for cross-project views), and lets a board
-- optionally belong to a project. Boards keep working unchanged.

-- CreateTable
CREATE TABLE "WorkspaceStatus" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'active',
    "position" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceStatus_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Board" ADD COLUMN "projectId" TEXT;

-- AlterTable
ALTER TABLE "Column" ADD COLUMN "statusId" TEXT;

-- AlterTable
ALTER TABLE "Card" ADD COLUMN "statusId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceStatus_workspaceId_name_key" ON "WorkspaceStatus"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "WorkspaceStatus_workspaceId_position_idx" ON "WorkspaceStatus"("workspaceId", "position");

-- CreateIndex
CREATE INDEX "Board_projectId_idx" ON "Board"("projectId");

-- CreateIndex
CREATE INDEX "Card_statusId_idx" ON "Card"("statusId");

-- AddForeignKey
ALTER TABLE "WorkspaceStatus" ADD CONSTRAINT "WorkspaceStatus_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Column" ADD CONSTRAINT "Column_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "WorkspaceStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "WorkspaceStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Backfill ────────────────────────────────────────────────────────────────

-- Seed the canonical status set for every existing workspace. Positions are the
-- fractional-indexing keys the app would generate (a0, a1, …) so later inserts
-- between them work. Keep in sync with DEFAULT_WORKSPACE_STATUSES in lib/status.ts.
INSERT INTO "WorkspaceStatus" ("id", "workspaceId", "name", "category", "position", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, w."id", s."name", s."category", s."position", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Workspace" w
CROSS JOIN (VALUES
  ('Backlog', 'todo', 'a0'),
  ('To do', 'todo', 'a1'),
  ('In progress', 'active', 'a2'),
  ('In review', 'active', 'a3'),
  ('Done', 'done', 'a4')
) AS s("name", "category", "position");

-- Map each column to a canonical status by case-insensitive name match. The
-- default columns ("To do" / "In progress" / "Done") line up exactly.
UPDATE "Column" c
SET "statusId" = ws."id"
FROM "Board" b, "WorkspaceStatus" ws
WHERE c."boardId" = b."id"
  AND ws."workspaceId" = b."workspaceId"
  AND lower(ws."name") = lower(c."name");

-- Any column whose name didn't match a status falls back to "In progress".
-- (An admin remap UI is planned; see the design doc.)
UPDATE "Column" c
SET "statusId" = ws."id"
FROM "Board" b, "WorkspaceStatus" ws
WHERE c."statusId" IS NULL
  AND c."boardId" = b."id"
  AND ws."workspaceId" = b."workspaceId"
  AND ws."name" = 'In progress';

-- Denormalize each top-level card's status from its column. Subtasks (columnId
-- IS NULL) keep statusId NULL and inherit their parent's status in the app.
UPDATE "Card" c
SET "statusId" = col."statusId"
FROM "Column" col
WHERE c."columnId" = col."id";

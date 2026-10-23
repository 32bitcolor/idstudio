-- Public read-only board links and private cards (lib/board-share.ts)
ALTER TABLE "Workspace" ADD COLUMN "publicBoardsEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Board" ADD COLUMN "publicNonce" TEXT,
ADD COLUMN "publicShowAssignees" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "publicSharedAt" TIMESTAMP(3),
ADD COLUMN "publicSharedById" TEXT;

ALTER TABLE "Card" ADD COLUMN "private" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Board" ADD CONSTRAINT "Board_publicSharedById_fkey" FOREIGN KEY ("publicSharedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

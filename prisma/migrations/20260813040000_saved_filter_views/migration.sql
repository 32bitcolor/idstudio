-- Phase 5 of the Projects↔Boards redesign (see docs/PROJECTS-BOARDS-REDESIGN.md):
-- saved filter views. A named set of filters, personal to the user who saved it.
-- scope "board" pins a view to one board (its label/assignee ids only mean
-- something there); scope "sprint" applies to any sprint board. Purely additive.

-- CreateTable
CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "boardId" TEXT,
    "filters" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedView_userId_scope_boardId_idx" ON "SavedView"("userId", "scope", "boardId");

-- CreateIndex
CREATE INDEX "SavedView_workspaceId_idx" ON "SavedView"("workspaceId");

-- CreateIndex
CREATE INDEX "SavedView_boardId_idx" ON "SavedView"("boardId");

-- AddForeignKey
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

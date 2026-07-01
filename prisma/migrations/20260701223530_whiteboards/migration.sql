-- CreateTable
CREATE TABLE "Whiteboard" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "storyboardId" TEXT,
    "title" TEXT NOT NULL,
    "scene" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Whiteboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhiteboardGroup" (
    "whiteboardId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "WhiteboardGroup_pkey" PRIMARY KEY ("whiteboardId","groupId")
);

-- CreateIndex
CREATE INDEX "Whiteboard_workspaceId_idx" ON "Whiteboard"("workspaceId");

-- CreateIndex
CREATE INDEX "Whiteboard_storyboardId_idx" ON "Whiteboard"("storyboardId");

-- CreateIndex
CREATE INDEX "WhiteboardGroup_groupId_idx" ON "WhiteboardGroup"("groupId");

-- AddForeignKey
ALTER TABLE "Whiteboard" ADD CONSTRAINT "Whiteboard_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Whiteboard" ADD CONSTRAINT "Whiteboard_storyboardId_fkey" FOREIGN KEY ("storyboardId") REFERENCES "Storyboard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhiteboardGroup" ADD CONSTRAINT "WhiteboardGroup_whiteboardId_fkey" FOREIGN KEY ("whiteboardId") REFERENCES "Whiteboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhiteboardGroup" ADD CONSTRAINT "WhiteboardGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

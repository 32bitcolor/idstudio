-- CreateTable
CREATE TABLE "Storyboard" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "deliverableId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Storyboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Screen" (
    "id" TEXT NOT NULL,
    "storyboardId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "screenType" TEXT NOT NULL DEFAULT 'content',
    "position" TEXT NOT NULL,
    "onScreenText" TEXT,
    "narration" TEXT,
    "visualNotes" TEXT,
    "interactionNotes" TEXT,
    "developerNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Screen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Storyboard_deliverableId_key" ON "Storyboard"("deliverableId");

-- CreateIndex
CREATE INDEX "Storyboard_workspaceId_idx" ON "Storyboard"("workspaceId");

-- CreateIndex
CREATE INDEX "Screen_storyboardId_position_idx" ON "Screen"("storyboardId", "position");

-- AddForeignKey
ALTER TABLE "Storyboard" ADD CONSTRAINT "Storyboard_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Storyboard" ADD CONSTRAINT "Storyboard_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Screen" ADD CONSTRAINT "Screen_storyboardId_fkey" FOREIGN KEY ("storyboardId") REFERENCES "Storyboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

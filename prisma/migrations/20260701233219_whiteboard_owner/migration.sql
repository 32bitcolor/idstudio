-- AlterTable
ALTER TABLE "Whiteboard" ADD COLUMN     "createdById" TEXT;

-- CreateIndex
CREATE INDEX "Whiteboard_createdById_idx" ON "Whiteboard"("createdById");

-- AddForeignKey
ALTER TABLE "Whiteboard" ADD CONSTRAINT "Whiteboard_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

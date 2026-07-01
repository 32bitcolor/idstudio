-- AlterTable
ALTER TABLE "ReviewCycle" ADD COLUMN     "requestedById" TEXT;

-- CreateIndex
CREATE INDEX "ReviewCycle_reviewerId_idx" ON "ReviewCycle"("reviewerId");

-- CreateIndex
CREATE INDEX "ReviewCycle_requestedById_idx" ON "ReviewCycle"("requestedById");

-- AddForeignKey
ALTER TABLE "ReviewCycle" ADD CONSTRAINT "ReviewCycle_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

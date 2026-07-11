-- AlterTable
ALTER TABLE "Whiteboard" ADD COLUMN     "cardId" TEXT;

-- CreateIndex
CREATE INDEX "Whiteboard_cardId_idx" ON "Whiteboard"("cardId");

-- AddForeignKey
ALTER TABLE "Whiteboard" ADD CONSTRAINT "Whiteboard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

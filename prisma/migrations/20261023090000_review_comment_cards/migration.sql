-- Phase 4 (docs/REVIEW-LINKS.md): a review comment remembers the card it was sent to.
ALTER TABLE "ReviewComment" ADD COLUMN "cardId" TEXT;

CREATE INDEX "ReviewComment_cardId_idx" ON "ReviewComment"("cardId");

ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

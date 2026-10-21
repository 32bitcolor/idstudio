-- Guest review links (docs/REVIEW-LINKS.md, phase 2). Hand-written for the CHECK
-- constraints, which Prisma can't express.

CREATE TABLE "ReviewGuest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewGuest_pkey" PRIMARY KEY ("id")
);

-- An assignment belongs to a member OR a guest, never both, never neither.
ALTER TABLE "ReviewCycle" ALTER COLUMN "reviewerId" DROP NOT NULL,
ADD COLUMN "guestId" TEXT;
CREATE UNIQUE INDEX "ReviewCycle_guestId_key" ON "ReviewCycle"("guestId");
ALTER TABLE "ReviewCycle" ADD CONSTRAINT "ReviewCycle_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "ReviewGuest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewCycle" ADD CONSTRAINT "ReviewCycle_reviewer_xor_guest" CHECK (("reviewerId" IS NULL) <> ("guestId" IS NULL));

-- A comment is by a member OR a guest. Both may become NULL when the author is deleted
-- (ON DELETE SET NULL), so this is "at most one", not "exactly one".
ALTER TABLE "ReviewComment" ADD COLUMN "guestId" TEXT;
ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "ReviewGuest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_one_author" CHECK ("authorId" IS NULL OR "guestId" IS NULL);

-- A card's short URL ("/c/WP-5") only resolves unambiguously if no two boards
-- in the same workspace share a prefix. Postgres unique indexes treat NULLs as
-- distinct, so boards without a prefix are unaffected.
CREATE UNIQUE INDEX "Board_workspaceId_cardKeyPrefix_key" ON "Board"("workspaceId", "cardKeyPrefix");

-- MCP client compatibility (docs/MCP.md): confidential DCR clients and CIMD clients.
ALTER TABLE "OAuthClient" ADD COLUMN "authMethod" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "OAuthClient" ADD COLUMN "secretHash" TEXT;
ALTER TABLE "OAuthClient" ADD COLUMN "metadataFetchedAt" TIMESTAMP(3);

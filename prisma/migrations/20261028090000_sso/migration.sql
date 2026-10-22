-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "suspendedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SsoConnection" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'jumpcloud',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "idpEntityId" TEXT,
    "idpSsoUrl" TEXT,
    "idpCert" TEXT,
    "domains" TEXT[],
    "groupAttribute" TEXT NOT NULL DEFAULT 'memberOf',
    "jitProvisioning" BOOLEAN NOT NULL DEFAULT true,
    "requireSso" BOOLEAN NOT NULL DEFAULT false,
    "manageRoles" BOOLEAN NOT NULL DEFAULT false,
    "defaultRole" "Role" NOT NULL DEFAULT 'MEMBER',
    "scimEnabled" BOOLEAN NOT NULL DEFAULT false,
    "scimTokenHash" TEXT,
    "scimTokenHint" TEXT,
    "lastScimAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsoConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SsoIdentity" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "externalId" TEXT,
    "userName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsoIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdpGroup" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "externalId" TEXT,
    "fromScim" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdpGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdpGroupMember" (
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "IdpGroupMember_pkey" PRIMARY KEY ("groupId","userId")
);

-- CreateTable
CREATE TABLE "SsoRoleMapping" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "SsoRoleMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScimLog" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "request" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScimLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SsoConnection_workspaceId_key" ON "SsoConnection"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "SsoConnection_scimTokenHash_key" ON "SsoConnection"("scimTokenHash");

-- CreateIndex
CREATE INDEX "SsoIdentity_connectionId_externalId_idx" ON "SsoIdentity"("connectionId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "SsoIdentity_connectionId_userId_key" ON "SsoIdentity"("connectionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "IdpGroup_connectionId_displayName_key" ON "IdpGroup"("connectionId", "displayName");

-- CreateIndex
CREATE INDEX "IdpGroupMember_userId_idx" ON "IdpGroupMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SsoRoleMapping_connectionId_groupName_key" ON "SsoRoleMapping"("connectionId", "groupName");

-- CreateIndex
CREATE INDEX "ScimLog_connectionId_createdAt_idx" ON "ScimLog"("connectionId", "createdAt");

-- AddForeignKey
ALTER TABLE "SsoConnection" ADD CONSTRAINT "SsoConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoIdentity" ADD CONSTRAINT "SsoIdentity_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SsoConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoIdentity" ADD CONSTRAINT "SsoIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdpGroup" ADD CONSTRAINT "IdpGroup_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SsoConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdpGroupMember" ADD CONSTRAINT "IdpGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "IdpGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdpGroupMember" ADD CONSTRAINT "IdpGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoRoleMapping" ADD CONSTRAINT "SsoRoleMapping_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SsoConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScimLog" ADD CONSTRAINT "ScimLog_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SsoConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;


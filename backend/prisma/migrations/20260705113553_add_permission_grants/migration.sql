-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('INVITE_MEMBER', 'REMOVE_MEMBER', 'UPDATE_MEMBER', 'ASSIGN_ROLE', 'MOVE_MEMBER', 'CREATE_UNIT', 'UPDATE_UNIT', 'DELETE_UNIT');

-- CreateTable
CREATE TABLE "PermissionGrant" (
    "id" TEXT NOT NULL,
    "permission" "Permission" NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scopeUnitId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "canDelegate" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermissionGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PermissionGrant_organizationId_idx" ON "PermissionGrant"("organizationId");

-- CreateIndex
CREATE INDEX "PermissionGrant_userId_idx" ON "PermissionGrant"("userId");

-- CreateIndex
CREATE INDEX "PermissionGrant_scopeUnitId_idx" ON "PermissionGrant"("scopeUnitId");

-- CreateIndex
CREATE INDEX "PermissionGrant_grantedById_idx" ON "PermissionGrant"("grantedById");

-- AddForeignKey
ALTER TABLE "PermissionGrant" ADD CONSTRAINT "PermissionGrant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionGrant" ADD CONSTRAINT "PermissionGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionGrant" ADD CONSTRAINT "PermissionGrant_scopeUnitId_fkey" FOREIGN KEY ("scopeUnitId") REFERENCES "OrganizationUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionGrant" ADD CONSTRAINT "PermissionGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

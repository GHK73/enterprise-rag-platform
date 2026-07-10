-- CreateEnum
CREATE TYPE "DocumentClassification" AS ENUM ('GENERAL', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'QUEUED', 'PROCESSING', 'READY', 'FAILED', 'EXPIRED', 'DELETED');

-- CreateEnum
CREATE TYPE "DocumentProcessingStatus" AS ENUM ('PENDING', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DocumentAccessSubjectType" AS ENUM ('ORGANIZATION', 'UNIT', 'ROLE', 'USER');

-- CreateEnum
CREATE TYPE "DocumentAccessAction" AS ENUM ('QUERY', 'VIEW', 'DOWNLOAD', 'MANAGE_ACCESS');

-- CreateEnum
CREATE TYPE "DocumentAccessEffect" AS ENUM ('ALLOW', 'DENY');

-- CreateEnum
CREATE TYPE "DocumentAccessScope" AS ENUM ('UNIT_ONLY', 'UNIT_AND_DESCENDANTS');

-- CreateEnum
CREATE TYPE "DocumentAccessEventType" AS ENUM ('CREATED', 'UPDATED', 'REVOKED', 'EXPIRED', 'TEMPORARY_GRANTED', 'TEMPORARY_EXTENDED');

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "classification" "DocumentClassification" NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersionId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "draftExpiresAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "storageBucket" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "checksum" TEXT NOT NULL,
    "processingStatus" "DocumentProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentAccessPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "subjectType" "DocumentAccessSubjectType" NOT NULL,
    "subjectOrganizationId" TEXT,
    "subjectUnitId" TEXT,
    "subjectRole" "Role",
    "subjectUserId" TEXT,
    "action" "DocumentAccessAction" NOT NULL,
    "effect" "DocumentAccessEffect" NOT NULL DEFAULT 'ALLOW',
    "scope" "DocumentAccessScope",
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "grantedById" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentAccessPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentAccessAudit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "policyId" TEXT,
    "actorId" TEXT NOT NULL,
    "subjectType" "DocumentAccessSubjectType" NOT NULL,
    "subjectOrganizationId" TEXT,
    "subjectUnitId" TEXT,
    "subjectRole" "Role",
    "subjectUserId" TEXT,
    "eventType" "DocumentAccessEventType" NOT NULL,
    "previousState" JSONB,
    "newState" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentAccessAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Document_currentVersionId_key" ON "Document"("currentVersionId");

-- CreateIndex
CREATE INDEX "Document_organizationId_idx" ON "Document"("organizationId");

-- CreateIndex
CREATE INDEX "Document_uploadedById_idx" ON "Document"("uploadedById");

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "Document"("status");

-- CreateIndex
CREATE INDEX "Document_classification_idx" ON "Document"("classification");

-- CreateIndex
CREATE INDEX "Document_isDeleted_idx" ON "Document"("isDeleted");

-- CreateIndex
CREATE INDEX "Document_draftExpiresAt_idx" ON "Document"("draftExpiresAt");

-- CreateIndex
CREATE INDEX "DocumentVersion_documentId_idx" ON "DocumentVersion"("documentId");

-- CreateIndex
CREATE INDEX "DocumentVersion_createdById_idx" ON "DocumentVersion"("createdById");

-- CreateIndex
CREATE INDEX "DocumentVersion_processingStatus_idx" ON "DocumentVersion"("processingStatus");

-- CreateIndex
CREATE INDEX "DocumentVersion_checksum_idx" ON "DocumentVersion"("checksum");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_documentId_versionNumber_key" ON "DocumentVersion"("documentId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_storageBucket_storageKey_key" ON "DocumentVersion"("storageBucket", "storageKey");

-- CreateIndex
CREATE INDEX "DocumentAccessPolicy_organizationId_idx" ON "DocumentAccessPolicy"("organizationId");

-- CreateIndex
CREATE INDEX "DocumentAccessPolicy_documentId_idx" ON "DocumentAccessPolicy"("documentId");

-- CreateIndex
CREATE INDEX "DocumentAccessPolicy_subjectType_idx" ON "DocumentAccessPolicy"("subjectType");

-- CreateIndex
CREATE INDEX "DocumentAccessPolicy_subjectOrganizationId_idx" ON "DocumentAccessPolicy"("subjectOrganizationId");

-- CreateIndex
CREATE INDEX "DocumentAccessPolicy_subjectUnitId_idx" ON "DocumentAccessPolicy"("subjectUnitId");

-- CreateIndex
CREATE INDEX "DocumentAccessPolicy_subjectRole_idx" ON "DocumentAccessPolicy"("subjectRole");

-- CreateIndex
CREATE INDEX "DocumentAccessPolicy_subjectUserId_idx" ON "DocumentAccessPolicy"("subjectUserId");

-- CreateIndex
CREATE INDEX "DocumentAccessPolicy_action_idx" ON "DocumentAccessPolicy"("action");

-- CreateIndex
CREATE INDEX "DocumentAccessPolicy_isActive_idx" ON "DocumentAccessPolicy"("isActive");

-- CreateIndex
CREATE INDEX "DocumentAccessPolicy_validUntil_idx" ON "DocumentAccessPolicy"("validUntil");

-- CreateIndex
CREATE INDEX "DocumentAccessAudit_organizationId_idx" ON "DocumentAccessAudit"("organizationId");

-- CreateIndex
CREATE INDEX "DocumentAccessAudit_documentId_idx" ON "DocumentAccessAudit"("documentId");

-- CreateIndex
CREATE INDEX "DocumentAccessAudit_policyId_idx" ON "DocumentAccessAudit"("policyId");

-- CreateIndex
CREATE INDEX "DocumentAccessAudit_actorId_idx" ON "DocumentAccessAudit"("actorId");

-- CreateIndex
CREATE INDEX "DocumentAccessAudit_subjectType_idx" ON "DocumentAccessAudit"("subjectType");

-- CreateIndex
CREATE INDEX "DocumentAccessAudit_eventType_idx" ON "DocumentAccessAudit"("eventType");

-- CreateIndex
CREATE INDEX "DocumentAccessAudit_createdAt_idx" ON "DocumentAccessAudit"("createdAt");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAccessPolicy" ADD CONSTRAINT "DocumentAccessPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAccessPolicy" ADD CONSTRAINT "DocumentAccessPolicy_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAccessPolicy" ADD CONSTRAINT "DocumentAccessPolicy_subjectOrganizationId_fkey" FOREIGN KEY ("subjectOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAccessPolicy" ADD CONSTRAINT "DocumentAccessPolicy_subjectUnitId_fkey" FOREIGN KEY ("subjectUnitId") REFERENCES "OrganizationUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAccessPolicy" ADD CONSTRAINT "DocumentAccessPolicy_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAccessPolicy" ADD CONSTRAINT "DocumentAccessPolicy_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAccessPolicy" ADD CONSTRAINT "DocumentAccessPolicy_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAccessAudit" ADD CONSTRAINT "DocumentAccessAudit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAccessAudit" ADD CONSTRAINT "DocumentAccessAudit_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAccessAudit" ADD CONSTRAINT "DocumentAccessAudit_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "DocumentAccessPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAccessAudit" ADD CONSTRAINT "DocumentAccessAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

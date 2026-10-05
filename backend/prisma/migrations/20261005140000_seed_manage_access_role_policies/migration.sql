-- Seeds ROLE-subject MANAGE_ACCESS policies for existing published documents.
--
-- createInitialDocumentAccessPolicies now creates an OWNER and an ADMIN
-- ALLOW policy for MANAGE_ACCESS at publish time. Before this change the
-- only MANAGE_ACCESS policy was a USER-subject policy for the uploader, so
-- no document could ever be access-managed by anyone else: the first grant
-- was itself gated on MANAGE_ACCESS.
--
-- DocumentAccessPolicy."documentId" is NOT NULL, so a tenant-wide policy
-- cannot be expressed. This backfills the per-document equivalent for
-- documents published before the code change.
--
-- Idempotent: guarded by NOT EXISTS on (documentId, subjectRole, action),
-- so re-running inserts nothing.

INSERT INTO "DocumentAccessPolicy" (
    "id",
    "organizationId",
    "documentId",
    "subjectType",
    "subjectRole",
    "action",
    "effect",
    "validFrom",
    "grantedById",
    "isActive",
    "createdAt",
    "updatedAt"
)
SELECT
    'mngrole_' || md5(d."id" || '_' || r."role"),
    d."organizationId",
    d."id",
    'ROLE',
    r."role",
    'MANAGE_ACCESS',
    'ALLOW',
    CURRENT_TIMESTAMP,
    d."uploadedById",
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Document" d
CROSS JOIN (
    VALUES ('OWNER'::"Role"), ('ADMIN'::"Role")
) AS r("role")
WHERE d."status" NOT IN ('DRAFT')
  AND NOT EXISTS (
      SELECT 1
      FROM "DocumentAccessPolicy" p
      WHERE p."documentId" = d."id"
        AND p."action" = 'MANAGE_ACCESS'
        AND p."subjectType" = 'ROLE'
        AND p."subjectRole" = r."role"
        AND p."isActive" = true
  );

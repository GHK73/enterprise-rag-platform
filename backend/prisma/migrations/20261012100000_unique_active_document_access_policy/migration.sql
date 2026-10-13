-- Uniqueness of active access policies (see docs/DATABASE.md,
-- DocumentAccessPolicy): concurrent or retried policy creation
-- could produce duplicate identical active policies and duplicate
-- CREATED audit rows. The application-level duplicate check in
-- validateDocumentAccessPolicy is advisory; this partial unique
-- index is the real guard.
--
-- The index is partial (WHERE "isActive" = true) so a
-- revoked policy never blocks a later identical grant.
-- It is an expression index for two reasons:
--   1. PostgreSQL treats NULLs as distinct in unique
--      indexes, so COALESCE is required to make two
--      policies with the same (absent) subject compare
--      equal.
--   2. subjectRole and scope are enums; an empty-string
--      literal is not a valid enum value, so they are
--      cast to text before the COALESCE.
--
-- Workaround: Create IMMUTABLE wrapper functions for enum->text casts
-- because PostgreSQL requires index expression functions to be IMMUTABLE.

CREATE OR REPLACE FUNCTION immutable_enum_role_to_text(role_val "Role")
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$ SELECT role_val::text $$;

CREATE OR REPLACE FUNCTION immutable_enum_scope_to_text(scope_val "DocumentAccessScope")
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$ SELECT scope_val::text $$;

-- Deduplicate existing active policies first: keep the
-- earliest row per subject/action/effect combination.
DELETE FROM "DocumentAccessPolicy"
WHERE id IN (
    SELECT id
    FROM (
        SELECT
            id,
            ROW_NUMBER() OVER (
                PARTITION BY
                    "documentId",
                    "action",
                    "effect",
                    "subjectType",
                    COALESCE("subjectOrganizationId", ''),
                    COALESCE("subjectUnitId", ''),
                    COALESCE(immutable_enum_role_to_text("subjectRole"), ''),
                    COALESCE("subjectUserId", ''),
                    COALESCE(immutable_enum_scope_to_text("scope"), '')
                ORDER BY "createdAt" ASC, "id" ASC
            ) AS row_number
        FROM "DocumentAccessPolicy"
        WHERE "isActive" = true
    ) AS ranked
    WHERE ranked.row_number > 1
);

CREATE UNIQUE INDEX "DocumentAccessPolicy_unique_active_subject"
ON "DocumentAccessPolicy" (
    "documentId",
    "action",
    "effect",
    "subjectType",
    COALESCE("subjectOrganizationId", ''),
    COALESCE("subjectUnitId", ''),
    COALESCE(immutable_enum_role_to_text("subjectRole"), ''),
    COALESCE("subjectUserId", ''),
    COALESCE(immutable_enum_scope_to_text("scope"), '')
)
WHERE "isActive" = true;

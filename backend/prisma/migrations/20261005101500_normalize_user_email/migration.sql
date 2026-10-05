-- CreateExtension
CREATE EXTENSION IF NOT EXISTS citext;

-- Guard
--
-- Email is the account identity key. Before this migration a row could
-- store any casing, so `Alice@Corp.com` and `alice@corp.com` could both
-- exist as separate accounts for the same person. Normalizing them into
-- one column value would violate the existing unique index.
--
-- Fail loudly and name the offending addresses rather than letting the
-- UPDATE below die on an opaque unique violation, and rather than
-- silently merging two accounts that may belong to different tenants.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "User"
        GROUP BY LOWER(BTRIM("email"))
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Cannot normalize "User"."email": multiple accounts share the same address when compared case-insensitively. Merge or rename those accounts before applying this migration.';
    END IF;
END $$;

-- Backfill
--
-- Store the canonical form that `registerUser` and `loginUser` both use,
-- so every existing account is reachable by a normalized login.
UPDATE "User"
SET "email" = LOWER(BTRIM("email"))
WHERE "email" <> LOWER(BTRIM("email"));

-- AlterColumn
--
-- `citext` makes equality and the existing @unique constraint
-- case-insensitive, so the uniqueness guarantee survives any future code
-- path that writes an unnormalized address. Rebuilding the column type
-- also rebuilds the unique index on top of it.
ALTER TABLE "User"
ALTER COLUMN "email" TYPE CITEXT USING "email"::citext;

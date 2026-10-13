-- Enforce cleanup ordering: null currentVersionId before deleting versions
-- This trigger ensures that when a Document is deleted, its currentVersionId is set to NULL first
-- preventing the "onDelete: Restrict" constraint violation

CREATE OR REPLACE FUNCTION enforce_document_cleanup_ordering()
RETURNS TRIGGER AS $$
BEGIN
    -- When a document is being deleted, ensure currentVersionId is NULL
    IF TG_OP = 'DELETE' THEN
        IF OLD."currentVersionId" IS NOT NULL THEN
            RAISE EXCEPTION 'Cannot delete document with non-null currentVersionId. Null it first.';
        END IF;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_document_cleanup_ordering ON "Document";
CREATE TRIGGER enforce_document_cleanup_ordering
BEFORE DELETE ON "Document"
FOR EACH ROW EXECUTE FUNCTION enforce_document_cleanup_ordering();

-- Also add a trigger for DocumentVersion to prevent deletion if it's referenced as currentVersionId
CREATE OR REPLACE FUNCTION prevent_version_delete_if_current()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF EXISTS (
            SELECT 1 FROM "Document" 
            WHERE "currentVersionId" = OLD.id
        ) THEN
            RAISE EXCEPTION 'Cannot delete version that is set as currentVersionId on a document. Null the document''s currentVersionId first.';
        END IF;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_version_delete_if_current ON "DocumentVersion";
CREATE TRIGGER prevent_version_delete_if_current
BEFORE DELETE ON "DocumentVersion"
FOR EACH ROW EXECUTE FUNCTION prevent_version_delete_if_current();
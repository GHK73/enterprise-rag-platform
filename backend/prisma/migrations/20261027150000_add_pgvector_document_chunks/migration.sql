CREATE SCHEMA IF NOT EXISTS extensions;

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE public.ai_document_chunks (
    id UUID PRIMARY KEY,
    organization_id TEXT NOT NULL,
    document_id TEXT NOT NULL,
    version_id TEXT NOT NULL,
    chunk_id TEXT NOT NULL,
    page_number INTEGER NOT NULL DEFAULT 0,
    text TEXT NOT NULL,
    block_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    embedding extensions.vector(384) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ai_document_chunks_doc_version_chunk_key
        UNIQUE (document_id, version_id, chunk_id)
);

CREATE INDEX ai_document_chunks_organization_id_idx
    ON public.ai_document_chunks (organization_id);

CREATE INDEX ai_document_chunks_document_version_idx
    ON public.ai_document_chunks (document_id, version_id);

CREATE INDEX ai_document_chunks_embedding_hnsw_idx
    ON public.ai_document_chunks
    USING hnsw (embedding extensions.vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

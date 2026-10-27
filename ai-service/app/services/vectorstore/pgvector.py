from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING
from uuid import UUID, uuid5

import asyncpg

from app.config.settings import settings

if TYPE_CHECKING:
    from app.services.embedding.service import EmbeddedChunk

logger = logging.getLogger(__name__)

TABLE = "public.ai_document_chunks"
VECTOR_DIMENSION = 384
NAMESPACE = UUID("00000000-0000-0000-0000-000000000001")


class PgVectorStore:
    """Persist and search document chunks in Supabase PostgreSQL/pgvector."""

    def __init__(self) -> None:
        self.pool: asyncpg.Pool | None = None

    async def ensure_collection(self) -> None:
        if not settings.PGVECTOR_DATABASE_URL:
            raise RuntimeError("PGVECTOR_DATABASE_URL is not configured.")

        if self.pool is None:
            self.pool = await asyncpg.create_pool(
                dsn=settings.PGVECTOR_DATABASE_URL,
                min_size=1,
                max_size=max(1, settings.PGVECTOR_POOL_SIZE),
                ssl="require",
                command_timeout=60,
            )

        async with self.pool.acquire() as connection:
            extension_exists = await connection.fetchval(
                "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')"
            )
            table_exists = await connection.fetchval(
                "SELECT to_regclass('public.ai_document_chunks') IS NOT NULL"
            )

        if not extension_exists:
            raise RuntimeError(
                "The Supabase vector extension is not enabled. "
                "Apply the backend Prisma migration first."
            )
        if not table_exists:
            raise RuntimeError(
                "The ai_document_chunks table is missing. "
                "Apply the backend Prisma migration first."
            )

        logger.info("Supabase pgvector store is ready: table=%s", TABLE)

    async def upsert_chunks(
        self,
        organization_id: str,
        document_id: str,
        version_id: str,
        embedded_chunks: list[EmbeddedChunk],
    ) -> None:
        if not organization_id:
            raise ValueError("Organization ID cannot be empty.")
        if not embedded_chunks:
            logger.info(
                "No chunks to index: document=%s version=%s",
                document_id,
                version_id,
            )
            return

        records = []
        for item in embedded_chunks:
            chunk = item.chunk
            records.append(
                {
                    "id": self._create_point_id(
                        document_id, version_id, chunk.chunk_id
                    ),
                    "organization_id": organization_id,
                    "document_id": document_id,
                    "version_id": version_id,
                    "chunk_id": chunk.chunk_id,
                    "page_number": chunk.page_number or 0,
                    "text": chunk.text,
                    "block_ids": chunk.block_ids or [],
                    "metadata": chunk.metadata or {},
                    "embedding": item.embedding,
                }
            )

        await self.upsert_records(records)
        logger.info(
            "Indexed chunks into Supabase pgvector: document=%s version=%s count=%d",
            document_id,
            version_id,
            len(records),
        )

    async def upsert_records(self, records: list[dict]) -> None:
        if not records:
            return
        pool = self._require_pool()
        values = []
        for record in records:
            vector = record.get("embedding")
            if not vector or len(vector) != VECTOR_DIMENSION:
                raise ValueError(
                    f"Embedding must contain {VECTOR_DIMENSION} dimensions."
                )
            values.append(
                (
                    str(record["id"]),
                    str(record["organization_id"]),
                    str(record["document_id"]),
                    str(record["version_id"]),
                    str(record["chunk_id"]),
                    int(record.get("page_number") or 0),
                    str(record.get("text") or ""),
                    json.dumps(record.get("block_ids") or []),
                    json.dumps(record.get("metadata") or {}),
                    "[" + ",".join(format(float(value), ".9g") for value in vector) + "]",
                )
            )

        query = f"""
            INSERT INTO {TABLE} (
                id, organization_id, document_id, version_id, chunk_id,
                page_number, text, block_ids, metadata, embedding
            ) VALUES (
                $1::uuid, $2, $3, $4, $5, $6, $7,
                $8::jsonb, $9::jsonb, $10::extensions.vector
            )
            ON CONFLICT (document_id, version_id, chunk_id) DO UPDATE SET
                id = EXCLUDED.id,
                organization_id = EXCLUDED.organization_id,
                page_number = EXCLUDED.page_number,
                text = EXCLUDED.text,
                block_ids = EXCLUDED.block_ids,
                metadata = EXCLUDED.metadata,
                embedding = EXCLUDED.embedding
        """
        async with pool.acquire() as connection:
            await connection.executemany(query, values)

    async def get_version_points(
        self,
        document_id: str,
        version_id: str,
        limit: int = 100,
    ) -> list[dict]:
        self._validate_identifier(document_id, "Document ID")
        self._validate_identifier(version_id, "Version ID")
        if limit <= 0:
            raise ValueError("Limit must be greater than 0.")

        async with self._require_pool().acquire() as connection:
            rows = await connection.fetch(
                f"""
                SELECT id, chunk_id, document_id, version_id, page_number,
                       text, block_ids, metadata
                FROM {TABLE}
                WHERE document_id = $1 AND version_id = $2
                ORDER BY chunk_id
                LIMIT $3
                """,
                document_id,
                version_id,
                limit,
            )
        return [self._row_to_payload(row, include_id=True) for row in rows]

    async def delete_version(self, document_id: str, version_id: str) -> None:
        self._validate_identifier(document_id, "Document ID")
        self._validate_identifier(version_id, "Version ID")
        async with self._require_pool().acquire() as connection:
            await connection.execute(
                f"DELETE FROM {TABLE} WHERE document_id = $1 AND version_id = $2",
                document_id,
                version_id,
            )
        logger.info(
            "Deleted indexed version: document=%s version=%s",
            document_id,
            version_id,
        )

    async def delete_document(self, document_id: str) -> None:
        self._validate_identifier(document_id, "Document ID")
        async with self._require_pool().acquire() as connection:
            await connection.execute(
                f"DELETE FROM {TABLE} WHERE document_id = $1", document_id
            )
        logger.info("Deleted all indexed chunks for document=%s", document_id)

    async def search(
        self,
        query_vector: list[float],
        organization_id: str,
        limit: int = 5,
    ) -> list[dict]:
        if not query_vector:
            raise ValueError("Query vector cannot be empty.")
        if not organization_id:
            raise ValueError("Organization ID cannot be empty.")
        if limit <= 0:
            raise ValueError("Search limit must be greater than 0.")
        if len(query_vector) != VECTOR_DIMENSION:
            raise ValueError(
                f"Query vector must contain {VECTOR_DIMENSION} dimensions."
            )

        vector = "[" + ",".join(format(float(value), ".9g") for value in query_vector) + "]"
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                # Iterative HNSW scans keep filtered, organization-scoped
                # searches from returning too few candidates.
                await connection.execute(
                    "SET LOCAL hnsw.iterative_scan = 'strict_order'"
                )
                rows = await connection.fetch(
                    f"""
                    SELECT chunk_id, document_id, version_id, page_number,
                           text, block_ids, metadata,
                           1 - (embedding OPERATOR(extensions.<=>)
                                $1::extensions.vector) AS score
                    FROM {TABLE}
                    WHERE organization_id = $2
                    ORDER BY embedding OPERATOR(extensions.<=>)
                             $1::extensions.vector
                    LIMIT $3
                    """,
                    vector,
                    organization_id,
                    limit,
                )

        results = [self._row_to_payload(row) for row in rows]
        logger.info(
            "pgvector search completed: organization=%s results=%d",
            organization_id,
            len(results),
        )
        return results

    @staticmethod
    def _create_point_id(
        document_id: str,
        version_id: str,
        chunk_id: str,
    ) -> str:
        return str(uuid5(NAMESPACE, f"{document_id}:{version_id}:{chunk_id}"))

    @staticmethod
    def _validate_identifier(value: str, label: str) -> None:
        if not value:
            raise ValueError(f"{label} cannot be empty.")

    @staticmethod
    def _decode_json(value):
        return json.loads(value) if isinstance(value, str) else value

    @classmethod
    def _row_to_payload(cls, row, include_id: bool = False) -> dict:
        result = {
            "chunk_id": row["chunk_id"],
            "document_id": row["document_id"],
            "version_id": row["version_id"],
            "page_number": row["page_number"],
            "text": row["text"],
            "block_ids": cls._decode_json(row["block_ids"]) or [],
            "metadata": cls._decode_json(row["metadata"]) or {},
        }
        if "score" in row:
            result["score"] = float(row["score"])
        if include_id:
            result["point_id"] = str(row["id"])
        return result

    def _require_pool(self) -> asyncpg.Pool:
        if self.pool is None:
            raise RuntimeError("Supabase pgvector pool is not initialized.")
        return self.pool

    async def close(self) -> None:
        if self.pool is not None:
            await self.pool.close()
            self.pool = None


pgvector_store = PgVectorStore()

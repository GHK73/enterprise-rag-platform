"""Copy the existing Qdrant collection into the Supabase pgvector table."""

from __future__ import annotations

import asyncio
import logging

from qdrant_client import AsyncQdrantClient

from app.config.settings import settings
from app.services.vectorstore.pgvector import pgvector_store

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BATCH_SIZE = 128


def _vector_values(point) -> list[float]:
    vector = point.vector
    if isinstance(vector, dict):
        if len(vector) != 1:
            raise ValueError(
                f"Point {point.id} has named vectors; map the desired vector explicitly."
            )
        vector = next(iter(vector.values()))
    return [float(value) for value in vector]


async def migrate() -> None:
    if not settings.QDRANT_URL or not settings.QDRANT_API_KEY:
        raise RuntimeError("QDRANT_URL and QDRANT_API_KEY must be set for migration.")

    source = AsyncQdrantClient(
        url=settings.QDRANT_URL,
        api_key=settings.QDRANT_API_KEY,
    )
    await pgvector_store.ensure_collection()

    offset = None
    copied = 0
    try:
        while True:
            points, next_offset = await source.scroll(
                collection_name=settings.QDRANT_COLLECTION,
                limit=BATCH_SIZE,
                offset=offset,
                with_payload=True,
                with_vectors=True,
            )
            records = []
            for point in points:
                payload = point.payload or {}
                records.append(
                    {
                        "id": str(point.id),
                        "organization_id": payload.get("organization_id", ""),
                        "document_id": payload.get("document_id", ""),
                        "version_id": payload.get("version_id", ""),
                        "chunk_id": payload.get("chunk_id", ""),
                        "page_number": payload.get("page_number", 0),
                        "text": payload.get("text", ""),
                        "block_ids": payload.get("block_ids", []),
                        "metadata": payload.get("metadata", {}),
                        "embedding": _vector_values(point),
                    }
                )
            await pgvector_store.upsert_records(records)
            copied += len(records)
            logger.info("Copied %d Qdrant points", copied)

            if next_offset is None:
                break
            offset = next_offset
    finally:
        await source.close()
        await pgvector_store.close()

    logger.info("Qdrant to pgvector migration complete: points=%d", copied)


if __name__ == "__main__":
    asyncio.run(migrate())

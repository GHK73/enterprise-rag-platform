from __future__ import annotations

import logging
from uuid import UUID, uuid5

from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Distance,
    PointStruct,
    VectorParams,
)

from app.config.settings import settings
from app.services.embedding.service import (
    EmbeddedChunk,
    embedding_service,
)


logger = logging.getLogger(__name__)


class QdrantVectorStore:

    def __init__(self) -> None:
        self.client = AsyncQdrantClient(
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY,
        )

        self.collection_name = settings.QDRANT_COLLECTION

        self.vector_size = embedding_service.dimension

    async def ensure_collection(self) -> None:
        """
        Ensure the Qdrant Cloud collection exists.
        """

        exists = await self.client.collection_exists(
            collection_name=self.collection_name,
        )

        if exists:
            logger.info(
                "Qdrant collection already exists: %s",
                self.collection_name,
            )
            return

        logger.info(
            "Creating Qdrant collection: %s",
            self.collection_name,
        )

        await self.client.create_collection(
            collection_name=self.collection_name,
            vectors_config=VectorParams(
                size=self.vector_size,
                distance=Distance.COSINE,
            ),
        )

        logger.info(
            "Qdrant collection created: %s",
            self.collection_name,
        )

    async def upsert_chunks(
        self,
        document_id: str,
        version_id: str,
        embedded_chunks: list[EmbeddedChunk],
    ) -> None:
        """
        Store document chunk embeddings in Qdrant Cloud.
        """

        if not embedded_chunks:
            logger.info(
                "No chunks to index: document=%s version=%s",
                document_id,
                version_id,
            )
            return

        points: list[PointStruct] = []

        for embedded_chunk in embedded_chunks:
            chunk = embedded_chunk.chunk

            point_id = self._create_point_id(
                document_id=document_id,
                version_id=version_id,
                chunk_id=chunk.chunk_id,
            )

            payload = {
                "document_id": document_id,
                "version_id": version_id,
                "chunk_id": chunk.chunk_id,
                "page_number": chunk.page_number,
                "text": chunk.text,
                "block_ids": chunk.block_ids,
                "metadata": chunk.metadata,
            }

            point = PointStruct(
                id=point_id,
                vector=embedded_chunk.embedding,
                payload=payload,
            )

            points.append(point)

        await self.client.upsert(
            collection_name=self.collection_name,
            points=points,
            wait=True,
        )

        logger.info(
            "Indexed chunks into Qdrant Cloud: "
            "document=%s version=%s count=%d",
            document_id,
            version_id,
            len(points),
        )

    async def search(
        self,
        query_vector: list[float],
        limit: int = 5,
    ) -> list[dict]:
        """
        Search Qdrant Cloud using a query embedding.
        """

        if not query_vector:
            raise ValueError(
                "Query vector cannot be empty."
            )

        if limit <= 0:
            raise ValueError(
                "Search limit must be greater than 0."
            )

        results = await self.client.query_points(
            collection_name=self.collection_name,
            query=query_vector,
            limit=limit,
            with_payload=True,
        )

        retrieved_chunks: list[dict] = []

        for result in results.points:
            payload = result.payload or {}

            retrieved_chunks.append(
                {
                    "chunk_id": payload.get(
                        "chunk_id",
                        "",
                    ),
                    "document_id": payload.get(
                        "document_id",
                        "",
                    ),
                    "version_id": payload.get(
                        "version_id",
                        "",
                    ),
                    "page_number": payload.get(
                        "page_number",
                        0,
                    ),
                    "text": payload.get(
                        "text",
                        "",
                    ),
                    "score": float(result.score),
                    "block_ids": payload.get(
                        "block_ids",
                        [],
                    ),
                    "metadata": payload.get(
                        "metadata",
                        {},
                    ),
                }
            )

        logger.info(
            "Qdrant search completed: results=%d",
            len(retrieved_chunks),
        )

        return retrieved_chunks

    @staticmethod
    def _create_point_id(
        document_id: str,
        version_id: str,
        chunk_id: str,
    ) -> str:
        """
        Create a deterministic UUID for a document chunk.

        The same document, version, and chunk combination
        always produces the same Qdrant point ID.
        """

        value = (
            f"{document_id}:"
            f"{version_id}:"
            f"{chunk_id}"
        )

        namespace = UUID(
            "00000000-0000-0000-0000-000000000001"
        )

        return str(
            uuid5(
                namespace,
                value,
            )
        )

    async def close(self) -> None:
        """
        Close the Qdrant Cloud client.
        """

        await self.client.close()


qdrant_vector_store = QdrantVectorStore()
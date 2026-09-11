from __future__ import annotations

import logging
from uuid import UUID, uuid5

from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PayloadSchemaType,
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
        Ensure the Qdrant Cloud collection exists and contains
        the payload indexes required for document filtering.
        """

        exists = await self.client.collection_exists(
            collection_name=self.collection_name,
        )

        if not exists:
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
        else:
            logger.info(
                "Qdrant collection already exists: %s",
                self.collection_name,
            )

        await self._ensure_payload_indexes()

    async def _ensure_payload_indexes(self) -> None:
   
        payload_indexes = {
            "document_id": PayloadSchemaType.KEYWORD,
            "version_id": PayloadSchemaType.KEYWORD,
            "chunk_id": PayloadSchemaType.KEYWORD,
        }

        collection_info = (
            await self.client.get_collection(
                collection_name=self.collection_name,
            )
        )

        existing_indexes = (
            collection_info.payload_schema
        )

        for field_name, field_schema in payload_indexes.items():

            if field_name in existing_indexes:
                logger.info(
                    "Qdrant payload index already exists: %s",
                    field_name,
                )
                continue

            logger.info(
                "Creating Qdrant payload index: %s",
                field_name,
            )

            await self.client.create_payload_index(
                collection_name=self.collection_name,
                field_name=field_name,
                field_schema=field_schema,
                wait=True,
            )

            logger.info(
                "Qdrant payload index created: %s",
                field_name,
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

    async def get_version_points(
        self,
        document_id: str,
        version_id: str,
        limit: int = 100,
    ) -> list[dict]:
           

        if not document_id:
            raise ValueError(
                "Document ID cannot be empty."
            )

        if not version_id:
            raise ValueError(
                "Version ID cannot be empty."
            )

        if limit <= 0:
            raise ValueError(
                "Limit must be greater than 0."
            )

        result = await self.client.scroll(
            collection_name=self.collection_name,
            scroll_filter=Filter(
                must=[
                    FieldCondition(
                        key="document_id",
                        match=MatchValue(
                            value=document_id,
                        ),
                    ),
                    FieldCondition(
                        key="version_id",
                        match=MatchValue(
                            value=version_id,
                        ),
                    ),
                ],
            ),
            limit=limit,
            with_payload=True,
            with_vectors=False,
        )

        points, _ = result

        indexed_chunks: list[dict] = []

        for point in points:
            payload = point.payload or {}

            indexed_chunks.append(
                {
                    "point_id": str(point.id),
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
            "Retrieved indexed chunks: "
            "document=%s version=%s count=%d",
            document_id,
            version_id,
            len(indexed_chunks),
        )

        return indexed_chunks

    async def delete_version(
        self,
        document_id: str,
        version_id: str,
    ) -> None:
        """
        Delete all indexed chunks belonging to a document version.
        """

        if not document_id:
            raise ValueError(
                "Document ID cannot be empty."
            )

        if not version_id:
            raise ValueError(
                "Version ID cannot be empty."
            )

        await self.client.delete(
            collection_name=self.collection_name,
            points_selector=Filter(
                must=[
                    FieldCondition(
                        key="document_id",
                        match=MatchValue(
                            value=document_id,
                        ),
                    ),
                    FieldCondition(
                        key="version_id",
                        match=MatchValue(
                            value=version_id,
                        ),
                    ),
                ],
            ),
            wait=True,
        )

        logger.info(
            "Deleted indexed version: "
            "document=%s version=%s",
            document_id,
            version_id,
        )

    async def delete_document(
        self,
        document_id: str,
    ) -> None:
        """
        Delete all indexed chunks belonging to a document.
        """

        if not document_id:
            raise ValueError(
                "Document ID cannot be empty."
            )

        await self.client.delete(
            collection_name=self.collection_name,
            points_selector=Filter(
                must=[
                    FieldCondition(
                        key="document_id",
                        match=MatchValue(
                            value=document_id,
                        ),
                    ),
                ],
            ),
            wait=True,
        )

        logger.info(
            "Deleted all indexed chunks for document=%s",
            document_id,
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

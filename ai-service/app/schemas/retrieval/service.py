# ai-service/app/schemas/retrieval/service.py
from __future__ import annotations
import logging

from app.schemas.retrieval import (
    RetrievalRequest,
    RetrievalResult,
)
from app.services.embedding import embedding_service
from app.services.vectorstore import qdrant_vector_store

logger = logging.getLogger(__name__)


class RetrievalService:

    async def retrieve(
        self,
        request: RetrievalRequest,
    ) -> list[RetrievalResult]:

        logger.info(
            "Retrieval started: query=%s top_k=%d",
            request.query,
            request.top_k,
        )

        # 1. Convert query into an embedding
        query_embedding = embedding_service.embed_texts(
            [request.query]
        )[0]

        logger.info(
            "Query embedding generated: dimension=%d",
            len(query_embedding),
        )

        # 2. Search Qdrant Cloud
        results = await qdrant_vector_store.search(
            query_vector=query_embedding,
            limit=request.top_k,
        )

        logger.info(
            "Retrieval completed: results=%d",
            len(results),
        )

        return [
            RetrievalResult(
                chunk_id=result["chunk_id"],
                document_id=result["document_id"],
                version_id=result["version_id"],
                page_number=result["page_number"],
                text=result["text"],
                score=result["score"],
                block_ids=result.get(
                    "block_ids",
                    [],
                ),
                metadata=result.get(
                    "metadata",
                    {},
                ),
            )
            for result in results
        ]


retrieval_service = RetrievalService()
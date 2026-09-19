from __future__ import annotations

import logging

from app.schemas.retrieval import RetrievalRequest, RetrievalResult
from app.services.embedding import embedding_service
from app.services.vectorstore import qdrant_vector_store

logger = logging.getLogger(__name__)


class RetrievalService:
    CANDIDATE_MULTIPLIER = 5
    MAX_CANDIDATES = 200

    async def retrieve_candidates(
        self,
        request: RetrievalRequest,
    ) -> list[RetrievalResult]:

        logger.info(
            "Candidate retrieval started: query=%s top_k=%d",
            request.query,
            request.top_k,
        )

        query_embedding = embedding_service.embed_texts(
            [request.query]
        )[0]

        logger.info(
            "Query embedding generated: dimension=%d",
            len(query_embedding),
        )

        candidate_limit = min(
            request.top_k * self.CANDIDATE_MULTIPLIER,
            self.MAX_CANDIDATES,
        )

        candidates = await qdrant_vector_store.search(
            query_vector=query_embedding,
            limit=candidate_limit,
        )

        results = [
            RetrievalResult(
                chunk_id=result.get("chunk_id", ""),
                document_id=result.get("document_id", ""),
                version_id=result.get("version_id", ""),
                page_number=result.get("page_number", 0),
                text=result.get("text", ""),
                score=float(result.get("score", 0.0)),
                block_ids=result.get("block_ids", []),
                metadata=result.get("metadata", {}),
            )
            for result in candidates
        ]

        logger.info(
            "Candidate retrieval completed: requested=%d returned=%d",
            candidate_limit,
            len(results),
        )

        return results

    def get_candidate_document_ids(
        self,
        candidates: list[RetrievalResult],
    ) -> list[str]:

        return list(
            dict.fromkeys(
                candidate.document_id
                for candidate in candidates
                if candidate.document_id
            )
        )

    def filter_authorized_candidates(
        self,
        candidates: list[RetrievalResult],
        authorized_document_ids: set[str],
    ) -> list[RetrievalResult]:

        return [
            candidate
            for candidate in candidates
            if candidate.document_id in authorized_document_ids
        ]

    def select_top_k(
        self,
        candidates: list[RetrievalResult],
        top_k: int,
    ) -> list[RetrievalResult]:

        return candidates[:top_k] if top_k > 0 else []


retrieval_service = RetrievalService()
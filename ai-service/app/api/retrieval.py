# ai-service/app/api/retrieval.py
from fastapi import APIRouter

from app.schemas.retrieval import (
    RetrievalRequest,
    RetrievalResponse,
)
from app.services.retrieval.service import retrieval_service

router = APIRouter()


@router.post(
    "/retrieve",
    response_model=RetrievalResponse,
)
async def retrieve(request: RetrievalRequest):
    results = await retrieval_service.retrieve_candidates(request)

    return RetrievalResponse(
        query=request.query,
        results=results,
    )
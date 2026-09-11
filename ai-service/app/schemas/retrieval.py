# ai-service/app/schemas/retrieval.py
from pydantic import BaseModel, Field


class RetrievalRequest(BaseModel):
    query: str = Field(
        min_length=1,
        description="User search query",
    )

    top_k: int = Field(
        default=5,
        ge=1,
        le=50,
        description="Number of chunks to retrieve",
    )


class RetrievalResult(BaseModel):
    chunk_id: str
    document_id: str
    version_id: str
    page_number: int
    text: str
    score: float
    block_ids: list[str] = Field(
        default_factory=list
    )
    metadata: dict = Field(
        default_factory=dict
    )


class RetrievalResponse(BaseModel):
    query: str
    results: list[RetrievalResult]
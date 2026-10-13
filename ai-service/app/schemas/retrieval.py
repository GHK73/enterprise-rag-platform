# ai-service/app/schemas/retrieval.py
from pydantic import BaseModel, Field, field_validator


class RetrievalRequest(BaseModel):
    query: str = Field(
        min_length=1,
        description="User search query",
    )

    organization_id: str = Field(
        min_length=1,
        description="Organization requesting retrieval",
    )

    top_k: int = Field(
        default=5,
        ge=1,
        le=50,
        description="Number of authorized chunks to return",
    )

    @field_validator("query")
    @classmethod
    def query_must_not_be_whitespace(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Query cannot be whitespace-only.")
        return value

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
    chunk_type: str = "text"

class RetrievalResponse(BaseModel):
    query: str
    results: list[RetrievalResult]

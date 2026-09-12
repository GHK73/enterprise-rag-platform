# ai-service/app/schemas/processing.py
from pydantic import BaseModel, Field, HttpUrl

class ProcessDocumentRequest(BaseModel):
    document_id: str = Field(min_length=1)
    version_id: str = Field(min_length=1)
    file_url: HttpUrl


class ProcessDocumentResponse(BaseModel):
    success: bool
    message: str
    document_id: str
    version_id: str
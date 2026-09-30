from pydantic import BaseModel, Field, HttpUrl


class ProcessDocumentRequest(BaseModel):
    document_id: str = Field(min_length=1)
    version_id: str = Field(min_length=1)
    organization_id: str = Field(min_length=1)
    file_url: HttpUrl
    file_name: str = Field(min_length=1)


class ProcessDocumentResponse(BaseModel):
    success: bool
    message: str
    document_id: str
    version_id: str
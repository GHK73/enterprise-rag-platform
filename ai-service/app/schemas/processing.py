# ai-service/app/schemas/processing.py

from pydantic import BaseModel 
from pydantic import HttpUrl 

class ProcessDocumentRequest(BaseModel):
    document_id: str 
    version_id: str 
    file_url: HttpUrl 

class ProcessDocumentResponse(BaseModel):
    success: bool 
    message: str 
    document_id: str 
    version_id: str
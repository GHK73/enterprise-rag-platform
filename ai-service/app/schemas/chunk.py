# ai-service/app/schemas/chunk.py

from pydantic import BaseModel 

class DocumentChunk(BaseModel):
    chunk_id: int 
    content: str 
    start_offset: int 
    end_offset: int
# ai-servic/app/config/chunking.py

from pydantic import BaseModel 

class ChunkingConfig(BaseModel):
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200
    MIN_CHUNK_SIZE: int = 100

chnking_config = ChunkingConfig()
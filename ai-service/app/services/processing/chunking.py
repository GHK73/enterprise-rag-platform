# ai-service/app/services/processing/chunking.py

from app.config.chunking import chunking_config
from app.schemas.chunk import DocumentChunk 

class ChunkingService:
    async def create_chunks(self, text: str,)->list[DocumentChunk]:
        chunks = []
        start = 0
        chunk_id = 1
        while start < len(text):
            end = min(start+chunking_config.CHUNK_SIZE,len(text),)
            chunk_text = text[start:end].strip()
            if len(chunk_text) >= chunking_config.MIN_CHUNK_SIZE:
                chunks.append(
                    DocumentChunk(
                        chunk_id = chunk_id,
                        content= chunk_text,
                        start_offset = start,
                        end_offset=end,
                    )
                )
                chunk_id += 1
            start += (
                chunking_config.CHUNK_SIZE- chunking_config.CHUNK_OVERLAP
            )
        return chunks 

chunking_service = ChunkingService()
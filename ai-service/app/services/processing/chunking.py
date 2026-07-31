# ai-service/app/services/processing/chunking.py

from __future__ import annotations
import logging
from dataclasses import dataclass,field
from app.schemas.document import(
    BlockType,
    Document,
    DocumentBlock,
    TextBlock,
)

logger = logging.getLogger(__name__)

@dataclass
class Chunk:
    chunk_id: str
    page_number: int
    text: str
    block_ids: list[str] = field(default_factory=list)
    metadata: dict =field(default_factory=dict)

class ChunkingService:
    def __init__(self,chunk_size: int =1000, chunk_overlap: int=200,)->None:
        self.chunk_size=chunk_size
        self.chunk_overlap=chunk_overlap

    def chunk(self,document: Document)->list[Chunk]:
        chunks=[]
        for page in document.pages:
            current_text=""
            current_blocks=[]
            for block in page.blocks:
                if not self._is_text_block(block):
                    continue
                text = block.text.strip()
                if not text:
                    continue
                if len(current_text)+len(text)> self.chunk_size:
                    chunks.append(
                        self._create_chunk(
                            page.page_number,
                            current_text,
                            current_blocks,
                        )
                    )
                    overlap = current_text[-self.chunk_overlap:]
                    current_text=overlap
                    current_blocks=[]
                current_text += "\n"+text
                current_blocks.append(block)

            if current_text.strip():
                chunks.append(
                    self._create_chunk(
                        page.page_number,
                        current_text,
                        current_blocks,
                    )
                )
        return chunks

    def _create_chunk(self,page_number:int, text: str, blocks: list[DocumentBlock],)->Chunk:
        return Chunk(
            chunk_id=f"chunk_{len(blocks)}_{page_number}",
            page_number=page_number,
            text=text.strip(),
            block_ids=[
                block.block_id
                for block in blocks 
            ],
            metadata={"block_count":len(blocks),},
        )

    def _is_text_block(self, block:DocumentBlock,)->bool:
        return (
            isinstance(block, TextBlock)
            or block.block_type
            in {
                BlockType.TEXT,
                BlockType.HEADING,
                BlockType.LIST,
                BlockType.CODE,
            }
        )
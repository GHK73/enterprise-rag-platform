# ai-service/app/services/processing/chunking.py

from __future__ import annotations
import logging
from dataclasses import dataclass, field
from app.schemas.document import (
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
    metadata: dict = field(default_factory=dict)


class ChunkingService:
    def __init__(
        self,
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
    ) -> None:

        if chunk_size <= 0:
            raise ValueError("chunk_size must be greater than 0.")

        if chunk_overlap < 0:
            raise ValueError("chunk_overlap cannot be negative.")

        if chunk_overlap >= chunk_size:
            raise ValueError(
                "chunk_overlap must be smaller than chunk_size."
            )

        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def chunk(self, document: Document) -> list[Chunk]:
        """
        Convert a normalized document into retrieval-ready chunks.

        Chunks are currently created page-by-page using character-based
        chunking. Later this can be replaced with token-aware,
        section-aware, or semantic chunking without changing the
        rest of the pipeline.
        """

        chunks: list[Chunk] = []

        chunk_index = 0

        for page in document.pages:

            current_text = ""
            current_blocks: list[DocumentBlock] = []

            for block in page.blocks:

                if not self._is_text_block(block):
                    continue

                text = block.text.strip()

                if not text:
                    continue

                # If adding this block exceeds the configured size,
                # finalize the current chunk first.
                if (
                    current_text
                    and len(current_text) + len(text) + 1
                    > self.chunk_size
                ):
                    chunk = self._create_chunk(
                        chunk_index=chunk_index,
                        page_number=page.page_number,
                        text=current_text,
                        blocks=current_blocks,
                    )

                    chunks.append(chunk)
                    chunk_index += 1

                    # Preserve text overlap.
                    overlap_text = current_text[
                        max(
                            0,
                            len(current_text) - self.chunk_overlap,
                        ):
                    ]

                    current_text = overlap_text

                    # We intentionally do not blindly copy block IDs
                    # because the overlap is character-based and may
                    # represent only part of a block.
                    current_blocks = []

                if current_text:
                    current_text += "\n"

                current_text += text
                current_blocks.append(block)

                # Handle a single block larger than chunk_size.
                while len(current_text) > self.chunk_size:

                    split_point = self.chunk_size

                    chunk_text = current_text[:split_point].strip()

                    if chunk_text:
                        chunk = self._create_chunk(
                            chunk_index=chunk_index,
                            page_number=page.page_number,
                            text=chunk_text,
                            blocks=current_blocks,
                        )

                        chunks.append(chunk)
                        chunk_index += 1

                    overlap_text = current_text[
                        max(
                            0,
                            split_point - self.chunk_overlap,
                        ):
                    ]

                    current_text = overlap_text

                    # The remaining text belongs to the same original
                    # block. We retain its block ID.
                    current_blocks = [block]

            # Flush remaining page content.
            if current_text.strip():

                chunk = self._create_chunk(
                    chunk_index=chunk_index,
                    page_number=page.page_number,
                    text=current_text,
                    blocks=current_blocks,
                )

                chunks.append(chunk)
                chunk_index += 1

        logger.info(
            "Chunking completed: pages=%d chunks=%d",
            len(document.pages),
            len(chunks),
        )

        return chunks

    def _create_chunk(
        self,
        chunk_index: int,
        page_number: int,
        text: str,
        blocks: list[DocumentBlock],
    ) -> Chunk:

        block_ids = [
            block.block_id
            for block in blocks
            if block.block_id
        ]

        return Chunk(
            chunk_id=f"chunk_{chunk_index:06d}",
            page_number=page_number,
            text=text.strip(),
            block_ids=block_ids,
            metadata={
                "chunk_index": chunk_index,
                "page_number": page_number,
                "block_count": len(block_ids),
                "character_count": len(text.strip()),
            },
        )

    def _is_text_block(
        self,
        block: DocumentBlock,
    ) -> bool:

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


chunking_service = ChunkingService()
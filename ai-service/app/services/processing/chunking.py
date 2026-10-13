# ai-service/app/services/processing/chunking.py
from __future__ import annotations
import logging
from dataclasses import dataclass, field
from app.schemas.document import (
    BlockType,
    Document,
    DocumentBlock,
    TableBlock,
    ImageBlock,
    FigureBlock,
    TextBlock,
)

logger = logging.getLogger(__name__)

@dataclass
class Chunk:
    chunk_id: str
    page_number: int
    text: str
    block_ids: list[str] = field(default_factory=list)
    metadata: dict[str, object] = field(default_factory=dict)

class ChunkingService:

    def __init__(
        self,
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
    ) -> None:

        if chunk_size <= 0:
            raise ValueError(
                "chunk_size must be greater than 0."
            )

        if chunk_overlap < 0:
            raise ValueError(
                "chunk_overlap cannot be negative."
            )

        if chunk_overlap >= chunk_size:
            raise ValueError(
                "chunk_overlap must be smaller than chunk_size."
            )

        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def chunk(self, document: Document) -> list[Chunk]:
        """
        Convert a normalized document into retrieval-ready chunks.

        Current strategy:
        - page-by-page
        - character-based chunking
        - configurable chunk size
        - configurable character overlap
        - oversized blocks are split safely
        """

        chunks: list[Chunk] = []
        chunk_index = 0

        for page in document.pages:
            current_text = ""
            current_blocks: list[DocumentBlock] = []

            for block in page.blocks:
                text = self._block_to_text(block)

                if text is None:
                    continue

                text = text.strip()

                if not text:
                    continue

                # Flush the current chunk if adding this block
                # would exceed the configured chunk size.
                if (
                    current_text
                    and len(current_text) + len(text) + 1
                    > self.chunk_size
                ):
                    chunks.append(
                        self._create_chunk(
                            chunk_index=chunk_index,
                            page_number=page.page_number,
                            text=current_text,
                            blocks=current_blocks,
                        )
                    )

                    chunk_index += 1

                    current_text = self._get_overlap(
                        current_text
                    )

                    # The overlap is text only. It may represent
                    # only part of the previous block.
                    current_blocks = []

                # Handle a block larger than the configured
                # chunk size.
                if len(text) > self.chunk_size:

                    if current_text:
                        chunks.append(
                            self._create_chunk(
                                chunk_index=chunk_index,
                                page_number=page.page_number,
                                text=current_text,
                                blocks=current_blocks,
                            )
                        )

                        chunk_index += 1

                        current_text = self._get_overlap(
                            current_text
                        )

                        current_blocks = []

                    while len(text) > self.chunk_size:
                        chunk_text = text[
                            :self.chunk_size
                        ].strip()

                        if chunk_text:
                            chunks.append(
                                self._create_chunk(
                                    chunk_index=chunk_index,
                                    page_number=page.page_number,
                                    text=chunk_text,
                                    blocks=[block],
                                )
                            )

                            chunk_index += 1

                        text = text[
                            self.chunk_size
                            - self.chunk_overlap:
                        ]

                    if text:
                        current_text = text
                        current_blocks = [block]

                    continue

                if current_text:
                    current_text += "\n"

                current_text += text
                current_blocks.append(block)

            # Flush remaining content from this page.
            if current_text.strip():
                chunks.append(
                    self._create_chunk(
                        chunk_index=chunk_index,
                        page_number=page.page_number,
                        text=current_text,
                        blocks=current_blocks,
                    )
                )

                chunk_index += 1

        logger.info(
            "Chunking completed: pages=%d chunks=%d",
            len(document.pages),
            len(chunks),
        )

        return chunks

    def _block_to_text(self, block: DocumentBlock) -> str | None:
        if isinstance(block, TextBlock):
            return block.text

        if block.block_type == BlockType.TABLE:
            table = block
            lines: list[str] = []
            if table.headers:
                lines.append(" | ".join(table.headers))
                lines.append(" | ".join(["---"] * len(table.headers)))
            for row in table.rows:
                lines.append(" | ".join(row))
            return "\n".join(lines)

        if block.block_type in (BlockType.IMAGE, BlockType.FIGURE):
            image = block
            if image.caption:
                return image.caption
            if hasattr(image, "ocr_text") and image.ocr_text:
                return image.ocr_text
            return None

        return None

    def _determine_chunk_type(self, blocks: list[DocumentBlock]) -> str:
        """Determine the dominant chunk type from blocks."""
        if not blocks:
            return "text"
        
        type_counts: dict[str, int] = {}
        for block in blocks:
            block_type = block.block_type.value if hasattr(block.block_type, 'value') else str(block.block_type)
            type_counts[block_type] = type_counts.get(block_type, 0) + 1
        
        return max(type_counts, key=type_counts.get).lower()

    def _extract_type_metadata(self, blocks: list[DocumentBlock], chunk_type: str) -> dict:
        """Extract type-specific metadata from blocks."""
        metadata = {}
        
        if chunk_type == "table":
            table_blocks = [b for b in blocks if b.block_type.value == "TABLE"]
            if table_blocks:
                table = table_blocks[0]
                if table.headers:
                    metadata["headers"] = table.headers
                if table.rows:
                    metadata["rows"] = table.rows
                metadata["markdown"] = self._table_to_markdown(table)
                
        elif chunk_type == "formula":
            formula_blocks = [b for b in blocks if b.block_type.value == "FORMULA"]
            if formula_blocks:
                formula = formula_blocks[0]
                if hasattr(formula, 'latex') and formula.latex:
                    metadata["latex"] = formula.latex
                    
        elif chunk_type in ("figure", "image"):
            figure_blocks = [b for b in blocks if b.block_type.value in ("FIGURE", "IMAGE")]
            if figure_blocks:
                fig = figure_blocks[0]
                if fig.caption:
                    metadata["caption"] = fig.caption
                if hasattr(fig, 'description') and fig.description:
                    metadata["description"] = fig.description
                    
        elif chunk_type == "code":
            code_blocks = [b for b in blocks if b.block_type.value == "CODE"]
            if code_blocks:
                code = code_blocks[0]
                if hasattr(code, 'language') and code.language:
                    metadata["language"] = code.language
                    
        return metadata

    def _table_to_markdown(self, table) -> str:
        """Convert table block to markdown."""
        lines = []
        if table.headers:
            lines.append(" | ".join(table.headers))
            lines.append(" | ".join(["---"] * len(table.headers)))
        for row in table.rows:
            lines.append(" | ".join(row))
        return "\n".join(lines)

    def _create_chunk(
        self,
        chunk_index: int,
        page_number: int,
        text: str,
        blocks: list[DocumentBlock],
    ) -> Chunk:

        text = text.strip()

        if not text:
            raise ValueError(
                "Cannot create an empty chunk."
            )

        block_ids = [
            block.block_id
            for block in blocks
            if block.block_id
        ]

        chunk_type = self._determine_chunk_type(blocks)
        type_metadata = self._extract_type_metadata(blocks, chunk_type)

        return Chunk(
            chunk_id=f"chunk_{chunk_index:06d}",
            page_number=page_number,
            text=text,
            block_ids=block_ids,
            metadata={
                "chunk_index": chunk_index,
                "page_number": page_number,
                "block_count": len(block_ids),
                "character_count": len(text),
                "chunk_type": chunk_type,
                **type_metadata,
            },
        )

    def _get_overlap(self, text: str) -> str:
        if self.chunk_overlap == 0:
            return ""

        return text[
            max(0, len(text) - self.chunk_overlap):
        ]


chunking_service = ChunkingService()

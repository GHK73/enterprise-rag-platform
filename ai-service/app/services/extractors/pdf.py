# ai-service/app/services/extractors/pdf.py
from __future__ import annotations

import logging
from pathlib import Path

import fitz

from app.schemas.document import (
    BlockType,
    BoundingBox,
    Document,
    DocumentMetadata,
    DocumentPage,
    DocumentType,
    ImageBlock,
    TableBlock,
    TextBlock,
)
from app.services.extractors.base import BaseExtractor
from app.services.extractors.table import TableExtractor

logger = logging.getLogger(__name__)


class PDFExtractor(BaseExtractor):
    SUPPORTED_EXTENSIONS = {".pdf"}

    def __init__(self) -> None:
        super().__init__()
        self.table_extractor = TableExtractor()

    def extract(
        self,
        file_path: str | Path,
    ) -> Document:

        path = self.validate_file(file_path)
        start = self.log_start(path)

        try:
            with fitz.open(path) as pdf:
                document = Document(
                    metadata=self._extract_metadata(
                        pdf,
                        path,
                    )
                )

                for page_number, page in enumerate(
                    pdf,
                    start=1,
                ):
                    document.pages.append(
                        self._extract_page(
                            page,
                            page_number,
                            path,
                        )
                    )

            self.log_success(path, start)
            return document

        except Exception as error:
            self.log_failure(path, error)
            raise

    def _extract_metadata(
        self,
        pdf: fitz.Document,
        path: Path,
    ) -> DocumentMetadata:

        metadata = pdf.metadata or {}

        return DocumentMetadata(
            filename=path.name,
            document_type=DocumentType.PDF,
            title=metadata.get("title") or None,
            author=metadata.get("author") or None,
            producer=metadata.get("producer") or None,
            page_count=pdf.page_count,
            metadata={
                "subject": metadata.get("subject") or None,
                "creator": metadata.get("creator") or None,
            },
        )

    def _extract_page(
        self,
        page: fitz.Page,
        page_number: int,
        file_path: Path,
    ) -> DocumentPage:

        page_data = DocumentPage(
            page_number=page_number
        )

        page_data.blocks.extend(
            self._extract_text(
                page,
                page_number,
            )
        )

        page_data.blocks.extend(
            self._extract_images(
                page,
                page_number,
            )
        )

        page_data.blocks.extend(
            self._extract_tables(
                file_path,
                page_number,
            )
        )

        return page_data

    def _extract_text(
        self,
        page: fitz.Page,
        page_number: int,
    ) -> list[TextBlock]:

        blocks: list[TextBlock] = []

        for block in page.get_text("blocks"):
            if len(block) < 5:
                continue

            x0, y0, x1, y1, text = block[:5]

            text = text.strip()

            if not text:
                continue

            blocks.append(
                TextBlock(
                    block_id=self.generate_block_id("text"),
                    block_type=BlockType.TEXT,
                    page_number=page_number,
                    bbox=BoundingBox(
                        x0=x0,
                        y0=y0,
                        x1=x1,
                        y1=y1,
                    ),
                    text=text,
                )
            )

        return blocks

    def _extract_images(
        self,
        page: fitz.Page,
        page_number: int,
    ) -> list[ImageBlock]:

        blocks: list[ImageBlock] = []

        for index, _ in enumerate(
            page.get_images(full=True),
            start=1,
        ):
            blocks.append(
                ImageBlock(
                    block_id=self.generate_block_id("image"),
                    block_type=BlockType.IMAGE,
                    page_number=page_number,
                    metadata={
                        "image_index": index,
                    },
                )
            )

        return blocks

    def _extract_tables(
        self,
        file_path: Path,
        page_number: int,
    ) -> list[TableBlock]:

        try:
            return self.table_extractor.extract(
                file_path=file_path,
                page_number=page_number,
            )

        except Exception as error:
            logger.warning(
                "Table extraction failed on page %d: %s",
                page_number,
                error,
            )
            return []


pdf_extractor = PDFExtractor()
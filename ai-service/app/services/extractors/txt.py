# ai-service/app/services/extractors/txt.py
from __future__ import annotations

import logging
from pathlib import Path

from app.schemas.document import (
    BlockType,
    Document,
    DocumentMetadata,
    DocumentPage,
    DocumentType,
    TextBlock,
)
from app.services.extractors.base import BaseExtractor

logger = logging.getLogger(__name__)


class TXTExtractor(BaseExtractor):
    SUPPORTED_EXTENSIONS = {".txt"}

    def extract(
        self,
        file_path: str | Path,
    ) -> Document:

        path = self.validate_file(file_path)
        start = self.log_start(path)

        try:
            content = path.read_text(
                encoding="utf-8",
                errors="ignore",
            )

            page = DocumentPage(
                page_number=1
            )

            paragraphs = self._split_paragraphs(
                content
            )

            for paragraph in paragraphs:
                page.blocks.append(
                    TextBlock(
                        block_id=self.generate_block_id(
                            "text"
                        ),
                        block_type=BlockType.TEXT,
                        page_number=1,
                        text=paragraph,
                    )
                )

            document = Document(
                pages=[page],
                metadata=DocumentMetadata(
                    filename=path.name,
                    document_type=DocumentType.TXT,
                    page_count=1,
                    metadata={
                        "encoding": "utf-8",
                    },
                ),
            )

            self.log_success(path, start)
            return document

        except Exception as error:
            self.log_failure(path, error)
            raise

    @staticmethod
    def _split_paragraphs(
        content: str,
    ) -> list[str]:

        content = content.replace(
            "\r\n",
            "\n",
        ).replace(
            "\r",
            "\n",
        )

        paragraphs = []

        for paragraph in content.split("\n\n"):
            paragraph = paragraph.strip()

            if not paragraph:
                continue

            # Join wrapped lines while retaining the
            # paragraph as one logical text block.
            lines = [
                line.strip()
                for line in paragraph.splitlines()
                if line.strip()
            ]

            if lines:
                paragraphs.append(
                    " ".join(lines)
                )

        return paragraphs


txt_extractor = TXTExtractor()
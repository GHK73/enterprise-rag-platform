# ai-serice/app/services/processing/normalization.py
from __future__ import annotations

import logging
import re

from app.schemas.document import (
    Document,
    ImageBlock,
    TableBlock,
    TextBlock,
)

logger = logging.getLogger(__name__)


class NormalizationService:

    def normalize(self, document: Document) -> Document:
        for page in document.pages:
            normalized_blocks = []

            for block in page.blocks:

                if isinstance(block, TextBlock):
                    block = self._normalize_text(block)

                    if not block.text:
                        continue

                elif isinstance(block, TableBlock):
                    block = self._normalize_table(block)

                elif isinstance(block, ImageBlock):
                    block = self._normalize_image(block)

                normalized_blocks.append(block)

            page.blocks = normalized_blocks

        return document

    def _normalize_text(
        self,
        block: TextBlock,
    ) -> TextBlock:

        text = block.text

        # Normalize line endings.
        text = text.replace("\r\n", "\n")
        text = text.replace("\r", "\n")

        # Normalize horizontal whitespace while preserving
        # paragraph/newline structure.
        text = re.sub(r"[ \t]+", " ", text)

        # Collapse excessive blank lines.
        text = re.sub(r"\n{3,}", "\n\n", text)

        block.text = text.strip()

        return block

    def _normalize_table(
        self,
        block: TableBlock,
    ) -> TableBlock:

        block.headers = [
            self._clean_cell(cell)
            for cell in block.headers
        ]

        block.rows = [
            [
                self._clean_cell(cell)
                for cell in row
            ]
            for row in block.rows
        ]

        return block

    def _normalize_image(
        self,
        block: ImageBlock,
    ) -> ImageBlock:

        if block.caption:
            block.caption = block.caption.strip()

        if block.ocr_text:
            block.ocr_text = block.ocr_text.strip()

        return block

    @staticmethod
    def _clean_cell(value: str | None) -> str:
        if value is None:
            return ""

        value = value.replace("\n", " ")
        value = re.sub(r"\s+", " ", value)

        return value.strip()


normalization_service = NormalizationService()
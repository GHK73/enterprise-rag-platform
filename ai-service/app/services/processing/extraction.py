# ai-service/app/services/processing/extraction.py
from __future__ import annotations
import logging
from pathlib import Path

from app.schemas.document import Document
from app.services.extractors.docling import DoclingExtractor
from app.services.extractors.docx import DocxExtractor
from app.services.extractors.pdf import PDFExtractor
from app.services.extractors.txt import TXTExtractor

logger = logging.getLogger(__name__)


class ExtractionService:
    def __init__(self) -> None:
        self.extractors = {
            ".pdf": PDFExtractor(),
            ".docx": DocxExtractor(),
            ".txt": TXTExtractor(),
        }
        self.docling = DoclingExtractor()

    def extract(self, file_path: str | Path) -> Document:
        path = Path(file_path)
        extension = path.suffix.lower()

        extractor = self.extractors.get(extension)
        if extractor is None:
            raise ValueError(f"Unsupported document type: {extension}")

        document = extractor.extract(path)

        if self._has_content(document):
            return document

        logger.warning(
            "Primary extraction produced no content for %s; "
            "attempting Docling fallback.",
            path.name,
        )

        try:
            docling_document = self.docling.extract(path)

            if self._has_content(docling_document):
                return docling_document

            logger.warning(
                "Docling extraction also produced no content for %s",
                path.name,
            )

        except Exception as error:
            logger.warning(
                "Docling fallback failed for %s: %s",
                path.name,
                error,
            )

        return document

    @staticmethod
    def _has_content(document: Document) -> bool:
        return any(
            page.blocks
            for page in document.pages
        )


extraction_service = ExtractionService()
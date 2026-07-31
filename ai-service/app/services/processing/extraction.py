from __future__ import annotations

import logging
from pathlib import Path

from app.schemas.document import Document
from app.services.extractors.docling import DoclingExtractor
from app.services.extractors.docx import DOCXExtractor
from app.services.extractors.pdf import PDFExtractor
from app.services.extractors.txt import TXTExtractor

logger = logging.getLogger(__name__)


class ExtractionService:

    def __init__(self) -> None:

        self.extractors = {
            ".pdf": PDFExtractor(),
            ".docx": DOCXExtractor(),
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
        try:
            docling_document = self.docling.extract(path)
            document = self._merge(document, docling_document)
        except Exception as e:
            logger.warning("Docling extraction failed: %s", e)
        return document

    def _merge(self,document: Document,docling_document: Document,) -> Document:
        for index, page in enumerate(docling_document.pages):
            if index >= len(document.pages):
                document.pages.append(page)
                continue

            document.pages[index].blocks.extend(page.blocks)
        document.metadata.update(docling_document.metadata)
        return document
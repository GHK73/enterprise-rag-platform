from pathlib import Path

from app.core.exceptions import ProcessingException
from app.schemas.document import Document
from app.services.extractors import (
    DOCXExtractor,
    PDFExtractor,
    TXTExtractor,
)


class ExtractionService:

    def __init__(self):
        self.extractors = {
            ".pdf": PDFExtractor(),
            ".docx": DOCXExtractor(),
            ".txt": TXTExtractor(),
        }

    async def extract(self, file_path: Path) -> Document:

        extension = file_path.suffix.lower()

        extractor = self.extractors.get(extension)

        if extractor is None:
            raise ProcessingException(
                f"Unsupported document type: {extension}"
            )

        return await extractor.extract(file_path)


extraction_service = ExtractionService()
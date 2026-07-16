# ai-service/app/services/processing/extraction.py

from pathlib import Path 
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
    async def extract(self, file_path: Path,)->str:
        extractor = self.extractors.get(file_path.suffix.lower())
        if extractor is None:
            raise ValueError(f"Unsupported file type: {file_path.suffix}")
        return await extractor.extract(file_path)

extraction_service = ExtractionService()
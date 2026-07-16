# ai-service/app/services/extractors/docx.py

from pathlib import Path 
from .base import BaseExtractor 
from docx import Document 

class DOCXExtractor(BaseExtractor):
    async def extract(self, file_path: Path,)->str:
        document = Document(file_path)
        paragraphs = [
            paragraph.text
            for paragraph in document.paragraphs 
            if paragraph.text.strip()
        ]
        return "\n".join(paragraphs)
# ai-service/app/services/extractors/pdf.py

from pathlib import Path 
from .base import BaseExtractor 
import fitz

class PDFExtractor(BaseExtractor):
    async def extract(self, file_path: Path,)->str:
        document = fitz.open(file_path)
        try:
            pages=[]
            for page in document:
                pages.append(page.text())
            return "\n".join(pages)
        finally:
            document.close()
# ai-service/app/services/extractors/txt.py

from pathlib import Path 
from .base import BaseExtractor 

class TXTExtractor(BaseExtractor):
    async def extract(self, file_path: Path,)->str:
        return file_path.read_text(
            encoding="utf-8",
            errors="ignore"
        )
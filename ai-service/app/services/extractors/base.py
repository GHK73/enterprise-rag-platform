# ai-service/app/services/extractors/base.py

from abc import ABC,abstractmethod 
from pathlib import Path
from app.services.processing.normalization import normalization_service 

class BaseExtractor(ABC):
    @abstractmethod 
    async def read(self, file_path:Path,)->str:
        pass 

    async def extract(self, file_path: Path,)->str:
        text = await self.read(file_path)
        text = await normalization_service.normalize(text)
        return text
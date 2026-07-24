# ai-serice/app/services/processing/normalization.py

from abc import ABC, abstractmethod
from app.schemas.document import Document
from app.services.processing.normalization import normalization_service


class BaseExtractor(ABC):
    @abstractmethod
    async def read(self, file_path) -> Document:
        pass

    async def extract(self, file_path) -> Document:

        document = await self.read(file_path)

        for page in document.pages:

            for block in page.blocks:

                if block.block_type == "TEXT":
                    block.text = await normalization_service.normalize(
                        block.text
                    )

        return document
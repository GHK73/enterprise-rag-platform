# ai-service/app/services/extractors/txt.py

from __future__ import annotations
import logging
from pathlib import Path
from app.schemas.document import (
    BlockType,
    Document,
    DocumentMetadata,
    DocumentPage,
    DocumentType,
    TextBlock,
)
from app.services.extractors.base import BaseExtractor

logger = logging.getLogger(__name__)

class TXTExtractor(BaseExtractor):
    SUPPORTED_EXTENSIONS = {".txt"}

    def extract(self,file_path: str| Path)->Document:
        path = self.validate_file(file_path)
        start = self.log_start(path)
        try:
            with open(path,"r",encoding="utf-8",errors="ignore") as file:
                content = file.read()
            page=DocumentPage(page_number=1)
            for line in content.splitlines():
                line=line.strip()
                if not line:
                    continue
                page.blocks.append(
                    TextBlock(
                        block_id=self.generate_block_id("text"),
                        block_type=BlockType.TEXT,
                        page_number=1,
                        text=line,
                    )
                )
            document = Document(
                pages=[page],
                metadata=DocumentMetadata(
                    filename=path.name,
                    document_type=DocumentType.TXT,
                    metadata={
                        "encoding": "utf-8",
                    },
                ),
            )
            self.log_success(path,start)
            return document
        except Exception as e:
            self.log_failure(path,e)
            raise
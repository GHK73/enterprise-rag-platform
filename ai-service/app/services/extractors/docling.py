# ai-service/app/services/extractors/docling.py

from __future__ import annotations
import logging
from pathlib import Path
from docling.document_converter import DocumentConverter
from app.schemas.document import(
    BlockType,
    Document,
    DocumentPage,
    FigureBlock,
    ImageBlock,
    TableBlock,
    TextBlock,
)
from app.services.extractors.base import BaseExtractor

logger = logging.getLogger(__name__)

class DoclingExtractor(BaseExtractor):
    SUPPORTED_EXTENSIONS = {".pdf",".docx",".pptx",".html",}

    def __init__(self) ->None:
        super().__init__()
        self.converter = DocumentConverter()

    def extract(self,file_path: str | Path)->Document:
        path = self.validate_file(file_path)
        start=self.log_start(path)
        try:
            result=self.converter.convert(str(path))
            doc=result.document
            document=Document(
                metadata={
                    "filename":path.name,
                    "source":"docling",
                }
            )
            page=DocumentPage(page_number=1)
            for item in doc.iterate_items():
                block = self._convert_item(item)
                if block is not None:
                    page.blocks.append(block)
            document.pages.append(page)
            self.log_success(path,start)
            return document

        except Exception as e:
            self.log_failure(path,e)
            raise

    def _convert_item(self,item):
        text =getattr(item,"text",None)
        if text:
            return TextBlock(
                block_id=self.generate_block_id("text"),
                block_type=BlockType.TEXT,
                page_number=1,
                text=text, 
            )
        if item.__class__.__name__.lower() == "table":
            return TableBlock(
                block_id=self.generate_block_id("table"),
                block_type=BlockType.TABLE,
                page_number=1,
                headers=[],
                rows=[],
            )
        if item.__class__.__name__.lower() == "picture":
            return ImageBlock(
                block_id=self.generate_block_id("image"),
                block_type=BlockType.IMAGE,
                page_number=1,
            )

        if item.__class__.__name__.lower() == "figure":
            return FigureBlock(
                block_id=self.generate_block_id("figure"),
                block_type=BlockType.FIGURE,
                page_number=1,
            )

        return None
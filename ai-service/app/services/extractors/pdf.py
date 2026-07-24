# ai-service/app/services/extractors/pdf.py

from pathlib import Path
import fitz
from __future__ import annotations 
from app.schemas.document import(
    BlockType,
    Document,
    DocumentPage,
    ImageBlock,
    TableBlock,
    TextBlock
)
from app.services.extractors.base import BaseExtractor
import logging

logger = logging.getLogger(__name__)

class PDFExtractor(BaseExtractor):
    SUPPORTED_EXTENSIONS = {".pdf"}
    def extract(self, file_path: str | Path)->Document:
        path = self.validate_file(file_path)
        start = self.log_start(path)

        try:
            pdf = fitz.open(path)
            document = Document(
                metadata = self._extract_metadata(pdf,path)
            )
            for page_number, page in enumerate(pdf,start = 1):
                document.pages.append(self._extract_page(page,page_number))
            pdf.close()
            self.log_success(path, start)
            return document 
        
        except Exception as e:
            self.log_failure(path,e)
            raise 

    # Metadata
    def _extract_metadata(sel, pdf: fitz.Document, path:Path)->dict:
        metadata = pdf.metadata or {}
        return{
            "filename": path.name, 
            "title" : metadata.get('title'),
            "author": metadata.get("author"),
            "subject": metadata.get("subject"),
            "creator": metadata.get("creator"),
            "producer": metadata.get("producer"),
            "page_count": pdf.page_count,
        }  
    
    # Page extraction 
    def _extrac_page(self,page: fitz.Page,page_number:int,)->DocumentPage:
        page_data = DocumentPage(page_number=page_number)
        page_data.blocks.extend(self._extract_text(page,page_number))
        page_data.blocks.extend(self._images(page,page_number))
        page_data.blocks.extend(self._extract_tables(page,page_number))

        return page_data
    
    # Text
    def _extract_text(self,page: fitz.Page, page_number:int,)->list[TextBlock]:
        blocks = []
        for block in page.get_text("blocks"):
            text = block[4].strip()
            if not text:
                continue 
            blocks.append(
                TextBlock(
                    block_id = self.generate_block_id("text"),
                    block_type=BlockType.TEXT,
                    page_number=page_number,
                    text=text,
                    metadata={
                        "bbox":block[:4]
                    },
                )
            )
            return blocks
        
    # Images
    def _extract_images(self, page:fitz.Page, page_number:int)->list[ImageBlock]:
        blocks = []
        images = page.get_images(full=True)
        for index, _ in enumerate(images,start=1):
            blocks.append(
                ImageBlock(
                    block_id=self.generate_block_id("image"),
                    block_type=BlockType.IMAGE,
                    page_number=page_number,
                    caption=None,
                    ocr_text=None,
                    metadata={
                        "image_index":index 
                    },
                )
            )
        return blocks
    
    # Tables
    def _extract_tables(self, page:fitz.Page, page_number: int,)->list[TableBlock]:
        # will integrate
        return []
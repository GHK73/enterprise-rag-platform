# ai-service/app/services/extractors/docx.py

from __future__ import annotations
import logging
from pathlib import Path
from docx import Document as DocxDocument
from app.schemas.document import (
    BlockType,
    Document,
    DocumentMetadata,
    DocumentPage,
    DocumentType,
    ImageBlock,
    TableBlock,
    TextBlock,
)
from app.services.extractors.base import BaseExtractor 

logger = logging.getLogger(__name__)

class DocxExtractor(BaseExtractor):
    SUPPORTED_EXTENSIONS = {".docx"}
    def extract(self,file_path: str| Path)->Document:
        path = self.validate_file(file_path)
        start = self.log_start(path)
        try:
            doc = DocxDocument(path)
            document = Document(
                metadata = self._extract_metadata(doc,path)
            )
            page = DocumentPage(page_number=1)
            page.blocks.extend(self._extract_paragraphs(doc))
            page.blocks.extend(self._extract_tables(doc))
            page.blocks.extend(self._extract_images(doc))
            document.pages.append(page)
            self.log_success(path, start)
            return document
        except Exception as e:
            self.log_failure(path,e)
            raise 

    # Metadata 

    def _extract_metadata(self,doc: DocxDocument,path: Path,) -> DocumentMetadata:
        props = doc.core_properties

        return DocumentMetadata(
            filename=path.name,
            document_type=DocumentType.DOCX,
            title=props.title,
            author=props.author,
            metadata={
                "subject": props.subject,
                "creator": props.author,
                "keywords": props.keywords,
                "comments": props.comments,
            },
        )

    # Paragraphs
    def _extract_paragraphs(self,doc: DocxDocument,) -> list[TextBlock]:
        blocks = []
        for paragraph in doc.paragraphs:
            text = paragraph.text.strip()
            if not text:
                continue
            style = paragraph.style.name.lower()
            block_type = (
                BlockType.HEADING 
                if "heading" in style
                else BlockType.TEXT 
            )
            blocks.append(
                TextBlock(
                    block_id = self.generate_block_id("text"),
                    block_type = block_type,
                    page_number = 1,
                    text = text,
                    metadata = {
                        "style":paragraph.style.name,
                    },
                )
            )

        return blocks

    # Tables
    def _extract_tables(self,doc: DocxDocument,)->list[TableBlock]:
        blocks = []
        for table in doc.tables:
            rows = [
                [cell.text.strip() for cell in row.cells]
                for row in table.rows
            ]
            if not rows:
                continue
            blocks.append(
                TableBlock(
                    block_id = self.generate_block_id("table"),
                    block_type = BlockType.TABLE,
                    page_number = 1,
                    headers = rows[0],
                    rows=rows[1:],
                )
            )

        return blocks

    # Images
    def _extract_images(self,doc: DocxDocument,)->list[ImageBlock]:
        blocks = []
        rels=doc.part._rels
        for rel in rels.values():
            if "image" not in rel.target_ref:
                continue
            blocks.append(
                ImageBlock(
                    block_id=self.generate_block_id("image"),
                    block_type=BlockType.IMAGE,
                    page_number=1,
                    metadata={
                        "target" : rel.target_ref,
                    },
                )
            )
        return blocks
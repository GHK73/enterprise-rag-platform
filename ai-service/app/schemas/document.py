# ai-service/app/schemas/document.py

from enum import Enum
from typing import Any 

from pydantic import BaseModel, Field 

class BlockType(str,Enum):
    TEXT = "TEXT"
    HEADING = "HEADING"
    TABLE = "TABLE"
    IMAGE = "IMAGE"
    FIGURE = "FIGURE"
    LIST = "LIST"
    CODE = "CODE"
    FORMULA = "FORMULA"

class DocumentType(str, Enum):
    PDF = "PDF"
    DOCX = "DOCX"
    TXT = "TXT"
    UNKNOWN = "UNKNOWN"

class BoundingBox(BaseModel):
    x0: float
    y0: float
    x1: float
    y1: float

class DocumentBlock(BaseModel):
    block_id: str
    block_type: BlockType  
    page_number:int 
    bbox: BoundingBox | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

class TextBlock(DocumentBlock):
    text: str 

class TableBlock(DocumentBlock):
    headers: list[str] = Field(default_factory=list)
    rows: list[list[str]] = Field(default_factory = list)

class ImageBlock(DocumentBlock):
    caption: str | None = None 
    ocr_text: str | None = None

class FigureBlock(DocumentBlock):
    caption: str|None = None 
    description: str| None = None 

class DocumentPage(BaseModel):
    page_number:int 
    blocks: list[DocumentBlock] = Field(default_factory=list)

class DocumentMetadata(BaseModel):
    filename: str
    document_type: DocumentType

    title: str | None = None
    author: str | None = None
    producer: str | None = None

    page_count: int = 0
    metadata: dict[str, Any] = Field(default_factory=dict)

class Document(BaseModel):
    pages: list[DocumentPage] = Field(default_factory=list)
    metadata: DocumentMetadata
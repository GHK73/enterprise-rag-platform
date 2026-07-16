# ai-service/app/services/extractors/init.py

from .docx import DOCXExtractor 
from .pdf import PDFExtractor 
from .txt import TXTExtractor 

__all__ = [
    "PDFExtractor",
    "DOCXExtractor",
    "TXTExtractor",
]
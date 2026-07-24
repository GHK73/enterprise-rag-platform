# ai-service/app/services/extractors/table.py

from __future__ import annotations
import logging
from pathlib import Path
import camelot
import pdfplumber
from app.schemas.document import BlockType, TableBlock

logger = logging.getLogger(__name__)

class TableExtractor:

    def extract(self,file_path: str | Path, page_number:int|None = None,)-> list[TableBlock]:
        tables = self._extract_with_camelot(file_path, page_number)
        if tables:
            return tables

        return self._extract_with_pdfplumber(file_path, page_number)

    def _extract_with_camelot(self, file_path: str| Path, page_number:int | None,)->list[TableBlock]:
        blocks = []
        try:
            pages = "all" if page_number is None else str(page_number)
            tables = camelot.read_pdf(str(file_path),pages = pages,flavor="stream",)

            for index,table in enumerate(tables,start=1):
                data = table.df.fillna("").values.tolist()
                if not data:
                    continue
                headers = data[0]
                rows = data[1:]
                blocks.append(
                    TableBlock(
                        block_id=f"table_{index}",
                        block_type=BlockType.TABLE,
                        page_number=table.page,
                        headers=headers,
                        rows=rows,
                        metadata={
                            "accuracy":table.accuracy,
                            "whitespace":table.whitespace,
                            "parser":"camelot",
                        },
                    )
                )
        except Exception as e:
            logger.warning("Camelot extraction failed: %s",e)

        return blocks

    def _extract_with_pdfplumber(self,file_path: str | Path,page_number: int|None,)->list[TableBlock]:
        blocks = []
        try:
            with pdfplumber.open(file_path) as pdf:
                pages =(
                    enumerate(pdf.pages, start=1)
                    if page_number is None 
                    else [(page_number, pdf.pages[page_number-1])]
                )
                index = 1
                for page_no, page in pages:
                    tables = page.extract_tables()
                    for table in tables:
                        if not table:
                            continue
                        headers=table[0]
                        rows=table[1:]
                        blocks.append(
                            TableBlock(
                                block_id=f"table_{index}",
                                block_type=BlockType.TABLE,
                                page_number=page_no,
                                headers=headers,
                                rows=rows,
                                metadata={
                                    "parser":"pdfplumber",
                                },
                            )
                        )
                        index+=1
        except Exception as e:
            logger.warning("pdfplumber extraction failed: %s",e)

        return blocks
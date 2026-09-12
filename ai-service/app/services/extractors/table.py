# ai-service/app/services/extractors/table.py
from __future__ import annotations
import logging
import uuid
from pathlib import Path
import camelot
import pdfplumber
from app.schemas.document import BlockType, TableBlock

logger = logging.getLogger(__name__)

class TableExtractor:

    def extract(
        self,
        file_path: str | Path,
        page_number: int | None = None,
    ) -> list[TableBlock]:

        path = Path(file_path)

        if not path.exists():
            raise FileNotFoundError(
                f"File does not exist: {path}"
            )

        if not path.is_file():
            raise ValueError(
                f"Path is not a file: {path}"
            )

        if path.suffix.lower() != ".pdf":
            raise ValueError(
                "Table extraction currently supports PDF files only."
            )

        if page_number is not None and page_number < 1:
            raise ValueError(
                "page_number must be greater than or equal to 1."
            )

        tables = self._extract_with_camelot(
            path,
            page_number,
        )

        if tables:
            return tables

        return self._extract_with_pdfplumber(
            path,
            page_number,
        )

    def _extract_with_camelot(
        self,
        file_path: Path,
        page_number: int | None,
    ) -> list[TableBlock]:

        blocks: list[TableBlock] = []

        try:
            pages = (
                "all"
                if page_number is None
                else str(page_number)
            )

            tables = camelot.read_pdf(
                str(file_path),
                pages=pages,
                flavor="stream",
            )

            for table in tables:
                data = table.df.fillna("").values.tolist()

                if not data:
                    continue

                headers = [
                    str(value).strip()
                    for value in data[0]
                ]

                rows = [
                    [
                        str(value).strip()
                        for value in row
                    ]
                    for row in data[1:]
                ]

                blocks.append(
                    TableBlock(
                        block_id=f"table_{uuid.uuid4().hex}",
                        block_type=BlockType.TABLE,
                        page_number=table.page,
                        headers=headers,
                        rows=rows,
                        metadata={
                            "accuracy": table.accuracy,
                            "whitespace": table.whitespace,
                            "parser": "camelot",
                        },
                    )
                )

        except Exception as error:
            logger.warning(
                "Camelot extraction failed for %s: %s",
                file_path.name,
                error,
            )

        return blocks

    def _extract_with_pdfplumber(
        self,
        file_path: Path,
        page_number: int | None,
    ) -> list[TableBlock]:

        blocks: list[TableBlock] = []

        try:
            with pdfplumber.open(file_path) as pdf:

                if page_number is not None:
                    if page_number > len(pdf.pages):
                        raise ValueError(
                            f"Page {page_number} does not exist "
                            f"in PDF."
                        )

                    pages = [
                        (
                            page_number,
                            pdf.pages[page_number - 1],
                        )
                    ]

                else:
                    pages = enumerate(
                        pdf.pages,
                        start=1,
                    )

                for page_no, page in pages:

                    tables = page.extract_tables()

                    for table in tables:

                        if not table:
                            continue

                        headers = [
                            (
                                str(value).strip()
                                if value is not None
                                else ""
                            )
                            for value in table[0]
                        ]

                        rows = [
                            [
                                (
                                    str(value).strip()
                                    if value is not None
                                    else ""
                                )
                                for value in row
                            ]
                            for row in table[1:]
                        ]

                        blocks.append(
                            TableBlock(
                                block_id=(
                                    f"table_{uuid.uuid4().hex}"
                                ),
                                block_type=BlockType.TABLE,
                                page_number=page_no,
                                headers=headers,
                                rows=rows,
                                metadata={
                                    "parser": "pdfplumber",
                                },
                            )
                        )

        except Exception as error:
            logger.warning(
                "pdfplumber extraction failed for %s: %s",
                file_path.name,
                error,
            )

        return blocks


table_extractor = TableExtractor()
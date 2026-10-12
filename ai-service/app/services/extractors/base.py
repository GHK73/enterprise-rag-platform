# ai-service/app/services/extractors/base.py

from __future__ import annotations

import logging
import time
from pathlib import Path

from app.schemas.document import BlockType, TableBlock

logger = logging.getLogger(__name__)


class BaseExtractor:

    SUPPORTED_EXTENSIONS: set[str] = set()

    def validate_file(self, file_path: str | Path) -> Path:
        path = Path(file_path)

        if not path.exists():
            raise FileNotFoundError(
                f"File not found: {path}"
            )

        if not path.is_file():
            raise ValueError(
                f"Path is not a file: {path}"
            )

        if path.suffix.lower() not in self.SUPPORTED_EXTENSIONS:
            raise ValueError(
                f"Unsupported file extension: {path.suffix}"
            )

        return path

    def generate_block_id(self, prefix: str) -> str:
        import uuid

        return f"{prefix}_{uuid.uuid4().hex}"

    def log_start(self, path: Path) -> float:
        start = time.perf_counter()

        logger.info(
            "Starting extraction: %s",
            path,
        )

        return start

    def log_success(
        self,
        path: Path,
        start: float,
    ) -> None:
        elapsed = time.perf_counter() - start

        logger.info(
            "Extraction completed: %s (%.2f seconds)",
            path,
            elapsed,
        )

    def log_failure(
        self,
        path: Path,
        error: Exception,
    ) -> None:
        logger.error(
            "Extraction failed: %s: %s",
            path,
            error,
        )

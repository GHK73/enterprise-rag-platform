# ai-service/app/services/extractors/base.py

from __future__ import annotations

import logging
import mimetypes
import os
import time
import uuid
from abc import ABC, abstractmethod
from pathlib import Path

from app.schemas.document import Document


logger = logging.getLogger(__name__)


class BaseExtractor(ABC):
    """
    Base class for all document extractors.

    Every extractor must inherit from this class and implement
    the extract() method.

    Responsibilities:
        - File validation
        - Extension validation
        - Logging
        - Timing
        - Utility helpers
    """

    #: Supported file extensions.
    SUPPORTED_EXTENSIONS: set[str] = set()

    def __init__(self) -> None:
        self.logger = logger

    ###########################################################################
    # Public API
    ###########################################################################

    @abstractmethod
    def extract(self, file_path: str | Path) -> Document:
        """
        Extract a document.

        Parameters
        ----------
        file_path : str | Path

        Returns
        -------
        Document
        """
        raise NotImplementedError

    ###########################################################################
    # Validation
    ###########################################################################

    def validate_file(self, file_path: str | Path) -> Path:
        """
        Validate input file before extraction.
        """

        path = Path(file_path)

        if not path.exists():
            raise FileNotFoundError(f"File does not exist: {path}")

        if not path.is_file():
            raise ValueError(f"Not a file: {path}")

        if path.stat().st_size == 0:
            raise ValueError("Input file is empty.")

        extension = path.suffix.lower()

        if extension not in self.SUPPORTED_EXTENSIONS:
            raise ValueError(
                f"Unsupported file type '{extension}'. "
                f"Supported: {sorted(self.SUPPORTED_EXTENSIONS)}"
            )

        return path

    ###########################################################################
    # Helper Functions
    ###########################################################################

    @staticmethod
    def get_extension(file_path: str | Path) -> str:
        return Path(file_path).suffix.lower()

    @staticmethod
    def get_filename(file_path: str | Path) -> str:
        return Path(file_path).name

    @staticmethod
    def get_file_size(file_path: str | Path) -> int:
        return Path(file_path).stat().st_size

    @staticmethod
    def get_mime_type(file_path: str | Path) -> str:
        mime, _ = mimetypes.guess_type(str(file_path))
        return mime or "application/octet-stream"

    @staticmethod
    def generate_block_id(prefix: str = "block") -> str:
        """
        Generate a unique block identifier.
        """
        return f"{prefix}_{uuid.uuid4().hex}"

    # Logging Helpers
    def log_start(self, file_path: str | Path) -> float:
        self.logger.info(
            "Starting extraction: %s",
            file_path,
        )
        return time.perf_counter()

    def log_success(
        self,
        file_path: str | Path,
        start_time: float,
    ) -> None:
        elapsed = time.perf_counter() - start_time

        self.logger.info(
            "Extraction completed (%s) in %.2f seconds",
            file_path,
            elapsed,
        )

    def log_failure(
        self,
        file_path: str | Path,
        exc: Exception,
    ) -> None:
        self.logger.exception(
            "Extraction failed for %s: %s",
            file_path,
            exc,
        )

    # Cleanup
    def cleanup(self) -> None:
        """
        Override if extractor creates temporary files.
        """
        return

    # Context Manager
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        self.cleanup()
        return False
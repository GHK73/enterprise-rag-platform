# ai-sevice/app/services/procesing.service.py

import logging

from app.schemas.processing import (
    ProcessDocumentRequest,
    ProcessDocumentResponse,
)

from .downloader import downloader_service
from .temp_storage import temporary_storage
from pathlib import Path
from urllib.parse import urlparse

from app.services.processing.extraction import extraction_service
from app.services.processing.normalization import normalization_service
from app.services.processing.chunking import chunking_service


logger = logging.getLogger(__name__)


class DocumentProcessingService:

    async def process_document(
        self,
        request: ProcessDocumentRequest,
    ) -> ProcessDocumentResponse:

        logger.info(
            "Processing document %s, version %s",
            request.document_id,
            request.version_id,
        )

        workspace = temporary_storage.create_workspace()

        try:
            url_path = Path(urlparse(str(request.file_url)).path)
            suffix = url_path.suffix.lower()

            if not suffix:
                raise ValueError(
                    "Document URL must contain a file extension."
                )

            file_path = await downloader_service.download(
                str(request.file_url),
                workspace / f"document{suffix}",
            )

            logger.info(
                "Downloaded document: %s",
                file_path,
            )

            # 2. Extract
            document = extraction_service.extract(
                file_path
            )

            logger.info(
                "Extracted document with %d pages",
                len(document.pages),
            )

            # 3. Normalize
            document = normalization_service.normalize(
                document
            )

            logger.info(
                "Document normalization completed",
            )

            # 4. Chunk
            chunks = chunking_service.chunk(
                document
            )

            logger.info(
                "Created %d chunks",
                len(chunks),
            )

            # 5. Return response
            return ProcessDocumentResponse(
                success=True,
                message="Document processed successfully.",
                document_id=request.document_id,
                version_id=request.version_id,
            )

        except Exception:
            logger.exception(
                "Document processing failed: document=%s version=%s",
                request.document_id,
                request.version_id,
            )
            raise

        finally:
            # 6. Cleanup
            temporary_storage.cleanup(
                workspace
            )


processing_service = DocumentProcessingService()
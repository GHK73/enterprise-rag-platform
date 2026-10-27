# ai-service/app/services/processing/service.py

from __future__ import annotations

import logging
from pathlib import Path

from app.schemas.processing import (
    ProcessDocumentRequest,
    ProcessDocumentResponse,
)
from app.services.processing.extraction import extraction_service
from app.services.processing.normalization import normalization_service
from app.services.processing.chunking import chunking_service
from app.services.processing.downloader import downloader_service
from app.services.processing.temp_storage import temporary_storage
from app.services.embedding import embedding_service
from app.services.vectorstore import pgvector_store

logger = logging.getLogger(__name__)


SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".txt"}


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

        suffix = Path(request.file_name).suffix.lower()

        if not suffix:
            raise ValueError(
                "Document filename must contain a file extension."
            )

        if suffix not in SUPPORTED_EXTENSIONS:
            raise ValueError(
                f"Unsupported file extension: {suffix}. "
                f"Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
            )

        workspace = temporary_storage.create_workspace()

        try:
            # 1. Download
            file_path = await downloader_service.download(
                str(request.file_url),
                workspace / f"document{suffix}",
            )

            logger.info(
                "Downloaded document: %s",
                file_path,
            )

            # 2. Extract
            document = extraction_service.extract(file_path)

            logger.info(
                "Extracted document with %d pages",
                len(document.pages),
            )

            # 3. Normalize
            document = normalization_service.normalize(document)

            logger.info(
                "Document normalization completed",
            )

            # 4. Chunk
            chunks = chunking_service.chunk(document)

            logger.info(
                "Created %d chunks",
                len(chunks),
            )

            if not chunks:
                raise ValueError(
                    "Document produced no searchable text chunks."
                )

            # 5. Generate embeddings
            embedded_chunks = embedding_service.embed_chunks(chunks)

            if len(embedded_chunks) != len(chunks):
                raise RuntimeError(
                    "Embedding count does not match chunk count."
                )

            logger.info(
                "Generated embeddings for %d chunks",
                len(embedded_chunks),
            )

            # 6. Ensure the Supabase pgvector store is ready
            await pgvector_store.ensure_collection()

            # 7. Delete previous version points to avoid stale vectors
            await pgvector_store.delete_version(
                document_id=request.document_id,
                version_id=request.version_id,
            )

            # 8. Index this document version.
            await pgvector_store.upsert_chunks(
                organization_id=request.organization_id,
                document_id=request.document_id,
                version_id=request.version_id,
                embedded_chunks=embedded_chunks,
            )

            logger.info(
                "Indexed %d chunks into Supabase pgvector: "
                "document=%s version=%s",
                len(embedded_chunks),
                request.document_id,
                request.version_id,
            )

            # 9. Return response
            return ProcessDocumentResponse(
                success=True,
                message="Document processed successfully.",
                document_id=request.document_id,
                version_id=request.version_id,
            )

        except Exception:
            logger.exception(
                "Document processing failed: "
                "document=%s version=%s",
                request.document_id,
                request.version_id,
            )
            raise

        finally:
            # 10. Cleanup temporary workspace
            temporary_storage.cleanup(workspace)


processing_service = DocumentProcessingService()

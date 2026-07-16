# ai-sevice/app/services/procesing.service.py

import logging
from app.schemas.processing import (
    ProcessDocumentRequest,
    ProcessDocumentResponse,
)
from .downloader import document_downloader
from .temp_storage import temporary_storage 
from app.services.processing.extraction import extraction_service
from app.services.processing.normalization import normalization_service
from app.services.processing.chunking import chunking_service

logger =logging.getLogger(__name__) 

class DocumentProcessingService:
    async def process_document(self,request:ProcessDocumentRequest,)->ProcessDocumentResponse:
        logger.info("Processing document %s",request.document_id)
        workspace = temporary_storage.create_workspace()
        try:
            file_path = await document_downloader.download(
                str(request.file_url),workspace,
            )
            logger.info("Download file: %s",file_path,)

            text = await extraction_service.extract(file_path)
            logger.info("Extracted %d characters.",len(text))

            text = await normalization_service.normalize(text)
            logger.info("Normalized %d characters.",len(text))

            chunks = await chunking_service.create_chunks(text)
            logger.info("Created %d chunks.",len(chunks))
            #
            #
            #

            return ProcessDocumentResponse(
                success= True,
                message="Document accepted for processing.",
                document_id=request.document_id,
                version_id=request.version_id,
            )
        finally:
            temporary_storage.cleanup(workspace)

processing_service = DocumentProcessingService()
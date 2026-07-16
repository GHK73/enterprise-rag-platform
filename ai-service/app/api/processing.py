# ai-service/app/api/processing.py

from fastapi import APIRouter
from app.schemas.processing import(
    ProcessDocumentRequest,
    ProcessDocumentResponse,
)
from app.services.processing import processing_service

router = APIRouter()

@router.post("/process-document",response_model=ProcessDocumentResponse,)

async def process_document(request: ProcessDocumentRequest,):
    return await processing_service.process_document(request)

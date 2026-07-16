# ai-service/app/api/health.py

from fastapi import APIRouter 
from app.config.config import settings
from app.schemas.api import ApiResponse 

router = APIRouter()

@router.get("/health",response_model=ApiResponse,)
async def health_check():
    return ApiResponse(
        success = True,
        message="AI Service is healthy.",
        data={
            "service": settings.APP_NAME,
            "version":settings.APP_VERSION,
            "environment":settings.ENVIRONMENT,
        },
    )
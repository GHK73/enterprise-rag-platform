from fastapi import APIRouter 
from app.config.config import settings 

router = APIRouter(
    prefix="/health",
    tags=["Health"]
)

@router.get("")
async def health():
    return{
        "status":"healthy",
        "service":settings.APP_NAME,
        "version":settings.APP_VERSION,
        "environment":settings.ENVIRONMENT,
    }
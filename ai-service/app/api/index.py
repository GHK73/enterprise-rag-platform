# ai-service/app/api/index.py

from fastapi import APIRouter 
from app.api.health import router as health_router
from app.api.processing import router as processing_router

api_router = APIRouter(prefix="/api/v1",)

api_router.include_router(health_router,tags=["Health"],)
api_router.include_router(processing_router, tags=["Processing"])

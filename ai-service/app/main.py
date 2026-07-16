# ai-service/app/main.py

from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.api.index import api_router
from app.config.config import settings
from app.config.logger import (
    configure_logger,
    logger,
)

configure_logger()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AI Service...")
    yield
    logger.info("Stopping AI Service...")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

app.include_router(api_router)

@app.get("/")
async def root():
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
    }
# ai-service/app/main.py

from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.api.index import api_router
from app.config.config import settings
from app.config.logger import (
    configure_logger,
    logger,
)
from app.core.exceptions import register_exception_handlers
from app.services.vectorstore import pgvector_store

configure_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AI Service...")
    await pgvector_store.ensure_collection()
    yield
    logger.info("Stopping AI Service...")
    await pgvector_store.close()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

register_exception_handlers(app)
app.include_router(api_router)


@app.get("/")
async def root():
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
    }

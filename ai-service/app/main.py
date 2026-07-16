# ai-service/app/main.py

from fastapi import FastAPI

from app.api.index import api_router
from app.config.config import settings 
from app.config.logger import configure_logger 

configure_logger()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
)

app.include_router(api_router)

@app.get("/")
async def root():
    return {
        "service":settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status":"running",
    }
# ai-service/app/core/exceptions.py

import logging
from fastapi import FastAPI
from fastapi import Request
from fastapi.responses import JSONResponse 
from fastapi.exceptions import RequestValidationError 

logger = logging.getLogger("uvicorn.error")

class ProcessingException(Exception):
    """Raised when document processing fails."""
    
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)

def register_exception_handlers(app: FastAPI):
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request,
        exc: RequestValidationError,
    ):
        logger.warning(
            "Validation failed for %s",
            request.url.path,
        )
        return JSONResponse(
            status_code=422,
            content={
                "success":False,
                "message":"Validation Error",
                "errors":exc.errors(),            
            },
        )
    @app.exception_handler(Exception)
    async def internal_exception_handler(
        request: Request,
        exc: Exception,
    ):
        logger.exception(
            "Unhandled exception on %s",
            request.url.path,
        )
        return JSONResponse(
            status_code=500,
            content={
                "success":False,
                "message":"Internal Server Error",
            },
        )

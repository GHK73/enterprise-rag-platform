# ai-service/app/logger.py

import logging 

from app.config.config import settings 

def configure_logger():
    logging.basicConfig(
        level = settings.LOG_LEVEL,
        format = "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )

logger = logging.getLogger("ai-service")
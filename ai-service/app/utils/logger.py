# ai-service/app/utils/logger.py

import logging
import sys
from app.config.settings import settings

def configure_logging():
    logging.basicConfig(level=getattr(logging,settings.LOG_LEVEL.upper(),logging.INFO),
    format=(
        "%(asctime)s | " "%(levelname)s | " "%(name)s" "%(message)s"
    ),
    handlers = [logging.StreamHandler(sys.stdout)],
    force=True, 
    )

logger = logging.getLogger(settings.APP_NAME)
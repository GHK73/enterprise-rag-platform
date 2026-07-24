# ai-service/app/services/processing/downloader.py

from pathlib import Path
import httpx 
from app.core.exceptions import ProcessingException

class DownloaderService:
    DEFAULT_TIMEOUT = 60
    async def download(self, url: str,destination:Path)->Path:
        try:
            async with httpx.AsyncClient(follow_redirects=True,timeout=self.DEFAULT_TIMEOUT,) as client:
                async with client.stream("GET",url) as response:
                    response.raise_for_status()
                    with destination.open("wb") as file:
                        async for chunk in response.aiter_bytes():
                            file.write(chunk)
            return destination
        except Exception as error:
            raise ProcessingException("Failed to download document") from error 

downloader_service = DownloaderService()

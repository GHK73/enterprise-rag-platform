# ai-service/app/services/processing/downloader.py

from pathlib import Path
import httpx 

class DocumentDownloader:
    async def download(self,file_url:str, destination:Path)->Path:
        async with httpx.AsyncClient() as client:
            response = await client.get(file_url)
            response.raise_for_status()

        file_path = destination / "document"
        file_path.write_bytes(response.content)
        return file_path 

document_downloader = DocumentDownloader()

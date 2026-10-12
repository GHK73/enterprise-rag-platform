# ai-service/app/services/processing/downloader.py

from ipaddress import ip_address, IPv4Address, IPv6Address
from pathlib import Path
import httpx 
from fastapi import HTTPException
from app.core.exceptions import ProcessingException

BLOCKED_SCHEMES = {"file", "ftp", "gopher", "ldap", "ldaps", "mailto", "news", "nntp", "sftp", "telnet", "wais"}

def _is_private_ip(ip_str: str) -> bool:
    ip = ip_address(ip_str)
    if isinstance(ip, IPv4Address):
        return ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved
    if isinstance(ip, IPv6Address):
        return ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved
    return False

def _validate_url(url: str) -> None:
    from urllib.parse import urlparse
    parsed = urlparse(url)
    if parsed.scheme.lower() in BLOCKED_SCHEMES:
        raise HTTPException(status_code=400, detail="Blocked URL scheme")
    if parsed.scheme.lower() not in {"http", "https"}:
        raise HTTPException(status_code=400, detail="URL scheme must be http or https")
    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(status_code=400, detail="Invalid URL hostname")
    if hostname.lower() in {"localhost", "127.0.0.1", "::1", "0.0.0.0"}:
        raise HTTPException(status_code=400, detail="Blocked URL hostname")
    if hostname == "169.254.169.254":
        raise HTTPException(status_code=400, detail="Blocked metadata endpoint")
    try:
        if _is_private_ip(hostname):
            raise HTTPException(status_code=400, detail="Blocked private IP address")
    except ValueError:
        pass

class DownloaderService:
    DEFAULT_TIMEOUT = 60
    async def download(self, url: str,destination:Path)->Path:
        try:
            _validate_url(str(url))
            async with httpx.AsyncClient(follow_redirects=True,timeout=self.DEFAULT_TIMEOUT,) as client:
                async with client.stream("GET",url) as response:
                    response.raise_for_status()
                    with destination.open("wb") as file:
                        async for chunk in response.aiter_bytes():
                            file.write(chunk)
            return destination
        except ProcessingException:
            raise
        except HTTPException:
            raise
        except Exception as error:
            raise ProcessingException("Failed to download document") from error 

downloader_service = DownloaderService()

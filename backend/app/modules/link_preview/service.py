from __future__ import annotations

import asyncio
import ipaddress
import re
import socket
from urllib.parse import urljoin, urlparse

import httpx

from ...core.exceptions import AppError
from .schema import LinkPreviewOut

YOUTUBE_ID_PATTERN = re.compile(
    r"(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/|youtube\.com/shorts/)([\w-]{11})"
)
META_TAG_PATTERN = re.compile(r"<meta\b[^>]*>", re.IGNORECASE)
TITLE_TAG_PATTERN = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)
PROPERTY_PATTERN = re.compile(r'(?:property|name)\s*=\s*["\']([^"\']+)["\']', re.IGNORECASE)
CONTENT_PATTERN = re.compile(r'content\s*=\s*["\']([^"\']*)["\']', re.IGNORECASE)

MAX_BODY_BYTES = 512_000
FETCH_TIMEOUT = 5.0
MAX_REDIRECTS = 3


def extract_youtube_id(url: str) -> str | None:
    match = YOUTUBE_ID_PATTERN.search(url)
    return match.group(1) if match else None


def _is_disallowed_ip(address: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    return (
        address.is_private or address.is_loopback or address.is_link_local
        or address.is_reserved or address.is_multicast or address.is_unspecified
    )


def _normalize_host(hostname: str) -> str:
    return hostname.lower().rstrip(".")


async def _resolve_public_host(hostname: str) -> bool:
    """Resolves every A/AAAA record for `hostname` and rejects the request
    if ANY of them is a private/loopback/link-local/reserved/multicast
    address -- this is what actually stops SSRF via a domain name that
    resolves to an internal address (including DNS rebinding and the cloud
    metadata endpoint 169.254.169.254), which a purely string-based check
    on the hostname can't catch."""
    hostname = _normalize_host(hostname)
    if not hostname or hostname == "localhost" or hostname.endswith(".local"):
        return False

    try:
        ip_literal = ipaddress.ip_address(hostname)
        return not _is_disallowed_ip(ip_literal)
    except ValueError:
        pass  # not an IP literal -- resolve it as a domain name below

    try:
        results = await asyncio.to_thread(socket.getaddrinfo, hostname, None)
    except socket.gaierror:
        return False

    resolved_ips = {result[4][0] for result in results}
    if not resolved_ips:
        return False

    for ip_str in resolved_ips:
        try:
            address = ipaddress.ip_address(ip_str)
        except ValueError:
            return False
        if _is_disallowed_ip(address):
            return False
    return True


async def _validate_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise AppError("URL must be a valid http(s) address", 422)
    if not await _resolve_public_host(parsed.hostname or ""):
        raise AppError("That URL host isn't allowed", 422)
    return url


def _unescape_entities(text: str) -> str:
    return (
        text.replace("&amp;", "&").replace("&quot;", '"').replace("&#39;", "'")
        .replace("&lt;", "<").replace("&gt;", ">")
    ).strip()


def _extract_meta(html: str) -> dict[str, str]:
    meta: dict[str, str] = {}
    for tag in META_TAG_PATTERN.findall(html):
        property_match = PROPERTY_PATTERN.search(tag)
        content_match = CONTENT_PATTERN.search(tag)
        if not property_match or not content_match:
            continue
        meta[property_match.group(1).lower()] = _unescape_entities(content_match.group(1))
    title_match = TITLE_TAG_PATTERN.search(html)
    if title_match and "og:title" not in meta:
        meta["title"] = _unescape_entities(re.sub(r"\s+", " ", title_match.group(1)))
    return meta


async def _fetch_html(url: str) -> str | None:
    """Best-effort HTML fetch for metadata scraping. Never raises -- any
    failure (timeout, non-HTML response, redirect to a disallowed host,
    connection error) just yields no metadata, so the caller can still fall
    back to a plain URL/title-only preview instead of erroring out.

    Redirects are followed manually (not via httpx's `follow_redirects`)
    so every hop -- not just the final destination -- gets the same DNS-
    resolving host check as the initial URL; otherwise a malicious server
    could 302 through an allowed host straight to an internal address
    without ever being validated."""
    try:
        current_url = url
        async with httpx.AsyncClient(
            timeout=FETCH_TIMEOUT,
            follow_redirects=False,
            headers={"User-Agent": "Mozilla/5.0 (compatible; StudiaLinkPreview/1.0)"},
        ) as client:
            for _ in range(MAX_REDIRECTS + 1):
                try:
                    await _validate_url(current_url)
                except AppError:
                    return None

                async with client.stream("GET", current_url) as response:
                    if response.status_code in (301, 302, 303, 307, 308):
                        location = response.headers.get("location")
                        if not location:
                            return None
                        current_url = urljoin(current_url, location)
                        continue

                    content_type = response.headers.get("content-type", "")
                    if response.status_code >= 400 or "text/html" not in content_type:
                        return None

                    chunks: list[bytes] = []
                    size = 0
                    async for chunk in response.aiter_bytes():
                        chunks.append(chunk)
                        size += len(chunk)
                        if size >= MAX_BODY_BYTES:
                            break
                    return b"".join(chunks).decode("utf-8", errors="ignore")
            return None  # too many redirects
    except (httpx.HTTPError, ValueError):
        return None


async def get_link_preview(url: str) -> LinkPreviewOut:
    url = await _validate_url(url)
    youtube_id = extract_youtube_id(url)
    html = await _fetch_html(url)
    meta = _extract_meta(html) if html else {}

    return LinkPreviewOut(
        url=url,
        kind="youtube" if youtube_id else "website",
        title=meta.get("og:title") or meta.get("title"),
        description=meta.get("og:description") or meta.get("description"),
        imageUrl=meta.get("og:image"),
        siteName=meta.get("og:site_name"),
        youtubeId=youtube_id,
    )

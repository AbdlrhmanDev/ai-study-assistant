from __future__ import annotations

import socket
from pathlib import Path

from ...core.config import get_settings
from ...core.exceptions import AppError
from .exceptions import UnsupportedFileTypeError

EXTENSIONS = {
    "application/pdf": {".pdf"},
    "text/plain": {".txt", ".md", ".markdown"},
}


def validate_document(filename: str, claimed_type: str, data: bytes) -> str:
    suffix = Path(filename).suffix.lower()
    detected = "application/pdf" if data.startswith(b"%PDF-") else "text/plain"
    if detected == "text/plain":
        if b"\x00" in data:
            raise UnsupportedFileTypeError(claimed_type)
        try:
            data.decode("utf-8")
        except UnicodeDecodeError as error:
            raise UnsupportedFileTypeError(claimed_type) from error
    if claimed_type != detected or suffix not in EXTENSIONS[detected]:
        raise UnsupportedFileTypeError(claimed_type)
    return detected


def scan_for_malware(data: bytes) -> None:
    """Scan with ClamAV's INSTREAM protocol when configured."""
    settings = get_settings()
    if not settings.clamav_host:
        if settings.malware_scan_required:
            raise AppError("Upload security scanner is unavailable", 503)
        return
    try:
        with socket.create_connection((settings.clamav_host, settings.clamav_port), timeout=10) as sock:
            sock.sendall(b"zINSTREAM\0")
            for offset in range(0, len(data), 65536):
                chunk = data[offset : offset + 65536]
                sock.sendall(len(chunk).to_bytes(4, "big") + chunk)
            sock.sendall((0).to_bytes(4, "big"))
            result = sock.recv(4096).decode("utf-8", "replace")
        if "FOUND" in result:
            raise AppError("Upload rejected by malware scanner", 422)
        if "OK" not in result:
            raise AppError("Upload security scanner returned an invalid response", 503)
    except AppError:
        raise
    except OSError as error:
        if settings.malware_scan_required:
            raise AppError("Upload security scanner is unavailable", 503) from error

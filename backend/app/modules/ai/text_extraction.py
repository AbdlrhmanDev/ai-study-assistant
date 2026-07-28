from io import BytesIO

from pypdf import PdfReader

from .exceptions import UnsupportedFileTypeError

SUPPORTED_CONTENT_TYPES = {"text/plain", "application/pdf"}


def _strip_null_bytes(text: str) -> str:
    # Postgres text/varchar columns reject 0x00 outright (it's a valid UTF-8
    # codepoint, but not a valid Postgres string byte), and pypdf sometimes
    # emits embedded NULs from malformed PDF content streams.
    return text.replace("\x00", "")


def extract_text(content_type: str, raw_bytes: bytes) -> str:
    if content_type == "text/plain":
        return _strip_null_bytes(raw_bytes.decode("utf-8", errors="replace"))
    if content_type == "application/pdf":
        reader = PdfReader(BytesIO(raw_bytes))
        pages = [page.extract_text() or "" for page in reader.pages]
        return _strip_null_bytes("\n\n".join(page.strip() for page in pages if page.strip()))
    raise UnsupportedFileTypeError(content_type)

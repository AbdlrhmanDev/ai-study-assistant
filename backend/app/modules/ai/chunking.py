import re


def chunk_text(text: str, size: int, overlap: int) -> list[str]:
    """Boundary-aware character chunking with overlap.

    Shared by notes and uploaded documents alike -- called once at write
    time (note create/update, document processing), not per chat request.
    """
    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", text) if part.strip()]
    chunks: list[str] = []
    current = ""
    for paragraph in paragraphs:
        if not current and len(paragraph) > size:
            remaining = paragraph
            while len(remaining) > size:
                boundary = remaining.rfind(" ", 0, size)
                boundary = boundary if boundary > size // 2 else size
                chunks.append(remaining[:boundary].strip())
                remaining = remaining[max(0, boundary - overlap):].strip()
            current = remaining
            continue
        candidate = f"{current}\n\n{paragraph}".strip()
        if current and len(candidate) > size:
            chunks.append(current)
            tail = current[-overlap:] if overlap else ""
            current = f"{tail}\n\n{paragraph}".strip()
            while len(current) > size:
                boundary = current.rfind(" ", 0, size)
                boundary = boundary if boundary > size // 2 else size
                chunks.append(current[:boundary].strip())
                current = current[max(0, boundary - overlap):].strip()
        else:
            current = candidate
    if current:
        chunks.append(current)
    return chunks

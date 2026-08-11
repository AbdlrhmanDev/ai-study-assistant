"""Object-storage key conventions for uploaded documents.

Centralizing these lets an R2/S3 lifecycle policy target each prefix
independently in the bucket console:
- ``documents/``  active, indexed documents (kept until the user deletes them)
- ``tmp/``        reserved for a future direct-to-storage upload path (signed
  PUT URLs); nothing writes here yet, but the prefix exists so a lifecycle
  rule (e.g. "expire objects older than 24h") can be configured ahead of time
"""

DOCUMENTS_PREFIX = "documents"
TMP_PREFIX = "tmp"


def document_key(user_id: int, document_id: int, ext: str) -> str:
    return f"{DOCUMENTS_PREFIX}/{user_id}/{document_id}/source{ext}"


def tmp_upload_key(user_id: int, upload_id: str, ext: str) -> str:
    return f"{TMP_PREFIX}/{user_id}/{upload_id}{ext}"

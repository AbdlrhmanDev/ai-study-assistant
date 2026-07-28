from pathlib import Path
from typing import Protocol

from ...core.config import get_settings


class StorageBackend(Protocol):
    def save(self, relative_path: str, raw_bytes: bytes) -> str: ...
    def read(self, storage_path: str) -> bytes: ...
    def delete(self, storage_path: str) -> None: ...


class LocalFilesystemStorage:
    """Stores files on local disk under `settings.upload_dir`.

    Adequate for single-instance/dev deployments. A future object-storage
    backend (S3-compatible) can implement the same `StorageBackend` protocol
    and be swapped in via `settings.storage_backend` without touching
    callers -- not built here, since no bucket/credentials were provided.
    """

    def __init__(self, base_dir: str) -> None:
        self._base_dir = Path(base_dir)

    def save(self, relative_path: str, raw_bytes: bytes) -> str:
        full_path = self._base_dir / relative_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_bytes(raw_bytes)
        return str(full_path)

    def read(self, storage_path: str) -> bytes:
        return Path(storage_path).read_bytes()

    def delete(self, storage_path: str) -> None:
        path = Path(storage_path)
        if not path.exists():
            return
        path.unlink()
        try:
            path.parent.rmdir()  # clean up the per-document directory if now empty
        except OSError:
            pass


def get_storage_backend() -> StorageBackend:
    settings = get_settings()
    if settings.storage_backend == "local":
        return LocalFilesystemStorage(settings.upload_dir)
    raise ValueError(f"Unsupported storage backend: {settings.storage_backend}")

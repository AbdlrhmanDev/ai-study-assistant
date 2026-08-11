from __future__ import annotations

from pathlib import Path
from typing import Protocol

from ...core.config import get_settings


class StorageBackend(Protocol):
    def save(self, object_key: str, raw_bytes: bytes, content_type: str | None = None) -> str: ...
    def read(self, storage_path: str) -> bytes: ...
    def delete(self, storage_path: str) -> None: ...
    def signed_download_url(self, storage_path: str) -> str | None: ...
    # Additive capability for a future direct-to-storage upload path -- the
    # current multipart POST flow needs the raw bytes server-side anyway
    # (validation, MIME sniffing, malware scan), so nothing calls this yet.
    def signed_upload_url(self, object_key: str, content_type: str | None = None) -> str | None: ...


class LocalFilesystemStorage:
    """Development-only storage. Database values are stable object keys, not host paths."""

    def __init__(self, base_dir: str) -> None:
        self._base_dir = Path(base_dir).resolve()

    def _path(self, object_key: str) -> Path:
        candidate = Path(object_key)
        # Read/delete legacy rows that predate object-key storage while new
        # writes always return portable keys.
        path = candidate.resolve() if candidate.is_absolute() else (self._base_dir / candidate).resolve()
        if self._base_dir not in path.parents:
            raise ValueError("Unsafe storage object key")
        return path

    def save(self, object_key: str, raw_bytes: bytes, content_type: str | None = None) -> str:
        path = self._path(object_key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(raw_bytes)
        return object_key

    def read(self, storage_path: str) -> bytes:
        return self._path(storage_path).read_bytes()

    def delete(self, storage_path: str) -> None:
        path = self._path(storage_path)
        if path.exists():
            path.unlink()
        try:
            path.parent.rmdir()
        except OSError:
            pass

    def signed_download_url(self, storage_path: str) -> str | None:
        return None

    def signed_upload_url(self, object_key: str, content_type: str | None = None) -> str | None:
        return None


class S3CompatibleStorage:
    """Private S3-compatible object storage (AWS S3, R2, MinIO, or B2)."""

    def __init__(self) -> None:
        import boto3

        settings = get_settings()
        kwargs = {
            "service_name": "s3",
            "region_name": settings.s3_region,
            "aws_access_key_id": settings.s3_access_key_id,
            "aws_secret_access_key": settings.s3_secret_access_key,
        }
        if settings.s3_endpoint_url:
            kwargs["endpoint_url"] = settings.s3_endpoint_url
        self._client = boto3.client(**kwargs)
        self._bucket = settings.s3_bucket
        self._ttl = settings.signed_url_ttl_seconds

    def save(self, object_key: str, raw_bytes: bytes, content_type: str | None = None) -> str:
        args = {"Bucket": self._bucket, "Key": object_key, "Body": raw_bytes}
        if content_type:
            args["ContentType"] = content_type
        self._client.put_object(**args)
        return object_key

    def read(self, storage_path: str) -> bytes:
        return self._client.get_object(Bucket=self._bucket, Key=storage_path)["Body"].read()

    def delete(self, storage_path: str) -> None:
        self._client.delete_object(Bucket=self._bucket, Key=storage_path)

    def signed_download_url(self, storage_path: str) -> str:
        return self._client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket, "Key": storage_path},
            ExpiresIn=self._ttl,
        )

    def signed_upload_url(self, object_key: str, content_type: str | None = None) -> str:
        params = {"Bucket": self._bucket, "Key": object_key}
        if content_type:
            params["ContentType"] = content_type
        return self._client.generate_presigned_url("put_object", Params=params, ExpiresIn=self._ttl)


def get_storage_backend() -> StorageBackend:
    settings = get_settings()
    if settings.storage_backend == "local":
        return LocalFilesystemStorage(settings.upload_dir)
    if settings.storage_backend == "s3":
        return S3CompatibleStorage()
    raise ValueError(f"Unsupported storage backend: {settings.storage_backend}")

"""S3CompatibleStorage tests against moto's in-memory AWS mock -- no real
Cloudflare/AWS credentials or network access required."""

import boto3
import pytest
from moto import mock_aws

from app.core.config import get_settings
from app.modules.ai.storage import S3CompatibleStorage

BUCKET = "studia-test-bucket"


@pytest.fixture
def s3_backend(monkeypatch: pytest.MonkeyPatch):
    with mock_aws():
        settings = get_settings()
        monkeypatch.setattr(settings, "s3_bucket", BUCKET)
        monkeypatch.setattr(settings, "s3_region", "us-east-1")
        monkeypatch.setattr(settings, "s3_endpoint_url", "")
        monkeypatch.setattr(settings, "s3_access_key_id", "test-access-key")
        monkeypatch.setattr(settings, "s3_secret_access_key", "test-secret-key")
        client = boto3.client("s3", region_name="us-east-1")
        client.create_bucket(Bucket=BUCKET)
        yield S3CompatibleStorage()


def test_save_and_read_round_trip(s3_backend: S3CompatibleStorage) -> None:
    key = s3_backend.save("documents/1/1/source.txt", b"hello world", "text/plain")
    assert key == "documents/1/1/source.txt"
    assert s3_backend.read(key) == b"hello world"


def test_delete_removes_object(s3_backend: S3CompatibleStorage) -> None:
    key = s3_backend.save("documents/1/2/source.txt", b"gone soon", "text/plain")
    s3_backend.delete(key)
    with pytest.raises(Exception):
        s3_backend.read(key)


def test_delete_is_idempotent_for_missing_object(s3_backend: S3CompatibleStorage) -> None:
    """S3 DeleteObject succeeds even for a key that was never created --
    calling delete twice (e.g. a retried cleanup sweep) must not raise."""
    s3_backend.delete("documents/1/999/source.txt")
    s3_backend.delete("documents/1/999/source.txt")


def test_signed_download_url_targets_bucket_and_key(s3_backend: S3CompatibleStorage) -> None:
    key = s3_backend.save("documents/1/3/source.pdf", b"%PDF-1.4 fake", "application/pdf")
    url = s3_backend.signed_download_url(key)
    assert BUCKET in url
    assert "source.pdf" in url


def test_signed_upload_url_targets_bucket_and_key(s3_backend: S3CompatibleStorage) -> None:
    url = s3_backend.signed_upload_url("documents/1/4/source.pdf", "application/pdf")
    assert BUCKET in url
    assert "source.pdf" in url

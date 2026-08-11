import pytest

from app.core.exceptions import AppError
from app.modules.users.service import validate_profile_image


def test_accepts_supported_profile_image_signatures():
    assert validate_profile_image(b"\x89PNG\r\n\x1a\ncontent", "image/png") == ("image/png", ".png")
    assert validate_profile_image(b"\xff\xd8\xffcontent", "image/jpeg") == ("image/jpeg", ".jpg")
    assert validate_profile_image(b"RIFF\x00\x00\x00\x00WEBPcontent", "image/webp") == ("image/webp", ".webp")


@pytest.mark.parametrize(
    ("payload", "content_type"),
    [(b"not-an-image", "image/png"), (b"<svg></svg>", "image/svg+xml"), (b"", "image/png")],
)
def test_rejects_invalid_profile_images(payload: bytes, content_type: str):
    with pytest.raises(AppError):
        validate_profile_image(payload, content_type)

from typing import Literal

from pydantic import BaseModel


class LinkPreviewOut(BaseModel):
    url: str
    kind: Literal["youtube", "website"]
    title: str | None = None
    description: str | None = None
    imageUrl: str | None = None
    siteName: str | None = None
    youtubeId: str | None = None

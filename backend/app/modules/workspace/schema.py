from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


BlockType = Literal[
    "text",
    "heading_1",
    "heading_2",
    "heading_3",
    "heading_4",
    "bulleted_list_item",
    "numbered_list_item",
    "todo",
    "toggle",
    "quote",
    "callout",
    "code",
    "divider",
    "equation",
    "image",
    "video",
    "bookmark",
    "page",
]

BlockColor = Literal[
    "default", "violet", "coral", "mint", "success", "danger", "warning", "info"
]

MAX_BLOCK_DEPTH = 8
MAX_BLOCKS_PER_PAGE = 500


class BlockProperties(StrictModel):
    textColor: BlockColor | None = None
    backgroundColor: BlockColor | None = None
    checked: bool | None = None
    language: str | None = Field(None, max_length=30)
    url: str | None = Field(None, max_length=2000)
    title: str | None = Field(None, max_length=200)
    description: str | None = Field(None, max_length=500)
    imageUrl: str | None = Field(None, max_length=2000)
    siteName: str | None = Field(None, max_length=100)
    youtubeId: str | None = Field(None, max_length=20)


class Block(StrictModel):
    """A single node in a page's block tree. Every block type shares this
    envelope -- `content`/`properties` are interpreted differently per
    `type` at the UI layer, matching how Notion-style editors store blocks
    uniformly rather than as a discriminated union per type."""

    id: str = Field(min_length=1, max_length=64)
    type: BlockType
    content: str = Field("", max_length=10000)
    properties: BlockProperties = Field(default_factory=BlockProperties)
    children: list["Block"] = Field(default_factory=list)


Block.model_rebuild()


def _walk_and_count(blocks: list[Block], depth: int) -> int:
    if depth > MAX_BLOCK_DEPTH:
        raise ValueError(f"Blocks nested deeper than {MAX_BLOCK_DEPTH} levels")
    count = 0
    for block in blocks:
        count += 1
        count += _walk_and_count(block.children, depth + 1)
    return count


def validate_block_tree(blocks: list[Block]) -> list[Block]:
    total = _walk_and_count(blocks, 1)
    if total > MAX_BLOCKS_PER_PAGE:
        raise ValueError(f"A page can hold at most {MAX_BLOCKS_PER_PAGE} blocks")
    return blocks


class WorkspacePageCreate(StrictModel):
    title: str = Field(min_length=1, max_length=200)
    topic_id: int | None = Field(None, gt=0)


class WorkspacePageImportItem(StrictModel):
    title: str = Field(min_length=1, max_length=200)
    topicId: int | None = Field(None, gt=0)
    blocks: list[Block] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_blocks(self) -> "WorkspacePageImportItem":
        validate_block_tree(self.blocks)
        return self


MAX_IMPORT_PAGES = 100


class WorkspacePageImport(StrictModel):
    pages: list[WorkspacePageImportItem] = Field(default_factory=list)

    @model_validator(mode="after")
    def cap_pages(self) -> "WorkspacePageImport":
        if len(self.pages) > MAX_IMPORT_PAGES:
            raise ValueError(f"At most {MAX_IMPORT_PAGES} pages can be imported at once")
        return self


class WorkspacePageUpdate(StrictModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    blocks: list[Block] | None = None
    # Optimistic concurrency: the `updatedAt` this client last saw (from
    # load or its own previous save). If omitted, the write always wins
    # (matches today's behavior) -- callers that care about detecting a
    # concurrent-tab conflict must opt in by sending it.
    expectedUpdatedAt: str | None = None

    @model_validator(mode="after")
    def require_value(self) -> "WorkspacePageUpdate":
        if self.title is None and self.blocks is None:
            raise ValueError("At least one field is required")
        if self.blocks is not None:
            validate_block_tree(self.blocks)
        return self


class LinkWorkspacePageTopic(StrictModel):
    topic_id: int | None = Field(..., gt=0)


class AskAiOnBlock(StrictModel):
    instruction: str = Field(min_length=1, max_length=500)


class AskAiResult(BaseModel):
    answer: str
    provider: str
    model: str


class WorkspacePageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    topic_id: int | None
    title: str
    blocks: list[dict]
    created_at: datetime
    updated_at: datetime


class WorkspacePageVersionSummaryOut(BaseModel):
    """Listing view -- omits `blocks` since a page can hold up to 500 of
    them; fetch the single version to preview or restore it."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    workspace_page_id: int
    title: str
    created_at: datetime


class WorkspacePageVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    workspace_page_id: int
    title: str
    blocks: list[dict]
    created_at: datetime

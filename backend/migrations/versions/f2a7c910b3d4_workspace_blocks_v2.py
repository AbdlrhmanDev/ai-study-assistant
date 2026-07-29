"""workspace_blocks_v2

Revision ID: f2a7c910b3d4
Revises: a15f7c2d9e64
Create Date: 2026-07-29 14:00:00.000000

Rewrites the JSON shape stored in `workspace_pages.blocks` from the original
4-type flat union (heading/text/checklist/link) to the new uniform,
recursive block envelope `{id, type, content, properties, children}` used
by the upgraded Notion-style block editor. This is a DATA migration -- the
column itself stays JSONB, only the JSON shape inside it changes.

Mapping: heading -> heading_1, text -> text (unchanged shape), checklist ->
N sibling todo blocks (one per checklist item, item.text -> content,
item.checked -> properties.checked), link -> bookmark (url/title/description
moved into properties).

downgrade() is lossy/best-effort: it clears `blocks` back to `[]`, since a
checklist that was split into N todo blocks can't be losslessly
reconstructed into a single checklist block on the way back down.
"""
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f2a7c910b3d4'
down_revision: Union[str, Sequence[str], None] = 'a15f7c2d9e64'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _convert_block(old: dict) -> list[dict]:
    """Convert one old-shape block into a list of new-shape blocks (usually
    length 1, except checklist -> N todo blocks)."""
    old_type = old.get("type")
    block_id = old.get("id") or "b0"

    if old_type == "heading":
        return [{
            "id": block_id, "type": "heading_1", "content": old.get("content", ""),
            "properties": {}, "children": [],
        }]
    if old_type == "text":
        return [{
            "id": block_id, "type": "text", "content": old.get("content", ""),
            "properties": {}, "children": [],
        }]
    if old_type == "checklist":
        items = old.get("items") or []
        return [{
            "id": item.get("id") or f"{block_id}-{index}",
            "type": "todo",
            "content": item.get("text", ""),
            "properties": {"checked": bool(item.get("checked", False))},
            "children": [],
        } for index, item in enumerate(items)]
    if old_type == "link":
        return [{
            "id": block_id, "type": "bookmark", "content": "",
            "properties": {
                "url": old.get("url"),
                "title": old.get("title"),
                "description": old.get("description"),
            },
            "children": [],
        }]
    # Unknown/already-new-shape block: pass through unchanged.
    return [old]


def _convert_blocks(old_blocks: list[dict]) -> list[dict]:
    converted: list[dict] = []
    for old in old_blocks:
        converted.extend(_convert_block(old))
    return converted


def upgrade() -> None:
    connection = op.get_bind()
    rows = connection.execute(sa.text("SELECT id, blocks FROM workspace_pages")).fetchall()
    for row in rows:
        old_blocks = row.blocks or []
        new_blocks = _convert_blocks(old_blocks)
        connection.execute(
            sa.text("UPDATE workspace_pages SET blocks = CAST(:blocks AS jsonb) WHERE id = :id"),
            {"blocks": json.dumps(new_blocks), "id": row.id},
        )


def downgrade() -> None:
    connection = op.get_bind()
    connection.execute(sa.text("UPDATE workspace_pages SET blocks = '[]'::jsonb"))

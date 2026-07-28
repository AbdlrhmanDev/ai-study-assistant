from typing import TypedDict


class PaginationMeta(TypedDict):
    page: int
    limit: int
    total: int
    totalPages: int


def build_pagination_meta(total: int, page: int, limit: int) -> PaginationMeta:
    return {
        "page": page,
        "limit": limit,
        "total": total,
        "totalPages": (total + limit - 1) // limit if limit else 0,
    }

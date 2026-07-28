"""Pure validation/normalization of an LLM-produced mind map tree. Keeps
the shape honest: bounded depth and fan-out, no empty titles, no cycles
possible (it's a fresh tree built from scratch every time, never mutated)."""

MAX_DEPTH = 3
MAX_CHILDREN_PER_NODE = 6
MAX_TITLE_LENGTH = 150


def normalize_node(raw: object, depth: int = 0) -> dict | None:
    if not isinstance(raw, dict):
        return None
    title = str(raw.get("title") or raw.get("name") or "").strip()[:MAX_TITLE_LENGTH]
    if not title:
        return None

    children_raw = raw.get("children") if isinstance(raw.get("children"), list) else []
    children: list[dict] = []
    if depth < MAX_DEPTH - 1:
        for child_raw in children_raw[:MAX_CHILDREN_PER_NODE]:
            normalized_child = normalize_node(child_raw, depth + 1)
            if normalized_child is not None:
                children.append(normalized_child)

    return {"title": title, "children": children}


def normalize_mind_map(raw_root: object) -> dict | None:
    return normalize_node(raw_root, depth=0)


def count_nodes(node: dict) -> int:
    return 1 + sum(count_nodes(child) for child in node["children"])

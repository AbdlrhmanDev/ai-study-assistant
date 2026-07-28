"""Pure engagement -> modality-weight scoring. No LLM involved by design
(the PRD requires learning style to be inferred from behavior, not self-report
or generation) -- only deterministic aggregation of real activity counts."""

AXES = ("visual", "reading", "practice", "flashcards", "examples", "conversation")

MIN_EVENTS_FOR_SIGNAL = 10

ACTIVITY_AXIS_MAP: dict[str, str] = {
    "note_created": "reading",
    "note_updated": "reading",
    "quiz_completed": "practice",
    "flashcard_created": "flashcards",
    "flashcards_generated": "flashcards",
    "flashcard_reviewed": "flashcards",
    "ai_chat": "conversation",
    "diagnosis_viewed": "examples",
    "knowledge_graph_viewed": "visual",
    "mind_map_viewed": "visual",
}


def balanced_weights() -> dict[str, float]:
    share = 1.0 / len(AXES)
    return {axis: share for axis in AXES}


def axis_counts_from_activities(activity_counts: dict[str, int]) -> dict[str, int]:
    counts = dict.fromkeys(AXES, 0)
    for activity_type, count in activity_counts.items():
        axis = ACTIVITY_AXIS_MAP.get(activity_type)
        if axis:
            counts[axis] += count
    return counts


def normalize_weights(axis_counts: dict[str, int]) -> dict[str, float]:
    total = sum(axis_counts.get(axis, 0) for axis in AXES)
    if total <= 0:
        return balanced_weights()
    return {axis: axis_counts.get(axis, 0) / total for axis in AXES}


def compute_profile(activity_counts: dict[str, int]) -> tuple[dict[str, float], int]:
    """Returns (weights, total_signal_events). Falls back to balanced weights
    until enough signal has accumulated, so a new user isn't mislabeled off a
    handful of events."""
    axis_counts = axis_counts_from_activities(activity_counts)
    total_events = sum(axis_counts.values())
    if total_events < MIN_EVENTS_FOR_SIGNAL:
        return balanced_weights(), total_events
    return normalize_weights(axis_counts), total_events


def dominant_axes(weights: dict[str, float], top_n: int = 2) -> list[str]:
    return [axis for axis, _ in sorted(weights.items(), key=lambda kv: kv[1], reverse=True)[:top_n]]

from dataclasses import dataclass

# Level names track competency, not raw activity -- since XP itself is only
# ever awarded for evidence of learning (see rules.py), accumulated XP is a
# reasonable proxy for genuine progress in a topic.
LEVELS: tuple[tuple[int, str], ...] = (
    (0, "Novice"),
    (100, "Apprentice"),
    (300, "Practitioner"),
    (700, "Scholar"),
    (1500, "Master"),
)


@dataclass
class LevelProgress:
    level_name: str
    total_xp: int
    next_level_name: str | None
    xp_into_level: int
    xp_for_next_level: int | None  # None once at the top level


def level_for_xp(total_xp: int) -> str:
    name = LEVELS[0][1]
    for threshold, level_name in LEVELS:
        if total_xp >= threshold:
            name = level_name
        else:
            break
    return name


def level_progress(total_xp: int) -> LevelProgress:
    total_xp = max(0, total_xp)
    current_threshold = LEVELS[0][0]
    current_name = LEVELS[0][1]
    next_threshold: int | None = None
    next_name: str | None = None

    for index, (threshold, name) in enumerate(LEVELS):
        if total_xp >= threshold:
            current_threshold, current_name = threshold, name
            if index + 1 < len(LEVELS):
                next_threshold, next_name = LEVELS[index + 1]
            else:
                next_threshold, next_name = None, None
        else:
            break

    xp_for_next = (next_threshold - current_threshold) if next_threshold is not None else None
    return LevelProgress(
        level_name=current_name,
        total_xp=total_xp,
        next_level_name=next_name,
        xp_into_level=total_xp - current_threshold,
        xp_for_next_level=xp_for_next,
    )

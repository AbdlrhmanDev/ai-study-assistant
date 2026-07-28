from datetime import date, timedelta


def next_streak(current_streak: int, last_active_date: date | None, today: date) -> int:
    """A graded action just happened `today`. Same-day actions don't double
    count; a gap of exactly one day extends the streak; any larger gap (or
    no prior streak) restarts it at 1."""
    if last_active_date is None:
        return 1
    if last_active_date == today:
        return max(current_streak, 1)
    if last_active_date == today - timedelta(days=1):
        return current_streak + 1
    return 1

import re

_VERDICT_LINE_RE = re.compile(r"\n?VERDICT:\s*(OPEN|CONTINUE|CONCEDE)\s*$", re.IGNORECASE)

VERDICTS = ("open", "continue", "concede")

# The model gets at most one probing follow-up after its opening claim before
# a concession is forced -- a deterministic backstop, since LLMs (observed
# with Groq's llama-3.3-70b) don't reliably self-terminate a round on prompt
# instructions alone and will keep raising new angles indefinitely.
MAX_FOLLOWUP_TURNS = 1


def should_force_concede(assistant_turns_so_far: int) -> bool:
    """`assistant_turns_so_far` counts the AI's replies already in this spar,
    including the opening claim. Once it has used its one follow-up (i.e.
    replied twice: opening + one probe), the next reply must concede."""
    return assistant_turns_so_far >= 1 + MAX_FOLLOWUP_TURNS


def parse_verdict(raw_answer: str) -> tuple[str, str]:
    """Split the model's raw sparring reply into (clean_answer, verdict).

    Falls back to "continue" if the model didn't emit the trailing
    VERDICT line as instructed, so a malformed reply degrades to "keep
    sparring" rather than silently crediting mastery.
    """
    match = _VERDICT_LINE_RE.search(raw_answer)
    if not match:
        return raw_answer.strip(), "continue"
    clean = _VERDICT_LINE_RE.sub("", raw_answer).strip()
    return clean, match.group(1).lower()

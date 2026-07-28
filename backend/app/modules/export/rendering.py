"""PDF rendering for the progress report -- isolated from service.py so the
reportlab import (a real dependency, unlike the stdlib-only CSV path) only
loads when a PDF is actually requested."""

import io
from typing import TYPE_CHECKING

from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

if TYPE_CHECKING:
    from .service import ProgressReportData

HEADER_BG = colors.HexColor("#1f2937")
ROW_ALT_BG = colors.HexColor("#f3f4f6")
GRID_COLOR = colors.HexColor("#d1d5db")


def _table(header: list[str], rows: list[list[str]]) -> Table:
    table = Table([header, *rows], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, GRID_COLOR),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, ROW_ALT_BG]),
            ]
        )
    )
    return table


def render_progress_pdf(report: "ProgressReportData") -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=LETTER, title="Study Progress Report")
    styles = getSampleStyleSheet()

    story = [
        Paragraph("Study Progress Report", styles["Title"]),
        Paragraph(f"Generated {report.generated_at.strftime('%Y-%m-%d %H:%M UTC')}", styles["Normal"]),
        Spacer(1, 16),
    ]

    retention = (
        f"{report.flashcard_retention_rate:.0%}"
        if report.flashcard_retention_rate is not None
        else "n/a"
    )
    summary_rows = [
        ["Total study activities", str(report.total_activities)],
        ["Activities this week", str(report.activities_this_week)],
        ["AI tutor interactions", str(report.ai_interactions)],
        ["Topics studied", str(report.topics_studied)],
        ["Current streak", f"{report.current_streak} days"],
        ["Longest streak", f"{report.longest_streak} days"],
        ["Flashcard reviews completed", str(report.flashcard_reviews_total)],
        ["Flashcard retention rate", retention],
    ]
    story.append(_table(["Summary", ""], summary_rows))
    story.append(Spacer(1, 16))

    story.append(Paragraph("XP by topic", styles["Heading2"]))
    if report.topic_xp:
        story.append(_table(["Topic", "XP"], [[title, str(xp)] for title, xp in report.topic_xp]))
    else:
        story.append(Paragraph("No topic activity yet.", styles["Normal"]))
    story.append(Spacer(1, 16))

    story.append(Paragraph("Concept mastery", styles["Heading2"]))
    if report.mastery:
        story.append(
            _table(["Concept", "Mastery"], [[name, f"{score:.0%}"] for name, score in report.mastery])
        )
    else:
        story.append(Paragraph("No concept mastery data yet.", styles["Normal"]))

    doc.build(story)
    return buffer.getvalue()

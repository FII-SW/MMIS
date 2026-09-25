"""Render a PM record as a PDF in the same layout as the IndySoft PM form."""
from datetime import datetime, timezone
from io import BytesIO
from xml.sax.saxutils import escape
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .pm_checklists import PM_DIVISION, PM_TYPE_LABELS, get_checklist

RESULT_TEXT = {"passed": "PASSED", "failed": "FAILED", "na": "N/A"}
HEADER_CYAN = colors.HexColor("#CCF5FB")
HEADER_GREEN = colors.HexColor("#D4F5C9")
REFERENCE_ORANGE = colors.HexColor("#F7A21B")


def _zone(tz_name: str | None):
    if tz_name:
        try:
            return ZoneInfo(tz_name)
        except (ZoneInfoNotFoundError, ValueError):
            pass
    return timezone.utc


def _localize(value: datetime | None, tz) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(tz)


def _p(text, style) -> Paragraph:
    return Paragraph(escape(str(text or "")).replace("\n", "<br/>"), style)


def build_pm_record_pdf(record: dict, fixture, tz_name: str | None = None) -> bytes:
    tz = _zone(tz_name)
    pm_label = PM_TYPE_LABELS.get(record["pm_type"], record["pm_type"])
    test_area = record.get("test_area") or getattr(fixture, "test_area", None)
    checklist = get_checklist(record["pm_type"], test_area) or {}
    title = checklist.get("title") or pm_label
    fixture_name = getattr(fixture, "fixture_name", None) or f"Fixture #{record['fixture_id']}"

    styles = getSampleStyleSheet()
    base = ParagraphStyle("base", parent=styles["Normal"], fontName="Helvetica", fontSize=10, leading=13)
    bold = ParagraphStyle("bold", parent=base, fontName="Helvetica-Bold")
    heading = ParagraphStyle("heading", parent=bold, fontSize=13, leading=16, alignment=TA_CENTER)
    cell = ParagraphStyle("cell", parent=base, fontSize=9.5, leading=12)
    cell_center = ParagraphStyle("cellCenter", parent=cell, alignment=TA_CENTER, fontName="Helvetica-Bold")
    small = ParagraphStyle("small", parent=base, fontSize=7.5, textColor=colors.grey)

    story = [Paragraph(escape(title), heading), Spacer(1, 0.25 * inch)]

    meta = Table(
        [
            [_p(f"Division: {PM_DIVISION}", base), Paragraph(f"Period of Procedure: <b>{escape(pm_label)}</b>", base)],
            [_p(f"Description: {checklist.get('description') or test_area or ''}", base), _p(f"ID #: {fixture_name}", base)],
            [
                _p(f"Project: {record.get('project_name') or getattr(fixture, 'project_name', '') or ''}", base),
                _p(f"Asset Tag: {getattr(fixture, 'asset_tag', None) or '—'}   Test Area: {test_area or ''}", base),
            ],
            [
                _p(f"Manufacturer: {getattr(fixture, 'manufacturer', None) or '—'}", base),
                _p(f"Line: {getattr(fixture, 'production_line', None) or '—'}", base),
            ],
        ],
        colWidths=[3.6 * inch, 3.4 * inch],
    )
    meta.setStyle(TableStyle([("BOTTOMPADDING", (0, 0), (-1, -1), 6), ("LEFTPADDING", (0, 0), (-1, -1), 0)]))
    story += [meta, Spacer(1, 0.15 * inch)]

    if checklist.get("reference"):
        reference = Table([[_p(checklist["reference"], base)]], hAlign="LEFT")
        reference.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), REFERENCE_ORANGE)]))
        story += [reference, Spacer(1, 0.15 * inch)]

    rows = [
        [Paragraph(f"<b>{escape(fixture_name)} - {escape(pm_label)}</b>", cell_center), ""],
        [Paragraph("<b>Task</b>", cell_center), Paragraph("<b>Result</b>", cell_center)],
    ]
    failed_rows = []
    for item in record.get("checklist", []):
        result = item.get("result")
        if result == "failed":
            failed_rows.append(len(rows))
        rows.append([_p(item.get("task"), cell), _p(RESULT_TEXT.get(result, result), cell)])

    notes_lines = []
    if checklist.get("note"):
        notes_lines.append(escape(checklist["note"]))
    notes_lines.append(f"<br/>Notes: {escape(record.get('notes') or '(none)')}".replace("\n", "<br/>"))
    notes_lines.append(f"Parts replaced: {escape(record.get('parts_replaced') or '(none)')}".replace("\n", "<br/>"))
    rows.append([Paragraph("<br/>".join(notes_lines), cell), ""])
    notes_row = len(rows) - 1

    table = Table(rows, colWidths=[4.6 * inch, 2.4 * inch])
    style = [
        ("GRID", (0, 0), (-1, -1), 0.6, colors.black),
        ("BOX", (0, 0), (-1, -1), 1.2, colors.black),
        ("SPAN", (0, 0), (1, 0)),
        ("BACKGROUND", (0, 0), (1, 0), HEADER_CYAN),
        ("BACKGROUND", (0, 1), (0, 1), HEADER_GREEN),
        ("BACKGROUND", (1, 1), (1, 1), HEADER_CYAN),
        ("SPAN", (0, notes_row), (1, notes_row)),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("VALIGN", (0, notes_row), (-1, notes_row), "TOP"),
        ("BOTTOMPADDING", (0, notes_row), (-1, notes_row), 36),
    ]
    for row_index in failed_rows:
        style += [
            ("TEXTCOLOR", (1, row_index), (1, row_index), colors.HexColor("#B91C1C")),
            ("BACKGROUND", (1, row_index), (1, row_index), colors.HexColor("#FEE2E2")),
        ]
    table.setStyle(TableStyle(style))
    story += [table, Spacer(1, 0.25 * inch)]

    performed_at = _localize(record.get("performed_at"), tz)
    date_text = performed_at.strftime("%m/%d/%Y %I:%M %p") if performed_at else "—"
    technician = (record.get("performed_by") or "Unknown").upper()
    story += [
        _p(f"Date: {date_text}", base),
        Spacer(1, 0.12 * inch),
        _p(f"Technician: {technician}", base),
        Spacer(1, 0.12 * inch),
        _p(f"Overall Result: {(record.get('overall_result') or '').upper()}", base),
        Spacer(1, 0.12 * inch),
        _p(f"Registered in IndySoft: {'Yes' if record.get('indysoft_recorded') else 'No'}", base),
        Spacer(1, 0.3 * inch),
        _p(
            f"PM record #{record['pm_id']} · Generated by MMIS on "
            f"{datetime.now(tz).strftime('%m/%d/%Y %I:%M %p')}",
            small,
        ),
    ]

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.7 * inch,
        bottomMargin=0.7 * inch,
        title=f"{fixture_name} - {pm_label}",
        author="MMIS",
    )
    doc.build(story)
    return buffer.getvalue()

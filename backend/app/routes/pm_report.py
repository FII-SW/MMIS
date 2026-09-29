# backend/app/routes/pm_report.py
"""Preventive maintenance report: PMs passed / failed and PMs overdue, per day, week or month."""
import bisect
import json
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..utils.pm_checklists import PM_COVERS, PM_INTERVAL_DAYS, PM_TYPE_LABELS, get_pm_types
from .maintenance import _active_records, _as_utc, _pm_test_area_filter, _pm_tracking_start
from .pm_dashboard import _filter_options, _search_filter

router = APIRouter(prefix="/maintenance", tags=["Maintenance report"])

GROUPS = ("day", "week", "month")
RESULTS = ("all", "passed", "failed")
DEFAULT_RANGE_DAYS = 28
MAX_PERIODS = 400
RECORD_LIMIT = 5000


def _zone(name: str | None):
    if not name:
        return timezone.utc
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return timezone.utc


def _next_boundary(local: datetime, group: str) -> datetime:
    if group == "day":
        return local + timedelta(days=1)
    if group == "week":
        return local + timedelta(days=7)
    return (local.replace(day=28) + timedelta(days=4)).replace(day=1)


def _period_label(local: datetime, group: str) -> str:
    day = f"{local:%b} {local.day}, {local.year}"
    if group == "day":
        return f"{local:%a} {day}"
    if group == "week":
        sunday = local + timedelta(days=6)
        return f"WW{local.isocalendar()[1]:02d} · {local:%b} {local.day} – {sunday:%b} {sunday.day}, {sunday.year}"
    return f"{local:%B %Y}"


def build_periods(start: datetime, end: datetime, group: str, tz) -> list[dict]:
    """Calendar periods (local midnight / Monday / 1st of month) covering [start, end), clipped to it."""
    local = start.astimezone(tz).replace(hour=0, minute=0, second=0, microsecond=0)
    if group == "week":
        local -= timedelta(days=local.weekday())
    elif group == "month":
        local = local.replace(day=1)

    periods = []
    while True:
        following = _next_boundary(local, group)
        period_start = max(start, local.astimezone(timezone.utc))
        period_end = min(end, following.astimezone(timezone.utc))
        if period_start < period_end:
            periods.append({"start": period_start, "end": period_end, "label": _period_label(local, group)})
            if len(periods) > MAX_PERIODS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Too many {group}s in this range (max {MAX_PERIODS}). Pick a shorter range or a bigger grouping.",
                )
        if following.astimezone(timezone.utc) >= end:
            return periods
        local = following


def last_covering(record_times: dict, fixture_id: int, pm_type: str, at: datetime) -> datetime | None:
    """Latest record at or before `at` of this PM type or one that covers it (biweekly covers weekly)."""
    covering = [pm_type] + [other for other, covered in PM_COVERS.items() if pm_type in covered]
    last = None
    for kind in covering:
        times = record_times.get((fixture_id, kind), [])
        index = bisect.bisect_right(times, at)
        if index and (last is None or times[index - 1] > last):
            last = times[index - 1]
    return last


def overdue_at(pairs: list[tuple], record_times: dict, at: datetime) -> list[tuple]:
    """
    pairs: (fixture, pm_type, baseline). Returns (fixture, pm_type, due_at, last_at) for every PM
    whose due date had passed at `at`, using the same due-date rule as the live PM status.
    """
    overdue = []
    for fixture, pm_type, baseline in pairs:
        if baseline is None or baseline > at:
            continue
        interval = timedelta(days=PM_INTERVAL_DAYS[pm_type])
        last = last_covering(record_times, fixture.fixture_id, pm_type, at)
        due = baseline + interval
        if last is not None:
            due = max(due, last + interval)
        if due < at:
            overdue.append((fixture, pm_type, due, last))
    return overdue


def _failed_tasks(record: models.FixturePMRecord) -> list[str]:
    try:
        checklist = json.loads(record.checklist_results or "[]")
    except (TypeError, ValueError):
        return []
    return [item.get("task", "") for item in checklist if item.get("result") == "failed"]


def _counts(records: list[dict]) -> dict:
    failed = sum(1 for record in records if record["overall_result"] == "failed")
    completed = len(records)
    return {
        "completed": completed,
        "passed": completed - failed,
        "failed": failed,
        "pass_rate": round((completed - failed) * 100 / completed) if completed else None,
    }


@router.get("/report")
def get_pm_report(
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    group_by: str = "week",
    project: str | None = None,
    test_area: str | None = None,
    pm_type: str | None = None,
    result: str = "all",
    q: str | None = None,
    tz: str | None = None,
    db: Session = Depends(get_db),
):
    """
    PMs completed / passed / failed inside [date_from, date_to), grouped by local day, week or month,
    plus the PMs that were overdue at the end of each period (currently paused fixtures excluded).
    """
    now = datetime.now(timezone.utc)
    group_by = (group_by or "week").strip().lower()
    if group_by not in GROUPS:
        raise HTTPException(status_code=400, detail=f"group_by must be one of {', '.join(GROUPS)}")
    result = (result or "all").strip().lower()
    if result not in RESULTS:
        raise HTTPException(status_code=400, detail=f"result must be one of {', '.join(RESULTS)}")
    pm_type = (pm_type or "").strip().lower() or None
    if pm_type and pm_type not in PM_TYPE_LABELS:
        raise HTTPException(status_code=400, detail=f"Unknown PM type '{pm_type}'")
    range_end = _as_utc(date_to) if date_to else now
    range_start = _as_utc(date_from) if date_from else range_end - timedelta(days=DEFAULT_RANGE_DAYS)
    if range_start >= range_end:
        raise HTTPException(status_code=400, detail="'From' must be before 'To'")

    periods = build_periods(range_start, range_end, group_by, _zone(tz))

    # ----- PMs completed in range -----
    record_model = models.FixturePMRecord
    query = (
        db.query(
            record_model,
            models.Employee.employee_name,
            models.Fixture.fixture_name,
            models.Fixture.production_line,
        )
        .outerjoin(models.Fixture, record_model.fixture_id == models.Fixture.fixture_id)
        .outerjoin(models.Employee, record_model.performed_by_employee_id == models.Employee.employee_id)
        .filter(
            _active_records(),
            record_model.performed_at >= range_start,
            record_model.performed_at < range_end,
        )
    )
    if project:
        query = query.filter(record_model.project_name == project)
    if test_area:
        query = query.filter(record_model.test_area == test_area)
    if pm_type:
        query = query.filter(record_model.pm_type == pm_type)
    if result != "all":
        query = query.filter(record_model.overall_result == result)
    record_search = _search_filter(q, models.Employee.employee_name)
    if record_search is not None:
        query = query.filter(record_search)

    stats = [
        {
            "performed_at": _as_utc(performed_at),
            "overall_result": overall_result,
            "pm_type": kind,
            "fixture_id": fixture_id,
        }
        for performed_at, overall_result, kind, fixture_id in query.with_entities(
            record_model.performed_at, record_model.overall_result, record_model.pm_type, record_model.fixture_id
        ).all()
    ]
    records = [
        {
            "pm_id": record.pm_id,
            "fixture_id": record.fixture_id,
            "fixture_name": fixture_name,
            "project_name": record.project_name,
            "test_area": record.test_area,
            "production_line": line,
            "pm_type": record.pm_type,
            "label": PM_TYPE_LABELS.get(record.pm_type, record.pm_type),
            "overall_result": record.overall_result,
            "performed_at": _as_utc(record.performed_at),
            "performed_by": employee_name,
            "failed_tasks": _failed_tasks(record),
            "notes": record.notes,
        }
        for record, employee_name, fixture_name, line in query.order_by(record_model.performed_at.desc())
        .limit(RECORD_LIMIT)
        .all()
    ]

    # ----- PM pairs that can be overdue -----
    fixture_query = db.query(models.Fixture).filter(_pm_test_area_filter(), models.Fixture.pm_paused.is_(False))
    if project:
        fixture_query = fixture_query.filter(models.Fixture.project_name == project)
    if test_area:
        fixture_query = fixture_query.filter(models.Fixture.test_area == test_area)
    fixture_search = _search_filter(q)
    if fixture_search is not None:
        fixture_query = fixture_query.filter(fixture_search)
    fixtures = fixture_query.all()
    tracking_start = _pm_tracking_start(db)

    pairs = []
    for fixture in fixtures:
        baseline = None
        if tracking_start is not None:
            starts = [tracking_start, _as_utc(fixture.created_at), _as_utc(fixture.pm_resumed_at)]
            baseline = max(s for s in starts if s is not None)
        for kind in get_pm_types(fixture.test_area):
            if not pm_type or kind == pm_type:
                pairs.append((fixture, kind, baseline))

    record_times: dict[tuple, list[datetime]] = {}
    fixture_ids = [f.fixture_id for f in fixtures]
    if fixture_ids:
        for fixture_id, kind, performed_at in (
            db.query(record_model.fixture_id, record_model.pm_type, record_model.performed_at)
            .filter(
                record_model.fixture_id.in_(fixture_ids),
                record_model.performed_at < range_end,
                _active_records(),
            )
            .all()
        ):
            record_times.setdefault((fixture_id, kind), []).append(_as_utc(performed_at))
        for times in record_times.values():
            times.sort()

    # ----- per period -----
    stats.sort(key=lambda r: r["performed_at"])
    stat_times = [r["performed_at"] for r in stats]
    period_rows = []
    for period in periods:
        in_period = stats[
            bisect.bisect_left(stat_times, period["start"]) : bisect.bisect_left(stat_times, period["end"])
        ]
        checked_at = min(period["end"], now)
        overdue = len(overdue_at(pairs, record_times, checked_at)) if period["start"] <= now else None
        period_rows.append({**period, **_counts(in_period), "overdue": overdue, "overdue_checked_at": checked_at})

    # ----- overdue at the end of the range -----
    overdue_checked_at = min(range_end, now)
    overdue_rows = sorted(
        (
            {
                "fixture_id": fixture.fixture_id,
                "fixture_name": fixture.fixture_name,
                "project_name": fixture.project_name,
                "test_area": fixture.test_area,
                "production_line": fixture.production_line,
                "pm_type": kind,
                "label": PM_TYPE_LABELS[kind],
                "due_at": due,
                "last_performed_at": last,
                "days_overdue": (overdue_checked_at - due).days,
            }
            for fixture, kind, due, last in overdue_at(pairs, record_times, overdue_checked_at)
        ),
        key=lambda row: row["due_at"],
    )

    by_pm_type = []
    for kind in sorted({r["pm_type"] for r in stats} | {row["pm_type"] for row in overdue_rows}):
        by_pm_type.append(
            {
                "pm_type": kind,
                "label": PM_TYPE_LABELS.get(kind, kind),
                **_counts([r for r in stats if r["pm_type"] == kind]),
                "overdue": sum(1 for row in overdue_rows if row["pm_type"] == kind),
            }
        )

    return {
        "range": {"date_from": range_start, "date_to": range_end},
        "group_by": group_by,
        "totals": {
            **_counts(stats),
            "fixtures_serviced": len({r["fixture_id"] for r in stats}),
            "overdue": len(overdue_rows),
            "overdue_fixtures": len({row["fixture_id"] for row in overdue_rows}),
            "tracked_pms": len(pairs),
        },
        "overdue_checked_at": overdue_checked_at,
        "periods": period_rows,
        "by_pm_type": by_pm_type,
        "records": records,
        "records_total": len(stats),
        "records_truncated": len(stats) > RECORD_LIMIT,
        "overdue": overdue_rows,
        "options": _filter_options(db),
        "tracking_start": tracking_start,
    }

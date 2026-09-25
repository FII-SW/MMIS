# backend/app/routes/pm_dashboard.py
"""Filterable PM dashboard: current status (as of now) + activity inside a date/time range."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..utils.pm_checklists import PM_TYPE_LABELS, PM_TYPES, configured_pm_types
from .maintenance import (
    STATE_RANK,
    _active_records,
    _as_utc,
    _empty_counts,
    _fixture_pm,
    _latest_pm_records,
    _pm_test_area_filter,
    _pm_tracking_start,
    _serialize_fixture,
    _serialize_record,
)

router = APIRouter(prefix="/maintenance", tags=["Maintenance dashboard"])

ATTENTION_LIMIT = 15
RECENT_LIMIT = 10
CHART_POINT_LIMIT = 20000
DEFAULT_RANGE_DAYS = 7


def _search_filter(q: str | None, *extra_columns):
    if not q or not q.strip():
        return None
    pattern = f"%{q.strip()}%"
    columns = [
        models.Fixture.fixture_name,
        models.Fixture.asset_tag,
        models.Fixture.fixture_serial_number,
        models.Fixture.production_line,
        models.Fixture.manufacturer,
        *extra_columns,
    ]
    return or_(*[column.ilike(pattern) for column in columns])


def _filter_options(db: Session) -> dict:
    rows = (
        db.query(models.Fixture.project_name, models.Fixture.test_area)
        .filter(_pm_test_area_filter())
        .distinct()
        .all()
    )
    test_areas: dict[str, set] = {}
    for project, area in rows:
        if project:
            test_areas.setdefault(project, set()).add(area)
    configured = configured_pm_types()
    return {
        "projects": sorted(test_areas),
        "test_areas": {project: sorted(a for a in areas if a) for project, areas in test_areas.items()},
        "pm_types": [
            {"value": pm_type, "label": PM_TYPE_LABELS[pm_type], "configured": pm_type in configured}
            for pm_type in PM_TYPES
        ],
    }


def summarize_status(items: list[tuple], pm_type: str | None) -> dict:
    """
    items: [(fixture, pm)] from _fixture_pm. With a pm_type filter, only that PM type counts
    and fixtures without it are skipped.
    """
    totals = {**_empty_counts(), "fixtures": 0}
    by_pm_type: dict[str, dict] = {}
    locations: dict[tuple, dict] = {}
    attention = []
    for fixture, pm in items:
        entries = {
            kind: entry for kind, entry in pm["status"].items() if not pm_type or kind == pm_type
        }
        if not entries:
            continue
        state = min((e["state"] for e in entries.values()), key=lambda s: STATE_RANK[s])

        totals["fixtures"] += 1
        totals[state] += 1
        location = locations.setdefault(
            (fixture.project_name, fixture.test_area),
            {
                "project_name": fixture.project_name,
                "test_area": fixture.test_area,
                "fixtures": 0,
                **_empty_counts(),
            },
        )
        location["fixtures"] += 1
        location[state] += 1

        for kind, entry in entries.items():
            type_counts = by_pm_type.setdefault(
                kind, {"label": entry["label"], "fixtures": 0, "completed": 0, "failed": 0, **_empty_counts()}
            )
            type_counts["fixtures"] += 1
            type_counts[entry["state"]] += 1
            if entry["state"] in ("overdue", "due_soon"):
                attention.append({**_serialize_fixture(fixture), "pm_type": kind, "entry": entry})

    attention.sort(key=lambda item: item["entry"]["days_until_due"])
    return {
        "totals": totals,
        "by_pm_type": by_pm_type,
        "locations": sorted(
            locations.values(), key=lambda loc: (loc["project_name"] or "", loc["test_area"] or "")
        ),
        "attention_total": len(attention),
        "attention": attention[:ATTENTION_LIMIT],
    }


@router.get("/dashboard")
def get_pm_dashboard(
    project: str | None = None,
    test_area: str | None = None,
    pm_type: str | None = None,
    q: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    pm_type = (pm_type or "").strip().lower() or None
    if pm_type and pm_type not in PM_TYPE_LABELS:
        raise HTTPException(status_code=400, detail=f"Unknown PM type '{pm_type}'")
    range_end = _as_utc(date_to) if date_to else now
    range_start = _as_utc(date_from) if date_from else range_end - timedelta(days=DEFAULT_RANGE_DAYS)
    if range_start >= range_end:
        raise HTTPException(status_code=400, detail="'From' must be before 'To'")

    # ----- current status -----
    fixture_query = db.query(models.Fixture).filter(_pm_test_area_filter())
    if project:
        fixture_query = fixture_query.filter(models.Fixture.project_name == project)
    if test_area:
        fixture_query = fixture_query.filter(models.Fixture.test_area == test_area)
    search = _search_filter(q)
    if search is not None:
        fixture_query = fixture_query.filter(search)
    fixtures = fixture_query.all()
    tracking_start = _pm_tracking_start(db)
    latest_map = _latest_pm_records(db, [f.fixture_id for f in fixtures])
    items = []
    for fixture in fixtures:
        pm = _fixture_pm(fixture, latest_map, now, tracking_start)
        if pm["state"]:
            items.append((fixture, pm))
    status = summarize_status(items, pm_type)

    # ----- activity in range -----
    record_model = models.FixturePMRecord
    records = (
        db.query(record_model)
        .outerjoin(models.Fixture, record_model.fixture_id == models.Fixture.fixture_id)
        .outerjoin(models.Employee, record_model.performed_by_employee_id == models.Employee.employee_id)
        .filter(
            _active_records(),
            record_model.performed_at >= range_start,
            record_model.performed_at < range_end,
        )
    )
    if project:
        records = records.filter(record_model.project_name == project)
    if test_area:
        records = records.filter(record_model.test_area == test_area)
    if pm_type:
        records = records.filter(record_model.pm_type == pm_type)
    record_search = _search_filter(q, models.Employee.employee_name)
    if record_search is not None:
        records = records.filter(record_search)

    completed = records.count()
    failed = records.filter(record_model.overall_result == "failed").count()
    fixtures_serviced, technicians = records.with_entities(
        func.count(func.distinct(record_model.fixture_id)),
        func.count(func.distinct(record_model.performed_by_employee_id)),
    ).one()

    chart_points = [
        {"performed_at": performed_at, "failed": result == "failed"}
        for performed_at, result in records.with_entities(record_model.performed_at, record_model.overall_result)
        .order_by(record_model.performed_at)
        .limit(CHART_POINT_LIMIT)
        .all()
    ]

    for kind, count, failed_count in (
        records.with_entities(
            record_model.pm_type,
            func.count(record_model.pm_id),
            func.count(record_model.pm_id).filter(record_model.overall_result == "failed"),
        )
        .group_by(record_model.pm_type)
        .all()
    ):
        type_counts = status["by_pm_type"].setdefault(
            kind,
            {"label": PM_TYPE_LABELS.get(kind, kind), "fixtures": 0, "completed": 0, "failed": 0, **_empty_counts()},
        )
        type_counts["completed"] = count
        type_counts["failed"] = failed_count

    top_technicians = [
        {"name": name or "Unknown", "count": count}
        for name, count in records.with_entities(models.Employee.employee_name, func.count(record_model.pm_id))
        .group_by(record_model.performed_by_employee_id, models.Employee.employee_name)
        .order_by(func.count(record_model.pm_id).desc())
        .limit(5)
        .all()
    ]

    recent = [
        {**_serialize_record(record, employee_name), "fixture_name": fixture_name, "production_line": line}
        for record, employee_name, fixture_name, line in records.with_entities(
            record_model, models.Employee.employee_name, models.Fixture.fixture_name, models.Fixture.production_line
        )
        .order_by(record_model.performed_at.desc())
        .limit(RECENT_LIMIT)
        .all()
    ]

    pm_ids = records.with_entities(record_model.pm_id).subquery()
    parts_used = (
        db.query(func.coalesce(func.sum(models.Transaction.quantity_used), 0))
        .filter(models.Transaction.pm_id.in_(select(pm_ids.c.pm_id)))
        .scalar()
        or 0
    )

    # ----- issues -----
    issue_model = models.PMIssue
    issues = db.query(issue_model).join(models.Fixture, issue_model.fixture_id == models.Fixture.fixture_id)
    if project:
        issues = issues.filter(models.Fixture.project_name == project)
    if test_area:
        issues = issues.filter(models.Fixture.test_area == test_area)
    if pm_type:
        issues = issues.filter(issue_model.pm_type == pm_type)
    if search is not None:
        issues = issues.filter(search)
    open_issues = issues.filter(issue_model.status == "open").count()
    issues_opened = issues.filter(
        issue_model.created_at >= range_start, issue_model.created_at < range_end
    ).count()
    issues_resolved = issues.filter(
        issue_model.status == "resolved",
        issue_model.resolved_at >= range_start,
        issue_model.resolved_at < range_end,
    ).count()

    return {
        "range": {"date_from": range_start, "date_to": range_end},
        "status": status,
        "activity": {
            "completed": completed,
            "passed": completed - failed,
            "failed": failed,
            "fixtures_serviced": fixtures_serviced or 0,
            "technicians": technicians or 0,
            "parts_used": int(parts_used),
            "issues_opened": issues_opened,
            "issues_resolved": issues_resolved,
            "chart_points": chart_points,
            "chart_truncated": completed > CHART_POINT_LIMIT,
            "top_technicians": top_technicians,
            "recent": recent,
        },
        "open_issues": open_issues,
        "options": _filter_options(db),
        "tracking_start": tracking_start,
    }

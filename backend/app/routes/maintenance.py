# backend/app/routes/maintenance.py
import json
import math
import os
import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..utils.auth_deps import employee_id_from_token, get_current_user
from ..utils.pm_checklists import (
    PM_COVERS,
    PM_DUE_SOON_DAYS,
    PM_DUPLICATE_WINDOW_HOURS,
    PM_INTERVAL_DAYS,
    PM_TEST_AREA_PREFIXES,
    PM_TYPE_LABELS,
    RESULT_VALUES,
    get_checklist,
    get_pm_types,
)

router = APIRouter(prefix="/maintenance", tags=["Maintenance"])

# Lower rank = more urgent; a fixture's overall state is its most urgent PM type.
# "never" = no PM recorded yet and the first one is not due yet.
# "paused" = fixture out of service; never counted as overdue.
STATE_RANK = {"overdue": 0, "due_soon": 1, "never": 2, "ok": 3, "paused": 4}
MAX_PARTS_PER_PM = 20


class ChecklistResult(BaseModel):
    item_id: str
    result: str


class PartUsage(BaseModel):
    item_id: int
    quantity: int


class PMRecordCreate(BaseModel):
    pm_type: str
    results: list[ChecklistResult]
    notes: str | None = None
    parts_replaced: str | None = None
    parts: list[PartUsage] = []
    indysoft_recorded: bool = False
    confirm_duplicate: bool = False


def _get_fixture_or_404(db: Session, fixture_id: int) -> models.Fixture:
    fixture = db.query(models.Fixture).filter(models.Fixture.fixture_id == fixture_id).first()
    if not fixture:
        raise HTTPException(status_code=404, detail="Fixture not found")
    return fixture


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _empty_counts() -> dict:
    return {state: 0 for state in STATE_RANK}


def _serialize_fixture(fixture: models.Fixture) -> dict:
    return {
        "fixture_id": fixture.fixture_id,
        "fixture_name": fixture.fixture_name,
        "project_name": fixture.project_name,
        "test_area": fixture.test_area,
        "asset_tag": fixture.asset_tag,
        "fixture_serial_number": fixture.fixture_serial_number,
        "manufacturer": fixture.manufacturer,
        "production_line": fixture.production_line,
        "pm_paused": bool(getattr(fixture, "pm_paused", False)),
        "pm_pause_reason": getattr(fixture, "pm_pause_reason", None),
        "pm_paused_at": getattr(fixture, "pm_paused_at", None),
    }


def _active_records():
    """Filter for PM records that count (not voided)."""
    return models.FixturePMRecord.voided.is_(False)


def _serialize_record(record: models.FixturePMRecord, employee_name: str | None) -> dict:
    try:
        checklist = json.loads(record.checklist_results or "[]")
    except ValueError:
        checklist = []
    return {
        "pm_id": record.pm_id,
        "fixture_id": record.fixture_id,
        "pm_type": record.pm_type,
        "overall_result": record.overall_result,
        "checklist": checklist,
        "notes": record.notes,
        "parts_replaced": record.parts_replaced,
        "indysoft_recorded": bool(record.indysoft_recorded),
        "project_name": record.project_name,
        "test_area": record.test_area,
        "performed_by_employee_id": record.performed_by_employee_id,
        "performed_by": employee_name,
        "performed_at": record.performed_at,
        "voided": bool(record.voided),
        "voided_at": record.voided_at,
        "void_reason": record.void_reason,
        "edited_at": record.edited_at,
    }


def _parts_by_pm(db: Session, pm_ids: list[int]) -> dict[int, list[dict]]:
    """Inventory parts taken from stock while recording each PM."""
    if not pm_ids:
        return {}
    rows = (
        db.query(
            models.Transaction.pm_id,
            models.Transaction.transaction_id,
            models.Transaction.quantity_used,
            models.Inventory.item_id,
            models.Inventory.item_name,
            models.Inventory.item_part_number,
        )
        .outerjoin(models.Inventory, models.Transaction.item_id == models.Inventory.item_id)
        .filter(models.Transaction.pm_id.in_(pm_ids))
        .all()
    )
    parts: dict[int, list[dict]] = {}
    for row in rows:
        parts.setdefault(row.pm_id, []).append(
            {
                "transaction_id": row.transaction_id,
                "item_id": row.item_id,
                "item_name": row.item_name,
                "item_part_number": row.item_part_number,
                "quantity": row.quantity_used,
            }
        )
    return parts


def _latest_pm_records(db: Session, fixture_ids: list[int]) -> dict:
    """Map (fixture_id, pm_type) -> (latest record, technician name)."""
    if not fixture_ids:
        return {}

    record_model = models.FixturePMRecord
    latest = (
        db.query(
            record_model.fixture_id,
            record_model.pm_type,
            func.max(record_model.performed_at).label("last_at"),
        )
        .filter(record_model.fixture_id.in_(fixture_ids), _active_records())
        .group_by(record_model.fixture_id, record_model.pm_type)
        .subquery()
    )
    rows = (
        db.query(record_model, models.Employee.employee_name)
        .join(
            latest,
            and_(
                record_model.fixture_id == latest.c.fixture_id,
                record_model.pm_type == latest.c.pm_type,
                record_model.performed_at == latest.c.last_at,
            ),
        )
        .outerjoin(
            models.Employee,
            record_model.performed_by_employee_id == models.Employee.employee_id,
        )
        .filter(_active_records())
        .all()
    )
    return {(record.fixture_id, record.pm_type): (record, name) for record, name in rows}


def _pm_tracking_start(db: Session) -> datetime | None:
    """When PM tracking went live: MMIS_PM_START_DATE (YYYY-MM-DD), else the first PM ever recorded.

    Fixtures with no PM yet get their first due date counted from this moment, so an
    unreported PM becomes overdue instead of staying "never done" forever.
    """
    raw = os.getenv("MMIS_PM_START_DATE", "").strip()
    if raw:
        try:
            return _as_utc(datetime.fromisoformat(raw))
        except ValueError:
            pass
    return _as_utc(
        db.query(func.min(models.FixturePMRecord.performed_at)).filter(_active_records()).scalar()
    )


def _due_state(pm_type: str, next_due: datetime, now: datetime) -> tuple[str, int]:
    seconds_left = (next_due - now).total_seconds()
    if seconds_left < 0:
        state = "overdue"
    elif seconds_left <= PM_DUE_SOON_DAYS[pm_type] * 86400:
        state = "due_soon"
    else:
        state = "ok"
    return state, math.floor(seconds_left / 86400)


def _pm_entry(
    pm_type: str,
    latest: tuple | None,
    now: datetime,
    baseline: datetime | None = None,
) -> dict:
    """PM status for one type. `baseline` starts the clock when no PM has been recorded yet."""
    entry = {
        "label": PM_TYPE_LABELS[pm_type],
        "interval_days": PM_INTERVAL_DAYS[pm_type],
        "last_performed_at": None,
        "last_performed_by": None,
        "last_result": None,
        "covered_by": None,
        "next_due_at": None,
        "days_until_due": None,
        "state": "never",
    }
    interval = timedelta(days=PM_INTERVAL_DAYS[pm_type])
    record, name = latest if latest else (None, None)
    last = _as_utc(record.performed_at) if record is not None else None

    if last is None:
        if baseline is None:
            return entry
        next_due = baseline + interval
        state, days = _due_state(pm_type, next_due, now)
        entry.update(
            {
                "next_due_at": next_due,
                "days_until_due": days,
                "state": "never" if state == "ok" else state,
            }
        )
        return entry

    next_due = last + interval
    if baseline is not None:
        # e.g. fixture back in service after a pause: full interval from the resume date
        next_due = max(next_due, baseline + interval)
    state, days = _due_state(pm_type, next_due, now)
    record_type = getattr(record, "pm_type", pm_type)
    entry.update(
        {
            "last_performed_at": last,
            "last_performed_by": name,
            "last_result": record.overall_result,
            "covered_by": record_type if record_type != pm_type else None,
            "next_due_at": next_due,
            "days_until_due": days,
            "state": state,
        }
    )
    return entry


def _latest_covering(fixture_id: int, pm_type: str, latest_map: dict) -> tuple | None:
    """Most recent record of this PM type, or of a larger PM type that includes it."""
    candidates = [latest_map.get((fixture_id, pm_type))]
    candidates += [
        latest_map.get((fixture_id, other))
        for other, covered in PM_COVERS.items()
        if pm_type in covered
    ]
    candidates = [c for c in candidates if c and _as_utc(c[0].performed_at)]
    return max(candidates, key=lambda c: _as_utc(c[0].performed_at), default=None)


def _fixture_pm(
    fixture: models.Fixture,
    latest_map: dict,
    now: datetime,
    tracking_start: datetime | None = None,
) -> dict:
    pm_types = get_pm_types(fixture.test_area)
    baseline = None
    if tracking_start is not None:
        starts = [
            tracking_start,
            _as_utc(getattr(fixture, "created_at", None)),
            _as_utc(getattr(fixture, "pm_resumed_at", None)),
        ]
        baseline = max(s for s in starts if s is not None)
    status = {
        pm_type: _pm_entry(
            pm_type,
            _latest_covering(fixture.fixture_id, pm_type, latest_map),
            now,
            baseline,
        )
        for pm_type in pm_types
    }
    if pm_types and getattr(fixture, "pm_paused", False):
        for entry in status.values():
            entry["state"] = "paused"
        return {
            "pm_types": pm_types,
            "status": status,
            "state": "paused",
            "days_until_due": None,
        }
    worst = min(status.values(), key=lambda e: STATE_RANK[e["state"]], default=None)
    due_days = [e["days_until_due"] for e in status.values() if e["days_until_due"] is not None]
    return {
        "pm_types": pm_types,
        "status": status,
        "state": worst["state"] if worst else None,
        "days_until_due": min(due_days) if due_days else None,
    }


@router.get("/checklists/{pm_type}")
def get_pm_checklist(pm_type: str, test_area: str | None = None):
    checklist = get_checklist(pm_type, test_area)
    if not checklist:
        raise HTTPException(
            status_code=404,
            detail=f"No {pm_type} PM checklist is configured for test area '{test_area or ''}'",
        )
    return checklist


def _pm_test_area_filter():
    return or_(
        *[func.upper(models.Fixture.test_area).like(f"{prefix}%") for prefix in PM_TEST_AREA_PREFIXES]
    )


@router.get("/overview")
def get_pm_overview(
    project: str | None = None,
    test_area: str | None = None,
    pm_only: bool = False,
    db: Session = Depends(get_db),
):
    """Fixtures for a location (or all PM fixtures) with PM status per fixture and summary counts."""
    query = db.query(models.Fixture)
    if project:
        query = query.filter(models.Fixture.project_name == project)
    if test_area:
        query = query.filter(models.Fixture.test_area == test_area)
    if pm_only:
        query = query.filter(_pm_test_area_filter())
    fixtures = query.order_by(models.Fixture.fixture_name).all()

    now = datetime.now(timezone.utc)
    tracking_start = _pm_tracking_start(db)
    latest_map = _latest_pm_records(
        db, [f.fixture_id for f in fixtures if get_pm_types(f.test_area)]
    )

    summary = _empty_counts()
    items = []
    for fixture in fixtures:
        pm = _fixture_pm(fixture, latest_map, now, tracking_start)
        if pm["state"]:
            summary[pm["state"]] += 1
        items.append({**_serialize_fixture(fixture), "pm": pm})

    summary["total"] = len(fixtures)
    summary["pm_applicable"] = sum(1 for item in items if item["pm"]["state"])
    return {
        "summary": summary,
        "fixtures": items,
        "tracking_start": tracking_start,
    }


def _all_pm_fixtures(db: Session, now: datetime) -> tuple[list[tuple], datetime | None]:
    """[(fixture, pm)] for every fixture in a PM test area, plus the tracking start."""
    fixtures = db.query(models.Fixture).filter(_pm_test_area_filter()).all()
    tracking_start = _pm_tracking_start(db)
    latest_map = _latest_pm_records(db, [f.fixture_id for f in fixtures])
    items = []
    for fixture in fixtures:
        pm = _fixture_pm(fixture, latest_map, now, tracking_start)
        if pm["state"]:
            items.append((fixture, pm))
    return items, tracking_start


@router.get("/reminders")
def get_pm_reminders(db: Session = Depends(get_db)):
    """Overdue / due-soon PM counts (per fixture + PM type) for header and dashboard reminders."""
    now = datetime.now(timezone.utc)
    items, tracking_start = _all_pm_fixtures(db, now)

    by_pm_type = {
        pm_type: {"label": label, "overdue": 0, "due_soon": 0}
        for pm_type, label in PM_TYPE_LABELS.items()
    }
    overdue_fixtures = 0
    for _, pm in items:
        if pm["state"] == "overdue":
            overdue_fixtures += 1
        for pm_type, entry in pm["status"].items():
            if entry["state"] in ("overdue", "due_soon"):
                by_pm_type[pm_type][entry["state"]] += 1

    by_pm_type = {k: v for k, v in by_pm_type.items() if v["overdue"] or v["due_soon"]}
    return {
        "overdue": sum(v["overdue"] for v in by_pm_type.values()),
        "due_soon": sum(v["due_soon"] for v in by_pm_type.values()),
        "overdue_fixtures": overdue_fixtures,
        "by_pm_type": by_pm_type,
        "tracking_start": tracking_start,
    }


@router.get("/summary")
def get_pm_summary(db: Session = Depends(get_db)):
    """PM compliance across all PM-applicable fixtures, grouped by project and test area."""
    now = datetime.now(timezone.utc)
    items, tracking_start = _all_pm_fixtures(db, now)

    totals = {**_empty_counts(), "fixtures": 0}
    by_pm_type: dict[str, dict] = {}
    locations: dict[tuple, dict] = {}
    attention = []
    for fixture, pm in items:
        for pm_type, entry in pm["status"].items():
            type_counts = by_pm_type.setdefault(
                pm_type, {"label": entry["label"], "fixtures": 0, **_empty_counts()}
            )
            type_counts["fixtures"] += 1
            type_counts[entry["state"]] += 1

        key = (fixture.project_name, fixture.test_area)
        location = locations.setdefault(
            key,
            {
                "project_name": fixture.project_name,
                "test_area": fixture.test_area,
                "fixtures": 0,
                **_empty_counts(),
            },
        )
        location["fixtures"] += 1
        location[pm["state"]] += 1
        totals["fixtures"] += 1
        totals[pm["state"]] += 1

        if pm["state"] in ("overdue", "due_soon"):
            attention.append({**_serialize_fixture(fixture), "pm": pm})

    attention.sort(key=lambda item: item["pm"]["days_until_due"])

    record_model = models.FixturePMRecord
    week_ago = now - timedelta(days=7)
    recent_query = db.query(func.count(record_model.pm_id)).filter(
        record_model.performed_at >= week_ago, _active_records()
    )
    completed_last_7_days = recent_query.scalar() or 0
    failed_last_7_days = recent_query.filter(record_model.overall_result == "failed").scalar() or 0

    # Raw timestamps so the browser can bucket them by its own local day.
    completed_14_days = [
        {"performed_at": performed_at, "failed": overall_result == "failed"}
        for performed_at, overall_result in db.query(record_model.performed_at, record_model.overall_result)
        .filter(record_model.performed_at >= now - timedelta(days=14), _active_records())
        .all()
    ]

    open_issues = (
        db.query(func.count(models.PMIssue.issue_id)).filter(models.PMIssue.status == "open").scalar() or 0
    )

    top_technicians = [
        {"name": name or "Unknown", "count": count}
        for name, count in db.query(models.Employee.employee_name, func.count(record_model.pm_id))
        .select_from(record_model)
        .outerjoin(models.Employee, record_model.performed_by_employee_id == models.Employee.employee_id)
        .filter(record_model.performed_at >= week_ago, _active_records())
        .group_by(record_model.performed_by_employee_id, models.Employee.employee_name)
        .order_by(func.count(record_model.pm_id).desc())
        .limit(5)
        .all()
    ]

    return {
        "totals": totals,
        "by_pm_type": by_pm_type,
        "completed_last_7_days": completed_last_7_days,
        "failed_last_7_days": failed_last_7_days,
        "completed_14_days": completed_14_days,
        "top_technicians_7_days": top_technicians,
        "locations": sorted(
            locations.values(), key=lambda loc: (loc["project_name"] or "", loc["test_area"] or "")
        ),
        "attention": attention[:10],
        "open_issues": open_issues,
        "tracking_start": tracking_start,
    }


@router.get("/recent")
def get_recent_pm_records(
    limit: int = Query(10, ge=1, le=50),
    project: str | None = None,
    db: Session = Depends(get_db),
):
    query = (
        db.query(models.FixturePMRecord, models.Employee.employee_name, models.Fixture.fixture_name)
        .outerjoin(
            models.Employee,
            models.FixturePMRecord.performed_by_employee_id == models.Employee.employee_id,
        )
        .outerjoin(models.Fixture, models.FixturePMRecord.fixture_id == models.Fixture.fixture_id)
        .filter(_active_records())
    )
    if project:
        query = query.filter(models.FixturePMRecord.project_name == project)

    rows = query.order_by(models.FixturePMRecord.performed_at.desc()).limit(limit).all()
    return [
        {**_serialize_record(record, employee_name), "fixture_name": fixture_name}
        for record, employee_name, fixture_name in rows
    ]


@router.get("/records")
def list_all_pm_records(
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    pm_type: str | None = None,
    project: str | None = None,
    test_area: str | None = None,
    result: str | None = None,
    q: str | None = None,
    employee_id: int | None = None,
    include_voided: bool = False,
    limit: int = Query(25, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Completed PM log across all fixtures (newest first) with filters and paging."""
    record_model = models.FixturePMRecord
    query = (
        db.query(
            record_model,
            models.Employee.employee_name,
            models.Fixture.fixture_name,
            models.Fixture.production_line,
        )
        .outerjoin(models.Employee, record_model.performed_by_employee_id == models.Employee.employee_id)
        .outerjoin(models.Fixture, record_model.fixture_id == models.Fixture.fixture_id)
    )
    if not include_voided:
        query = query.filter(_active_records())
    if employee_id:
        query = query.filter(record_model.performed_by_employee_id == employee_id)
    if date_from:
        query = query.filter(record_model.performed_at >= _as_utc(date_from))
    if date_to:
        query = query.filter(record_model.performed_at < _as_utc(date_to))
    if pm_type:
        query = query.filter(record_model.pm_type == pm_type.strip().lower())
    if project:
        query = query.filter(record_model.project_name == project)
    if test_area:
        query = query.filter(record_model.test_area == test_area)
    if result:
        query = query.filter(record_model.overall_result == result.strip().lower())
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(
                models.Fixture.fixture_name.ilike(pattern),
                models.Employee.employee_name.ilike(pattern),
                models.Fixture.production_line.ilike(pattern),
            )
        )

    total = query.count()
    failed = query.filter(record_model.overall_result == "failed").count()
    rows = query.order_by(record_model.performed_at.desc()).offset(offset).limit(limit).all()
    return {
        "total": total,
        "failed": failed,
        "records": [
            {
                **_serialize_record(record, employee_name),
                "fixture_name": fixture_name,
                "production_line": production_line,
            }
            for record, employee_name, fixture_name, production_line in rows
        ],
    }


@router.get("/fixtures/{fixture_id}/pm-records")
def list_pm_records(fixture_id: int, pm_type: str | None = None, db: Session = Depends(get_db)):
    _get_fixture_or_404(db, fixture_id)

    query = (
        db.query(models.FixturePMRecord, models.Employee.employee_name)
        .outerjoin(
            models.Employee,
            models.FixturePMRecord.performed_by_employee_id == models.Employee.employee_id,
        )
        .filter(models.FixturePMRecord.fixture_id == fixture_id)
    )
    if pm_type:
        query = query.filter(models.FixturePMRecord.pm_type == pm_type.strip().lower())

    rows = query.order_by(models.FixturePMRecord.performed_at.desc()).all()
    parts = _parts_by_pm(db, [record.pm_id for record, _ in rows])
    return [
        {**_serialize_record(record, name), "parts": parts.get(record.pm_id, [])}
        for record, name in rows
    ]


@router.get("/fixtures/{fixture_id}/pm-status")
def get_pm_status(fixture_id: int, db: Session = Depends(get_db)):
    fixture = _get_fixture_or_404(db, fixture_id)
    now = datetime.now(timezone.utc)
    pm = _fixture_pm(fixture, _latest_pm_records(db, [fixture_id]), now, _pm_tracking_start(db))
    paused_by = None
    if fixture.pm_paused and fixture.pm_paused_by_employee_id:
        paused_by = (
            db.query(models.Employee.employee_name)
            .filter(models.Employee.employee_id == fixture.pm_paused_by_employee_id)
            .scalar()
        )
    return {
        "fixture_id": fixture_id,
        "applicable": bool(pm["pm_types"]),
        "paused": bool(fixture.pm_paused),
        "pause_reason": fixture.pm_pause_reason,
        "paused_at": fixture.pm_paused_at,
        "paused_by": paused_by,
        **pm,
    }


@router.post("/fixtures/{fixture_id}/pm-records", status_code=201)
def create_pm_record(
    fixture_id: int,
    payload: PMRecordCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    user = get_current_user(request)
    employee_id = employee_id_from_token(user)
    fixture = _get_fixture_or_404(db, fixture_id)

    pm_type = payload.pm_type.strip().lower()
    label = PM_TYPE_LABELS.get(pm_type, pm_type)
    checklist = get_checklist(pm_type, fixture.test_area)
    if not checklist:
        raise HTTPException(
            status_code=400,
            detail=f"{label} is not configured for test area '{fixture.test_area}'",
        )

    expected_ids = {item["id"] for item in checklist["items"]}
    submitted = {}
    for entry in payload.results:
        if entry.item_id not in expected_ids:
            raise HTTPException(status_code=400, detail=f"Unknown checklist item '{entry.item_id}'")
        result = entry.result.strip().lower()
        if result not in RESULT_VALUES:
            raise HTTPException(status_code=400, detail=f"Invalid result '{entry.result}'")
        submitted[entry.item_id] = result

    if expected_ids - submitted.keys():
        raise HTTPException(status_code=400, detail="Every checklist item needs a result")

    has_failure = "failed" in submitted.values()
    notes = (payload.notes or "").strip()
    if has_failure and not notes:
        raise HTTPException(status_code=400, detail="Notes are required when any item failed")

    if not payload.confirm_duplicate:
        window_start = datetime.now(timezone.utc) - timedelta(hours=PM_DUPLICATE_WINDOW_HOURS)
        duplicate = (
            db.query(models.FixturePMRecord.pm_id)
            .filter(
                models.FixturePMRecord.fixture_id == fixture_id,
                models.FixturePMRecord.pm_type == pm_type,
                models.FixturePMRecord.performed_at >= window_start,
                _active_records(),
            )
            .first()
        )
        if duplicate:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"{label} was already recorded for this fixture in the last "
                    f"{PM_DUPLICATE_WINDOW_HOURS} hours."
                ),
            )

    performed = [
        {
            "item_id": item["id"],
            "section": item["section"],
            "task": item["task"],
            "result": submitted[item["id"]],
        }
        for item in checklist["items"]
    ]

    part_quantities: dict[int, int] = {}
    for part in payload.parts:
        if part.quantity <= 0:
            raise HTTPException(status_code=400, detail="Part quantity must be greater than 0")
        part_quantities[part.item_id] = part_quantities.get(part.item_id, 0) + part.quantity
    if len(part_quantities) > MAX_PARTS_PER_PM:
        raise HTTPException(status_code=400, detail=f"At most {MAX_PARTS_PER_PM} different parts per PM")

    # Lock stock rows (in id order to avoid deadlocks) and check availability before writing anything.
    items = {}
    for item_id in sorted(part_quantities):
        item = (
            db.query(models.Inventory)
            .filter(models.Inventory.item_id == item_id)
            .with_for_update()
            .first()
        )
        if not item:
            raise HTTPException(status_code=404, detail=f"Inventory item {item_id} not found")
        if (item.item_current_quantity or 0) < part_quantities[item_id]:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Not enough stock for {item.item_name}: available {item.item_current_quantity or 0}, "
                    f"needed {part_quantities[item_id]}. Use the Request page to pull stock from another project."
                ),
            )
        items[item_id] = item

    record = models.FixturePMRecord(
        fixture_id=fixture_id,
        pm_type=pm_type,
        overall_result="failed" if has_failure else "passed",
        checklist_results=json.dumps(performed),
        notes=notes or None,
        parts_replaced=(payload.parts_replaced or "").strip() or None,
        indysoft_recorded=payload.indysoft_recorded,
        project_name=fixture.project_name,
        test_area=fixture.test_area,
        performed_by_employee_id=employee_id,
    )
    db.add(record)
    db.flush()

    for item_id, qty in part_quantities.items():
        item = items[item_id]
        item.item_current_quantity -= qty
        db.add(
            models.Transaction(
                item_id=item_id,
                employee_id=employee_id,
                fixture_id=fixture_id,
                quantity_used=qty,
                transaction_type="request",
                remarks=f"Used in {label} (PM #{record.pm_id})",
                test_area=item.test_area,
                project_name=item.project_name,
                pm_id=record.pm_id,
            )
        )

    _sync_issues(db, record, performed, employee_id, label)

    db.commit()
    db.refresh(record)

    employee = db.query(models.Employee).filter(models.Employee.employee_id == employee_id).first()
    return {
        **_serialize_record(record, employee.employee_name if employee else None),
        "parts": _parts_by_pm(db, [record.pm_id]).get(record.pm_id, []),
    }


def _sync_issues(db: Session, record, performed: list[dict], employee_id: int | None, label: str):
    """Open an issue per failed task; close open issues for tasks that passed this time."""
    passed_ids = [item["item_id"] for item in performed if item["result"] == "passed"]
    if passed_ids:
        now = datetime.now(timezone.utc)
        open_issues = (
            db.query(models.PMIssue)
            .filter(
                models.PMIssue.fixture_id == record.fixture_id,
                models.PMIssue.status == "open",
                models.PMIssue.item_id.in_(passed_ids),
            )
            .all()
        )
        for issue in open_issues:
            issue.status = "resolved"
            issue.resolved_at = now
            issue.resolved_by_employee_id = employee_id
            issue.resolution_note = f"Passed in {label} (PM #{record.pm_id})"

    for item in performed:
        if item["result"] != "failed":
            continue
        already_open = (
            db.query(models.PMIssue.issue_id)
            .filter(
                models.PMIssue.fixture_id == record.fixture_id,
                models.PMIssue.status == "open",
                models.PMIssue.item_id == item["item_id"],
            )
            .first()
        )
        if already_open:
            continue
        db.add(
            models.PMIssue(
                pm_id=record.pm_id,
                fixture_id=record.fixture_id,
                pm_type=record.pm_type,
                item_id=item["item_id"],
                task=item["task"],
                status="open",
            )
        )


@router.get("/pm-records/{pm_id}/pdf")
def download_pm_record_pdf(
    pm_id: int,
    request: Request,
    tz: str | None = Query(None, description="IANA time zone for the printed date, e.g. America/Chicago"),
    db: Session = Depends(get_db),
):
    get_current_user(request)
    row = (
        db.query(models.FixturePMRecord, models.Employee.employee_name)
        .outerjoin(
            models.Employee,
            models.FixturePMRecord.performed_by_employee_id == models.Employee.employee_id,
        )
        .filter(models.FixturePMRecord.pm_id == pm_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="PM record not found")
    record, employee_name = row
    fixture = db.query(models.Fixture).filter(models.Fixture.fixture_id == record.fixture_id).first()

    # Imported lazily so a missing reportlab install only disables PDF export, not the whole API.
    try:
        from ..utils.pm_pdf import build_pm_record_pdf
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="PDF export is not installed on the server (pip install -r requirements.txt).",
        )

    record_data = {
        **_serialize_record(record, employee_name),
        "parts": _parts_by_pm(db, [record.pm_id]).get(record.pm_id, []),
    }
    pdf = build_pm_record_pdf(record_data, fixture, tz)

    fixture_label = fixture.fixture_name if fixture else f"fixture_{record.fixture_id}"
    performed = _as_utc(record.performed_at)
    date_part = performed.strftime("%Y-%m-%d") if performed else "undated"
    filename = re.sub(r"[^A-Za-z0-9._-]+", "_", f"PM_{fixture_label}_{record.pm_type}_{date_part}.pdf")
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _clean_remarks(remarks: str | None) -> str | None:
    if not remarks:
        return None
    if remarks.startswith("REQUEST_TX_ID:"):
        _, _, rest = remarks.partition("|")
        return rest.strip() or None
    return remarks


@router.get("/fixtures/{fixture_id}/spare-parts")
def get_spare_parts_history(fixture_id: int, db: Session = Depends(get_db)):
    """Items requested for (or returned from) this fixture."""
    _get_fixture_or_404(db, fixture_id)

    rows = (
        db.query(
            models.Transaction.transaction_id,
            models.Transaction.transaction_type,
            models.Transaction.quantity_used,
            models.Transaction.remarks,
            models.Transaction.created_at,
            models.Transaction.pm_id,
            models.Inventory.item_id,
            models.Inventory.item_name,
            models.Inventory.item_part_number,
            models.Inventory.item_description,
            models.Employee.employee_name,
        )
        .outerjoin(models.Inventory, models.Transaction.item_id == models.Inventory.item_id)
        .outerjoin(models.Employee, models.Transaction.employee_id == models.Employee.employee_id)
        .filter(
            models.Transaction.fixture_id == fixture_id,
            func.lower(models.Transaction.transaction_type).in_(["request", "return"]),
        )
        .order_by(models.Transaction.created_at.desc())
        .all()
    )

    return [
        {
            "transaction_id": row.transaction_id,
            "transaction_type": (row.transaction_type or "").lower(),
            "quantity": row.quantity_used,
            "remarks": _clean_remarks(row.remarks),
            "created_at": row.created_at,
            "pm_id": row.pm_id,
            "item_id": row.item_id,
            "item_name": row.item_name,
            "item_part_number": row.item_part_number,
            "item_description": row.item_description,
            "employee_name": row.employee_name,
        }
        for row in rows
    ]

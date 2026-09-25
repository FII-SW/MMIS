# backend/app/routes/maintenance.py
import json
import math
import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..utils.auth_deps import employee_id_from_token, get_current_user, require_admin
from ..utils.pm_checklists import (
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
STATE_RANK = {"overdue": 0, "never": 1, "due_soon": 2, "ok": 3}


class ChecklistResult(BaseModel):
    item_id: str
    result: str


class PMRecordCreate(BaseModel):
    pm_type: str
    results: list[ChecklistResult]
    notes: str | None = None
    parts_replaced: str | None = None
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
    }


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
    }


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
        .filter(record_model.fixture_id.in_(fixture_ids))
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
        .all()
    )
    return {(record.fixture_id, record.pm_type): (record, name) for record, name in rows}


def _pm_entry(pm_type: str, latest: tuple | None, now: datetime) -> dict:
    entry = {
        "label": PM_TYPE_LABELS[pm_type],
        "interval_days": PM_INTERVAL_DAYS[pm_type],
        "last_performed_at": None,
        "last_performed_by": None,
        "last_result": None,
        "next_due_at": None,
        "days_until_due": None,
        "state": "never",
    }
    if not latest:
        return entry

    record, name = latest
    last = _as_utc(record.performed_at)
    if last is None:
        return entry

    next_due = last + timedelta(days=PM_INTERVAL_DAYS[pm_type])
    seconds_left = (next_due - now).total_seconds()
    if seconds_left < 0:
        state = "overdue"
    elif seconds_left <= PM_DUE_SOON_DAYS[pm_type] * 86400:
        state = "due_soon"
    else:
        state = "ok"

    entry.update(
        {
            "last_performed_at": last,
            "last_performed_by": name,
            "last_result": record.overall_result,
            "next_due_at": next_due,
            "days_until_due": math.floor(seconds_left / 86400),
            "state": state,
        }
    )
    return entry


def _fixture_pm(fixture: models.Fixture, latest_map: dict, now: datetime) -> dict:
    pm_types = get_pm_types(fixture.test_area)
    status = {
        pm_type: _pm_entry(pm_type, latest_map.get((fixture.fixture_id, pm_type)), now)
        for pm_type in pm_types
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


@router.get("/overview")
def get_pm_overview(project: str | None = None, test_area: str | None = None, db: Session = Depends(get_db)):
    """Fixtures for a location with PM status per fixture and summary counts."""
    query = db.query(models.Fixture)
    if project:
        query = query.filter(models.Fixture.project_name == project)
    if test_area:
        query = query.filter(models.Fixture.test_area == test_area)
    fixtures = query.order_by(models.Fixture.fixture_name).all()

    now = datetime.now(timezone.utc)
    latest_map = _latest_pm_records(
        db, [f.fixture_id for f in fixtures if get_pm_types(f.test_area)]
    )

    summary = _empty_counts()
    items = []
    for fixture in fixtures:
        pm = _fixture_pm(fixture, latest_map, now)
        if pm["state"]:
            summary[pm["state"]] += 1
        items.append({**_serialize_fixture(fixture), "pm": pm})

    summary["total"] = len(fixtures)
    summary["pm_applicable"] = sum(1 for item in items if item["pm"]["state"])
    return {"summary": summary, "fixtures": items}


@router.get("/summary")
def get_pm_summary(db: Session = Depends(get_db)):
    """PM compliance across all PM-applicable fixtures, grouped by project and test area."""
    fixtures = (
        db.query(models.Fixture)
        .filter(
            or_(
                *[
                    func.upper(models.Fixture.test_area).like(f"{prefix}%")
                    for prefix in PM_TEST_AREA_PREFIXES
                ]
            )
        )
        .all()
    )

    now = datetime.now(timezone.utc)
    latest_map = _latest_pm_records(db, [f.fixture_id for f in fixtures])

    totals = {**_empty_counts(), "fixtures": 0}
    locations: dict[tuple, dict] = {}
    attention = []
    for fixture in fixtures:
        pm = _fixture_pm(fixture, latest_map, now)
        if not pm["state"]:
            continue

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

        if pm["state"] == "overdue":
            attention.append({**_serialize_fixture(fixture), "pm": pm})

    attention.sort(key=lambda item: item["pm"]["days_until_due"])

    week_ago = now - timedelta(days=7)
    recent_query = db.query(func.count(models.FixturePMRecord.pm_id)).filter(
        models.FixturePMRecord.performed_at >= week_ago
    )
    completed_last_7_days = recent_query.scalar() or 0
    failed_last_7_days = (
        recent_query.filter(models.FixturePMRecord.overall_result == "failed").scalar() or 0
    )

    return {
        "totals": totals,
        "completed_last_7_days": completed_last_7_days,
        "failed_last_7_days": failed_last_7_days,
        "locations": sorted(
            locations.values(), key=lambda loc: (loc["project_name"] or "", loc["test_area"] or "")
        ),
        "attention": attention[:10],
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
    )
    if project:
        query = query.filter(models.FixturePMRecord.project_name == project)

    rows = query.order_by(models.FixturePMRecord.performed_at.desc()).limit(limit).all()
    return [
        {**_serialize_record(record, employee_name), "fixture_name": fixture_name}
        for record, employee_name, fixture_name in rows
    ]


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
    return [_serialize_record(record, name) for record, name in rows]


@router.get("/fixtures/{fixture_id}/pm-status")
def get_pm_status(fixture_id: int, db: Session = Depends(get_db)):
    fixture = _get_fixture_or_404(db, fixture_id)
    now = datetime.now(timezone.utc)
    pm = _fixture_pm(fixture, _latest_pm_records(db, [fixture_id]), now)
    return {
        "fixture_id": fixture_id,
        "applicable": bool(pm["pm_types"]),
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
    db.commit()
    db.refresh(record)

    employee = db.query(models.Employee).filter(models.Employee.employee_id == employee_id).first()
    return _serialize_record(record, employee.employee_name if employee else None)


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

    pdf = build_pm_record_pdf(_serialize_record(record, employee_name), fixture, tz)

    fixture_label = fixture.fixture_name if fixture else f"fixture_{record.fixture_id}"
    performed = _as_utc(record.performed_at)
    date_part = performed.strftime("%Y-%m-%d") if performed else "undated"
    filename = re.sub(r"[^A-Za-z0-9._-]+", "_", f"PM_{fixture_label}_{record.pm_type}_{date_part}.pdf")
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/pm-records/{pm_id}")
def delete_pm_record(pm_id: int, request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    record = db.query(models.FixturePMRecord).filter(models.FixturePMRecord.pm_id == pm_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="PM record not found")
    db.delete(record)
    db.commit()
    return {"message": "PM record deleted", "pm_id": pm_id}


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
            "item_id": row.item_id,
            "item_name": row.item_name,
            "item_part_number": row.item_part_number,
            "item_description": row.item_description,
            "employee_name": row.employee_name,
        }
        for row in rows
    ]

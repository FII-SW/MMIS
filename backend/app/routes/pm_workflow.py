# backend/app/routes/pm_workflow.py
"""PM follow-up workflow: pause fixtures, failed-task issues, void/edit audit, compliance trend."""
import bisect
import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session, aliased

from .. import models
from ..database import get_db
from ..utils.auth_deps import employee_id_from_token, get_current_user, require_admin
from ..utils.pm_checklists import PM_COVERS, PM_INTERVAL_DAYS, get_pm_types
from .maintenance import (
    _active_records,
    _as_utc,
    _get_fixture_or_404,
    _pm_test_area_filter,
    _pm_tracking_start,
    _serialize_fixture,
)

router = APIRouter(prefix="/maintenance", tags=["Maintenance workflow"])

ISSUE_STATUSES = ("open", "resolved", "voided")


class PauseUpdate(BaseModel):
    paused: bool
    reason: str | None = None


class IssueResolve(BaseModel):
    note: str


class RecordVoid(BaseModel):
    reason: str


class RecordEdit(BaseModel):
    notes: str | None = None
    parts_replaced: str | None = None


def _clean(value: str | None) -> str | None:
    value = (value or "").strip()
    return value or None


def _audit(db: Session, pm_id: int, action: str, employee_id: int, details: dict):
    db.add(
        models.PMRecordAudit(
            pm_id=pm_id,
            action=action,
            employee_id=employee_id,
            details=json.dumps(details, default=str),
        )
    )


# ---------------- Pause / resume PM ----------------

@router.patch("/fixtures/{fixture_id}/pm-pause")
def set_pm_pause(fixture_id: int, payload: PauseUpdate, request: Request, db: Session = Depends(get_db)):
    """Pause PM for an out-of-service fixture (admin). Resuming restarts the PM clock."""
    user = require_admin(request)
    employee_id = employee_id_from_token(user)
    fixture = _get_fixture_or_404(db, fixture_id)
    now = datetime.now(timezone.utc)

    if payload.paused:
        reason = _clean(payload.reason)
        if not reason:
            raise HTTPException(status_code=400, detail="A reason is required to pause PM")
        fixture.pm_paused = True
        fixture.pm_pause_reason = reason[:255]
        fixture.pm_paused_at = now
        fixture.pm_paused_by_employee_id = employee_id
    else:
        if not fixture.pm_paused:
            raise HTTPException(status_code=400, detail="PM is not paused for this fixture")
        fixture.pm_paused = False
        fixture.pm_pause_reason = None
        fixture.pm_paused_at = None
        fixture.pm_paused_by_employee_id = None
        fixture.pm_resumed_at = now

    db.commit()
    db.refresh(fixture)
    return _serialize_fixture(fixture)


# ---------------- Failed-task issues ----------------

def _serialize_issue(issue, fixture, found_by, resolved_by) -> dict:
    return {
        "issue_id": issue.issue_id,
        "pm_id": issue.pm_id,
        "fixture_id": issue.fixture_id,
        "fixture_name": fixture.fixture_name if fixture else None,
        "project_name": fixture.project_name if fixture else None,
        "test_area": fixture.test_area if fixture else None,
        "production_line": fixture.production_line if fixture else None,
        "pm_type": issue.pm_type,
        "item_id": issue.item_id,
        "task": issue.task,
        "status": issue.status,
        "created_at": issue.created_at,
        "found_by": found_by,
        "resolved_at": issue.resolved_at,
        "resolved_by": resolved_by,
        "resolution_note": issue.resolution_note,
    }


@router.get("/issues")
def list_issues(
    status: str = Query("open"),
    fixture_id: int | None = None,
    project: str | None = None,
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """Failed PM tasks. status = open | resolved | voided | all."""
    found_by = aliased(models.Employee)
    resolved_by = aliased(models.Employee)
    query = (
        db.query(models.PMIssue, models.Fixture, found_by.employee_name, resolved_by.employee_name)
        .outerjoin(models.Fixture, models.PMIssue.fixture_id == models.Fixture.fixture_id)
        .outerjoin(models.FixturePMRecord, models.PMIssue.pm_id == models.FixturePMRecord.pm_id)
        .outerjoin(found_by, models.FixturePMRecord.performed_by_employee_id == found_by.employee_id)
        .outerjoin(resolved_by, models.PMIssue.resolved_by_employee_id == resolved_by.employee_id)
    )
    if status != "all":
        if status not in ISSUE_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid status '{status}'")
        query = query.filter(models.PMIssue.status == status)
    if fixture_id:
        query = query.filter(models.PMIssue.fixture_id == fixture_id)
    if project:
        query = query.filter(models.Fixture.project_name == project)

    order = models.PMIssue.created_at.asc() if status == "open" else models.PMIssue.created_at.desc()
    rows = query.order_by(order).limit(limit).all()
    return [_serialize_issue(*row) for row in rows]


@router.post("/issues/{issue_id}/resolve")
def resolve_issue(issue_id: int, payload: IssueResolve, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request)
    employee_id = employee_id_from_token(user)
    note = _clean(payload.note)
    if not note:
        raise HTTPException(status_code=400, detail="Describe what was done to fix it")

    issue = db.query(models.PMIssue).filter(models.PMIssue.issue_id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    if issue.status != "open":
        raise HTTPException(status_code=400, detail=f"Issue is already {issue.status}")

    issue.status = "resolved"
    issue.resolved_at = datetime.now(timezone.utc)
    issue.resolved_by_employee_id = employee_id
    issue.resolution_note = note
    db.commit()
    return {"message": "Issue resolved", "issue_id": issue_id}


# ---------------- Void / edit PM records (audit trail) ----------------

def _get_record_or_404(db: Session, pm_id: int) -> models.FixturePMRecord:
    record = db.query(models.FixturePMRecord).filter(models.FixturePMRecord.pm_id == pm_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="PM record not found")
    return record


@router.post("/pm-records/{pm_id}/void")
def void_pm_record(pm_id: int, payload: RecordVoid, request: Request, db: Session = Depends(get_db)):
    """Void a PM record (admin). It stays in history for audit but no longer counts."""
    user = require_admin(request)
    employee_id = employee_id_from_token(user)
    reason = _clean(payload.reason)
    if not reason:
        raise HTTPException(status_code=400, detail="A reason is required to void a PM record")

    record = _get_record_or_404(db, pm_id)
    if record.voided:
        raise HTTPException(status_code=400, detail="PM record is already voided")

    now = datetime.now(timezone.utc)
    record.voided = True
    record.voided_at = now
    record.voided_by_employee_id = employee_id
    record.void_reason = reason

    db.query(models.PMIssue).filter(
        models.PMIssue.pm_id == pm_id, models.PMIssue.status == "open"
    ).update(
        {
            models.PMIssue.status: "voided",
            models.PMIssue.resolved_at: now,
            models.PMIssue.resolved_by_employee_id: employee_id,
            models.PMIssue.resolution_note: f"PM #{pm_id} voided: {reason}",
        },
        synchronize_session=False,
    )
    _audit(db, pm_id, "void", employee_id, {"reason": reason})
    db.commit()
    return {"message": "PM record voided", "pm_id": pm_id}


@router.delete("/pm-records/{pm_id}")
def delete_pm_record(pm_id: int, request: Request, db: Session = Depends(get_db)):
    """Permanently delete a PM record (admin), e.g. a test entry. Prefer void to keep an audit trail."""
    require_admin(request)
    record = _get_record_or_404(db, pm_id)

    # Stock transactions stay (the parts were used) but are no longer linked to this PM.
    db.query(models.Transaction).filter(models.Transaction.pm_id == pm_id).update(
        {models.Transaction.pm_id: None}, synchronize_session=False
    )
    db.query(models.PMIssue).filter(models.PMIssue.pm_id == pm_id).delete(synchronize_session=False)
    db.query(models.PMRecordAudit).filter(models.PMRecordAudit.pm_id == pm_id).delete(synchronize_session=False)
    db.delete(record)
    db.commit()
    return {"message": "PM record deleted", "pm_id": pm_id}


@router.patch("/pm-records/{pm_id}")
def edit_pm_record(pm_id: int, payload: RecordEdit, request: Request, db: Session = Depends(get_db)):
    """Correct notes / parts text (the person who recorded it, or an admin). Results can't be edited."""
    user = get_current_user(request)
    employee_id = employee_id_from_token(user)
    is_admin = str(user.get("role", "")).lower() == "admin"

    record = _get_record_or_404(db, pm_id)
    if record.voided:
        raise HTTPException(status_code=400, detail="Voided PM records can't be edited")
    if not is_admin and record.performed_by_employee_id != employee_id:
        raise HTTPException(status_code=403, detail="Only the person who recorded this PM or an admin can edit it")

    fields = payload.model_dump(exclude_unset=True) if hasattr(payload, "model_dump") else payload.dict(exclude_unset=True)
    changes = {}
    for field, value in fields.items():
        new_value = _clean(value)
        old_value = getattr(record, field)
        if new_value != old_value:
            changes[field] = {"from": old_value, "to": new_value}
            setattr(record, field, new_value)

    if not changes:
        raise HTTPException(status_code=400, detail="Nothing changed")
    if record.overall_result == "failed" and not record.notes:
        raise HTTPException(status_code=400, detail="Notes are required when any item failed")

    record.edited_at = datetime.now(timezone.utc)
    record.edited_by_employee_id = employee_id
    _audit(db, pm_id, "edit", employee_id, {"changes": changes})
    db.commit()
    return {"message": "PM record updated", "pm_id": pm_id, "changes": changes}


@router.get("/pm-records/{pm_id}/audit")
def get_pm_record_audit(pm_id: int, db: Session = Depends(get_db)):
    _get_record_or_404(db, pm_id)
    rows = (
        db.query(models.PMRecordAudit, models.Employee.employee_name)
        .outerjoin(models.Employee, models.PMRecordAudit.employee_id == models.Employee.employee_id)
        .filter(models.PMRecordAudit.pm_id == pm_id)
        .order_by(models.PMRecordAudit.created_at.asc())
        .all()
    )
    result = []
    for entry, name in rows:
        try:
            details = json.loads(entry.details or "{}")
        except ValueError:
            details = {}
        result.append(
            {
                "audit_id": entry.audit_id,
                "action": entry.action,
                "by": name,
                "at": entry.created_at,
                "details": details,
            }
        )
    return result


# ---------------- Compliance trend ----------------

def compute_weekly_compliance(
    pairs: list[tuple],
    record_times: dict[tuple, list[datetime]],
    completed: list[tuple[datetime, bool]],
    week_ends: list[datetime],
) -> list[dict]:
    """
    pairs: (fixture_id, pm_type, baseline) for every PM that applies.
    record_times: (fixture_id, pm_type) -> sorted performed_at of active records.
    A PM is up to date at time d when its last (covering) record is less than one interval old.
    """
    weeks = []
    for end in week_ends:
        tracked = up_to_date = 0
        for fixture_id, pm_type, baseline in pairs:
            if baseline is None or baseline > end:
                continue
            tracked += 1
            interval = timedelta(days=PM_INTERVAL_DAYS[pm_type])
            covering = [pm_type] + [other for other, covered in PM_COVERS.items() if pm_type in covered]
            last = None
            for kind in covering:
                times = record_times.get((fixture_id, kind), [])
                index = bisect.bisect_right(times, end)
                if index:
                    last = max(last, times[index - 1]) if last else times[index - 1]
            if last is not None and end - last < interval:
                up_to_date += 1
        start = end - timedelta(days=7)
        week_records = [failed for at, failed in completed if start < at <= end]
        weeks.append(
            {
                "week_start": start,
                "week_end": end,
                "tracked": tracked,
                "up_to_date": up_to_date,
                "pct": round(up_to_date * 100 / tracked) if tracked else None,
                "completed": len(week_records),
                "failed": sum(1 for failed in week_records if failed),
            }
        )
    return weeks


@router.get("/trend")
def get_compliance_trend(
    weeks: int = Query(12, ge=2, le=52),
    project: str | None = None,
    test_area: str | None = None,
    pm_type: str | None = None,
    db: Session = Depends(get_db),
):
    """PM up-to-date % at the end of each of the last N weeks (currently paused fixtures excluded)."""
    now = datetime.now(timezone.utc)
    week_ends = [now - timedelta(weeks=i) for i in range(weeks - 1, -1, -1)]
    pm_type = (pm_type or "").strip().lower() or None

    query = db.query(models.Fixture).filter(_pm_test_area_filter(), models.Fixture.pm_paused.is_(False))
    if project:
        query = query.filter(models.Fixture.project_name == project)
    if test_area:
        query = query.filter(models.Fixture.test_area == test_area)
    fixtures = query.all()
    tracking_start = _pm_tracking_start(db)

    pairs = []
    for fixture in fixtures:
        baseline = None
        if tracking_start is not None:
            starts = [tracking_start, _as_utc(fixture.created_at), _as_utc(fixture.pm_resumed_at)]
            baseline = max(s for s in starts if s is not None)
        for kind in get_pm_types(fixture.test_area):
            if not pm_type or kind == pm_type:
                pairs.append((fixture.fixture_id, kind, baseline))

    history_start = week_ends[0] - timedelta(days=max(PM_INTERVAL_DAYS.values()) + 1)
    fixture_ids = [f.fixture_id for f in fixtures]
    record_times: dict[tuple, list[datetime]] = {}
    completed: list[tuple[datetime, bool]] = []
    if fixture_ids:
        rows = (
            db.query(
                models.FixturePMRecord.fixture_id,
                models.FixturePMRecord.pm_type,
                models.FixturePMRecord.performed_at,
                models.FixturePMRecord.overall_result,
            )
            .filter(
                models.FixturePMRecord.fixture_id.in_(fixture_ids),
                models.FixturePMRecord.performed_at >= history_start,
                _active_records(),
            )
            .all()
        )
        for fixture_id, kind, performed_at, result in rows:
            at = _as_utc(performed_at)
            record_times.setdefault((fixture_id, kind), []).append(at)
            if not pm_type or kind == pm_type:
                completed.append((at, result == "failed"))
        for times in record_times.values():
            times.sort()

    return {
        "weeks": compute_weekly_compliance(pairs, record_times, completed, week_ends),
        "tracking_start": tracking_start,
    }

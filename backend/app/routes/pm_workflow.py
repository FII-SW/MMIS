# backend/app/routes/pm_workflow.py
"""PM follow-up workflow: pause fixtures, failed-task issues, void/edit audit, compliance trend."""
import bisect
import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session, aliased

from .. import models
from ..database import get_db
from ..utils.app_settings import setting_enabled
from ..utils.audit import log_action
from ..utils.email_service import send_pm_assignment_email
from ..utils.notifications import MY_PMS_LINK, fixture_list, notify
from ..utils.auth_deps import employee_id_from_token, require_admin, require_editor, require_super_admin
from ..utils.roles import ROLE_LABELS, can_edit, is_admin, normalize_role
from ..utils.pm_checklists import PM_COVERS, get_pm_types
from ..utils.pm_schedule import pm_due_at
from .maintenance import (
    STATE_RANK,
    _active_records,
    _as_utc,
    _fixture_pm,
    _get_fixture_or_404,
    _latest_pm_records,
    _pm_test_area_filter,
    _pm_tracking_start,
    _serialize_fixture,
    assignee_names,
    pm_baseline,
)

# A quarterly PM done at the start of a quarter is still valid until the end of the next one.
TREND_HISTORY_DAYS = 200

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

    log_action(
        db, user, "pause" if payload.paused else "resume", "fixture", fixture_id,
        f"{'Paused' if payload.paused else 'Resumed'} PM for {fixture.fixture_name}"
        + (f": {fixture.pm_pause_reason}" if payload.paused else ""),
    )
    db.commit()
    db.refresh(fixture)
    return _serialize_fixture(fixture, assignee_names(db, [fixture]))


# ---------------- PM assignments (Super Admin) ----------------

class PMAssignment(BaseModel):
    fixture_ids: list[int]
    employee_id: int | None = None


@router.put("/fixtures/pm-assignment")
def assign_fixture_pm(
    payload: PMAssignment, request: Request, background: BackgroundTasks, db: Session = Depends(get_db)
):
    """Assign fixtures to an employee who should perform their PMs (employee_id null = unassign)."""
    user = require_super_admin(request)
    return apply_pm_assignment(db, user, payload.fixture_ids, payload.employee_id, background)


def apply_pm_assignment(db, user, fixture_ids, employee_id, background, note: str | None = None) -> dict:
    """Assign (or unassign when employee_id is None) fixtures, log it, notify people and commit."""
    payload = PMAssignment(fixture_ids=list(fixture_ids), employee_id=employee_id)
    fixture_ids = sorted(set(payload.fixture_ids))
    if not fixture_ids:
        raise HTTPException(status_code=400, detail="Pick at least one fixture")
    if len(fixture_ids) > 2000:
        raise HTTPException(status_code=400, detail="Too many fixtures in one request (max 2000)")

    assignee = None
    if payload.employee_id is not None:
        assignee = (
            db.query(models.Employee).filter(models.Employee.employee_id == payload.employee_id).first()
        )
        if not assignee:
            raise HTTPException(status_code=404, detail="Employee not found")
        if assignee.employee_active is False:
            raise HTTPException(status_code=400, detail=f"{assignee.employee_name} is deactivated")
        if not can_edit(assignee.employee_access_level):
            raise HTTPException(
                status_code=400,
                detail=f"{assignee.employee_name} has view-only access and can't record PMs",
            )

    fixtures = db.query(models.Fixture).filter(models.Fixture.fixture_id.in_(fixture_ids)).all()
    missing = sorted(set(fixture_ids) - {f.fixture_id for f in fixtures})
    if missing:
        raise HTTPException(status_code=404, detail=f"Fixtures not found: {missing[:10]}")

    changed = [f for f in fixtures if f.pm_assigned_employee_id != payload.employee_id]
    previous_owner = {f.fixture_id: f.pm_assigned_employee_id for f in changed}
    now = datetime.now(timezone.utc)
    actor_id = employee_id_from_token(user)
    for fixture in changed:
        fixture.pm_assigned_employee_id = payload.employee_id
        fixture.pm_assigned_at = now if assignee else None
        fixture.pm_assigned_by_employee_id = actor_id if assignee else None
    if changed:
        names = ", ".join(f.fixture_name for f in changed[:10]) + (" …" if len(changed) > 10 else "")
        log_action(
            db, user, "assign" if assignee else "unassign", "fixture", None,
            (f"Assigned {len(changed)} fixture(s) to {assignee.employee_name} for PM: {names}"
             if assignee else f"Removed the PM assignee from {len(changed)} fixture(s): {names}")
            + (f" ({note})" if note else ""),
            {"fixture_ids": [f.fixture_id for f in changed], "employee_id": payload.employee_id},
        )
        emailed = _notify_assignment_change(db, user, assignee, changed, previous_owner, background)
    else:
        emailed = False
    db.commit()
    return {
        "updated": len(changed),
        "employee_id": payload.employee_id,
        "employee_name": assignee.employee_name if assignee else None,
        "notified": bool(changed and assignee and assignee.employee_id != employee_id_from_token(user)),
        "emailed": emailed,
    }


class MoveAssignments(BaseModel):
    from_employee_id: int
    to_employee_id: int | None = None


@router.post("/fixtures/pm-assignment/move")
def move_pm_assignments(
    payload: MoveAssignments, request: Request, background: BackgroundTasks, db: Session = Depends(get_db)
):
    """Move every fixture assigned to one person to another person (or unassign them all)."""
    user = require_super_admin(request)
    if payload.to_employee_id == payload.from_employee_id:
        raise HTTPException(status_code=400, detail="Pick a different person to move the fixtures to")
    source = db.query(models.Employee).filter(models.Employee.employee_id == payload.from_employee_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Employee not found")
    fixture_ids = [
        fid
        for (fid,) in db.query(models.Fixture.fixture_id)
        .filter(models.Fixture.pm_assigned_employee_id == payload.from_employee_id)
        .all()
    ]
    if not fixture_ids:
        raise HTTPException(status_code=400, detail=f"{source.employee_name} has no assigned fixtures")
    result = apply_pm_assignment(
        db, user, fixture_ids, payload.to_employee_id, background, note=f"moved from {source.employee_name}"
    )
    return {**result, "from_employee_name": source.employee_name}


@router.get("/pm-workload")
def pm_workload(request: Request, db: Session = Depends(get_db)):
    """Per person: assigned fixtures and their PM status; plus PM fixtures nobody owns."""
    require_admin(request)
    now = datetime.now(timezone.utc)
    fixtures = db.query(models.Fixture).filter(_pm_test_area_filter()).all()
    tracking_start = _pm_tracking_start(db)
    latest_map = _latest_pm_records(db, [f.fixture_id for f in fixtures])

    empty = {state: 0 for state in STATE_RANK}
    people: dict[int, dict] = {}
    unassigned = {"fixtures": 0, **empty, "areas": {}}
    for fixture in fixtures:
        pm = _fixture_pm(fixture, latest_map, now, tracking_start)
        state = pm["state"]
        if fixture.pm_assigned_employee_id:
            entry = people.setdefault(
                fixture.pm_assigned_employee_id, {"fixtures": 0, **empty, "worst_days_overdue": 0, "areas": set()}
            )
            entry["fixtures"] += 1
            entry["areas"].add(f"{fixture.project_name} · {fixture.test_area}")
            if state:
                entry[state] += 1
            if state == "overdue" and pm["days_until_due"] is not None:
                entry["worst_days_overdue"] = max(entry["worst_days_overdue"], -pm["days_until_due"])
        else:
            unassigned["fixtures"] += 1
            if state:
                unassigned[state] += 1
            key = f"{fixture.project_name} · {fixture.test_area}"
            unassigned["areas"][key] = unassigned["areas"].get(key, 0) + 1

    employees = db.query(models.Employee).filter(models.Employee.employee_active.isnot(False)).all()
    rows = []
    for emp in employees:
        role = normalize_role(emp.employee_access_level)
        entry = people.pop(emp.employee_id, None)
        if entry is None and not can_edit(role):
            continue
        entry = entry or {"fixtures": 0, **empty, "worst_days_overdue": 0, "areas": set()}
        active_pms = entry["fixtures"] - entry["paused"]
        rows.append(
            {
                "employee_id": emp.employee_id,
                "employee_name": emp.employee_name,
                "employee_username": emp.employee_username,
                "employee_designation": emp.employee_designation,
                "employee_shift": emp.employee_shift,
                "role": role,
                "role_label": ROLE_LABELS.get(role, role),
                **{k: v for k, v in entry.items() if k != "areas"},
                "areas": sorted(entry["areas"]),
                "on_track": round((active_pms - entry["overdue"]) * 100 / active_pms) if active_pms else None,
            }
        )
    rows.sort(key=lambda r: (-r["overdue"], -r["fixtures"], r["employee_name"].lower()))
    return {
        "people": rows,
        "unassigned": {
            **{k: v for k, v in unassigned.items() if k != "areas"},
            "areas": [
                {"area": area, "fixtures": count}
                for area, count in sorted(unassigned["areas"].items(), key=lambda kv: (-kv[1], kv[0]))
            ],
        },
        "total_fixtures": len(fixtures),
    }


def _area_summary(fixtures) -> str:
    """'Project A · FCT, Project B · ICT'"""
    groups = sorted({f"{f.project_name} · {f.test_area}" for f in fixtures})
    return ", ".join(groups[:4]) + (f" and {len(groups) - 4} more" if len(groups) > 4 else "")


def _notify_assignment_change(db, user, assignee, changed, previous_owner, background) -> bool:
    """In-app notice for the new assignee and for anyone who lost fixtures; email the assignee.
    Returns True when an assignment email was queued."""
    actor_id = employee_id_from_token(user)
    actor = db.query(models.Employee).filter(models.Employee.employee_id == actor_id).first()
    actor_name = actor.employee_name if actor else "Your Super Admin"
    names = sorted((f.fixture_name for f in changed), key=str.lower)

    emailed = False
    if assignee and assignee.employee_id != actor_id:
        count = len(changed)
        notify(
            db,
            assignee.employee_id,
            "pm_assignment",
            f"{count} fixture{'s' if count != 1 else ''} assigned to you for PM",
            f"{actor_name} assigned you {count} fixture{'s' if count != 1 else ''} in {_area_summary(changed)}: "
            f"{fixture_list(names)}. You are now responsible for keeping their PMs up to date.",
            MY_PMS_LINK,
        )
        if assignee.employee_email and setting_enabled(db, "pm_assignment_emails"):
            background.add_task(
                send_pm_assignment_email,
                assignee.employee_email,
                assignee.employee_name,
                actor_name,
                [
                    {
                        "fixture_name": f.fixture_name,
                        "project_name": f.project_name,
                        "test_area": f.test_area,
                        "production_line": f.production_line,
                    }
                    for f in sorted(changed, key=lambda f: (f.project_name, f.test_area, f.fixture_name.lower()))
                ],
                MY_PMS_LINK,
            )
            emailed = True

    lost: dict[int, list] = {}
    for fixture in changed:
        old = previous_owner.get(fixture.fixture_id)
        if old and old != actor_id:
            lost.setdefault(old, []).append(fixture)
    for employee_id, fixtures in lost.items():
        count = len(fixtures)
        plural = "s" if count != 1 else ""
        verb = "reassigned" if assignee else "unassigned"
        target = f" to {assignee.employee_name}" if assignee else ""
        notify(
            db,
            employee_id,
            "pm_unassignment",
            f"{count} PM fixture{plural} {verb}{target}",
            f"{actor_name} {verb} {count} fixture{plural} you were responsible for{target}: "
            f"{fixture_list(sorted((f.fixture_name for f in fixtures), key=str.lower))}. "
            "You no longer need to do their PMs.",
            MY_PMS_LINK,
        )
    return emailed


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
    user = require_editor(request)
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
    log_action(
        db, user, "void", "pm_record", pm_id,
        f"Voided {record.pm_type} PM #{pm_id} on {_fixture_name(db, record.fixture_id)}: {reason}",
    )
    db.commit()
    return {"message": "PM record voided", "pm_id": pm_id}


def _fixture_name(db: Session, fixture_id: int) -> str:
    name = db.query(models.Fixture.fixture_name).filter(models.Fixture.fixture_id == fixture_id).scalar()
    return name or f"fixture {fixture_id}"


@router.delete("/pm-records/{pm_id}")
def delete_pm_record(pm_id: int, request: Request, db: Session = Depends(get_db)):
    """Permanently delete a PM record (Super Admin), e.g. a test entry. Prefer void to keep an audit trail."""
    user = require_super_admin(request)
    record = _get_record_or_404(db, pm_id)
    log_action(
        db, user, "delete", "pm_record", pm_id,
        f"Permanently deleted {record.pm_type} PM #{pm_id} on {_fixture_name(db, record.fixture_id)} "
        f"({record.overall_result}, done {record.performed_at:%Y-%m-%d})",
    )

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
    user = require_editor(request)
    employee_id = employee_id_from_token(user)
    record = _get_record_or_404(db, pm_id)
    if record.voided:
        raise HTTPException(status_code=400, detail="Voided PM records can't be edited")
    if not is_admin(user.get("role")) and record.performed_by_employee_id != employee_id:
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
    log_action(
        db, user, "edit", "pm_record", pm_id,
        f"Edited {', '.join(changes)} of {record.pm_type} PM #{pm_id} on {_fixture_name(db, record.fixture_id)}",
        {"changes": changes},
    )
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
    A PM is up to date at time d when it has a (covering) record and its calendar due date
    (see pm_schedule) has not passed yet.
    """
    weeks = []
    for end in week_ends:
        tracked = up_to_date = 0
        for fixture_id, pm_type, baseline in pairs:
            if baseline is None or baseline > end:
                continue
            tracked += 1
            covering = [pm_type] + [other for other, covered in PM_COVERS.items() if pm_type in covered]
            last = None
            for kind in covering:
                times = record_times.get((fixture_id, kind), [])
                index = bisect.bisect_right(times, end)
                if index:
                    last = max(last, times[index - 1]) if last else times[index - 1]
            if last is not None and pm_due_at(pm_type, last, baseline) >= end:
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
        baseline = pm_baseline(fixture, tracking_start)
        for kind in get_pm_types(fixture.test_area):
            if not pm_type or kind == pm_type:
                pairs.append((fixture.fixture_id, kind, baseline))

    history_start = week_ends[0] - timedelta(days=TREND_HISTORY_DAYS)
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

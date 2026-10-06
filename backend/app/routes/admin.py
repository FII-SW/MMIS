# backend/app/routes/admin.py
"""Super Admin: user management, audit log and system settings."""
import json
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..utils.app_settings import SETTINGS, clean_setting, get_setting, setting_enabled
from ..utils.audit import changed_fields, log_action
from ..utils.email_service import send_list_email
from ..utils.notifications import notify
from ..utils.pm_jobs import send_overdue_alerts, send_weekly_pm_reminders
from ..utils.auth_deps import employee_id_from_token, forget_account, require_super_admin
from ..utils.password_utils import normalize_password_for_storage
from ..utils.roles import ROLE_LABELS, ROLES, SUPER_ADMIN, VIEWER, normalize_role

router = APIRouter(prefix="/admin", tags=["Super Admin"])

MIN_PASSWORD_LENGTH = 6


def _clean(value: str | None) -> str | None:
    value = (value or "").strip()
    return value or None


def _role(value: str) -> str:
    role = normalize_role(value)
    if role not in ROLES:
        raise HTTPException(status_code=400, detail=f"Role must be one of: {', '.join(ROLE_LABELS.values())}")
    return role


def _serialize_user(emp: models.Employee, assigned: int = 0) -> dict:
    role = normalize_role(emp.employee_access_level)
    return {
        "employee_id": emp.employee_id,
        "employee_name": emp.employee_name,
        "employee_username": emp.employee_username,
        "employee_badge_number": emp.employee_badge_number,
        "employee_email": emp.employee_email,
        "employee_designation": emp.employee_designation,
        "employee_shift": emp.employee_shift,
        "role": role,
        "role_label": ROLE_LABELS.get(role, emp.employee_access_level or "—"),
        "active": emp.employee_active is not False,
        "must_change_password": bool(emp.employee_must_change_password),
        "assigned_fixtures": assigned,
    }


def _get_employee_or_404(db: Session, employee_id: int) -> models.Employee:
    emp = db.query(models.Employee).filter(models.Employee.employee_id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="User not found")
    return emp


def _active_super_admins(db: Session) -> list[int]:
    return [
        emp.employee_id
        for emp in db.query(models.Employee).filter(models.Employee.employee_active.isnot(False)).all()
        if normalize_role(emp.employee_access_level) == SUPER_ADMIN
    ]


def _check_unique(db: Session, emp_id: int | None, username: str | None, badge: str | None):
    if username:
        clash = db.query(models.Employee).filter(
            func.lower(models.Employee.employee_username) == username.lower()
        )
        if emp_id:
            clash = clash.filter(models.Employee.employee_id != emp_id)
        if clash.first():
            raise HTTPException(status_code=400, detail=f"Username '{username}' is already taken")
    if badge:
        clash = db.query(models.Employee).filter(models.Employee.employee_badge_number == badge)
        if emp_id:
            clash = clash.filter(models.Employee.employee_id != emp_id)
        if clash.first():
            raise HTTPException(status_code=400, detail=f"Badge number '{badge}' is already used")


# ---------------- Users ----------------

class UserCreate(BaseModel):
    employee_name: str = Field(min_length=1, max_length=100)
    employee_username: str = Field(min_length=1, max_length=50)
    employee_badge_number: str = Field(min_length=1, max_length=20)
    password: str = Field(min_length=MIN_PASSWORD_LENGTH)
    require_change: bool = True
    role: str = "user"
    employee_email: str | None = Field(default=None, max_length=255)
    employee_designation: str | None = Field(default=None, max_length=50)
    employee_shift: str | None = Field(default=None, max_length=20)


class UserUpdate(BaseModel):
    employee_name: str | None = Field(default=None, max_length=100)
    employee_username: str | None = Field(default=None, max_length=50)
    employee_badge_number: str | None = Field(default=None, max_length=20)
    role: str | None = None
    active: bool | None = None
    employee_email: str | None = Field(default=None, max_length=255)
    employee_designation: str | None = Field(default=None, max_length=50)
    employee_shift: str | None = Field(default=None, max_length=20)


class PasswordReset(BaseModel):
    new_password: str = Field(min_length=MIN_PASSWORD_LENGTH)
    require_change: bool = True


@router.get("/users")
def list_users(request: Request, db: Session = Depends(get_db)):
    require_super_admin(request)
    assigned = dict(
        db.query(models.Fixture.pm_assigned_employee_id, func.count(models.Fixture.fixture_id))
        .filter(models.Fixture.pm_assigned_employee_id.isnot(None))
        .group_by(models.Fixture.pm_assigned_employee_id)
        .all()
    )
    employees = db.query(models.Employee).order_by(func.lower(models.Employee.employee_name)).all()
    return {
        "users": [_serialize_user(emp, assigned.get(emp.employee_id, 0)) for emp in employees],
        "roles": [{"value": role, "label": ROLE_LABELS[role]} for role in ROLES],
    }


@router.post("/users", status_code=201)
def create_user(payload: UserCreate, request: Request, db: Session = Depends(get_db)):
    actor = require_super_admin(request)
    name = _clean(payload.employee_name)
    username = _clean(payload.employee_username)
    badge = _clean(payload.employee_badge_number)
    if not (name and username and badge):
        raise HTTPException(status_code=400, detail="Name, username and badge number are required")
    role = _role(payload.role)
    _check_unique(db, None, username, badge)

    emp = models.Employee(
        employee_name=name,
        employee_username=username,
        employee_badge_number=badge,
        employee_password=normalize_password_for_storage(payload.password),
        employee_access_level=role,
        employee_email=_clean(payload.employee_email),
        employee_designation=_clean(payload.employee_designation),
        employee_shift=_clean(payload.employee_shift),
        employee_active=True,
        employee_must_change_password=payload.require_change,
    )
    db.add(emp)
    db.flush()
    log_action(
        db, actor, "create", "user", emp.employee_id,
        f"Created user {name} ({username}) as {ROLE_LABELS[role]}",
    )
    db.commit()
    db.refresh(emp)
    return _serialize_user(emp)


@router.patch("/users/{employee_id}")
def update_user(employee_id: int, payload: UserUpdate, request: Request, db: Session = Depends(get_db)):
    actor = require_super_admin(request)
    actor_id = employee_id_from_token(actor)
    emp = _get_employee_or_404(db, employee_id)
    fields = payload.model_dump(exclude_unset=True) if hasattr(payload, "model_dump") else payload.dict(exclude_unset=True)

    values = {}
    for field in ("employee_name", "employee_username", "employee_badge_number"):
        if field in fields:
            value = _clean(fields[field])
            if not value:
                raise HTTPException(status_code=400, detail="Name, username and badge number can't be empty")
            values[field] = value
    for field in ("employee_email", "employee_designation", "employee_shift"):
        if field in fields:
            values[field] = _clean(fields[field])
    if fields.get("role") is not None:
        values["employee_access_level"] = _role(fields["role"])
    if fields.get("active") is not None:
        values["employee_active"] = bool(fields["active"])

    _check_unique(db, employee_id, values.get("employee_username"), values.get("employee_badge_number"))

    old_role = normalize_role(emp.employee_access_level)
    if values.get("employee_access_level") == old_role:
        values.pop("employee_access_level")
    new_role = values.get("employee_access_level", old_role)
    was_active = emp.employee_active is not False
    now_active = values.get("employee_active", was_active)
    if employee_id == actor_id and (new_role != SUPER_ADMIN or not now_active):
        raise HTTPException(
            status_code=400,
            detail="You can't remove your own Super Admin access or deactivate yourself. Ask another Super Admin.",
        )
    if old_role == SUPER_ADMIN and was_active and (new_role != SUPER_ADMIN or not now_active):
        if _active_super_admins(db) == [employee_id]:
            raise HTTPException(status_code=400, detail="MMIS needs at least one active Super Admin")

    changes = changed_fields(emp, values)
    if not changes:
        return _serialize_user(emp)

    if "employee_access_level" in changes:
        changes["employee_access_level"] = {"from": old_role, "to": new_role}
    for field, value in values.items():
        setattr(emp, field, value)

    unassigned = 0
    if (not now_active and was_active) or (new_role == VIEWER and old_role != VIEWER):
        # Their fixtures go back to "unassigned" so PMs don't wait on someone who can't record them.
        unassigned = (
            db.query(models.Fixture)
            .filter(models.Fixture.pm_assigned_employee_id == employee_id)
            .update(
                {
                    models.Fixture.pm_assigned_employee_id: None,
                    models.Fixture.pm_assigned_at: None,
                    models.Fixture.pm_assigned_by_employee_id: None,
                },
                synchronize_session=False,
            )
        )
    unassigned_note = f" and unassigned {unassigned} PM fixture(s)" if unassigned else ""

    if not now_active and was_active:
        action, summary = "deactivate", f"Deactivated user {emp.employee_name}{unassigned_note}"
    elif now_active and not was_active:
        action, summary = "activate", f"Re-activated user {emp.employee_name}"
    elif "employee_access_level" in changes:
        action = "role_change"
        summary = (
            f"Changed {emp.employee_name}'s access from {ROLE_LABELS.get(old_role, old_role)} "
            f"to {ROLE_LABELS[new_role]}{unassigned_note}"
        )
    else:
        action, summary = "update", f"Edited user {emp.employee_name}: {', '.join(changes)}"

    log_action(db, actor, action, "user", employee_id, summary, {"changes": changes})
    db.commit()
    forget_account(employee_id)
    db.refresh(emp)
    return _serialize_user(emp)


@router.post("/users/{employee_id}/reset-password")
def reset_password(employee_id: int, payload: PasswordReset, request: Request, db: Session = Depends(get_db)):
    actor = require_super_admin(request)
    emp = _get_employee_or_404(db, employee_id)
    emp.employee_password = normalize_password_for_storage(payload.new_password)
    emp.employee_must_change_password = payload.require_change
    log_action(
        db, actor, "password_reset", "user", employee_id,
        f"Reset the password of {emp.employee_name}"
        + (" (must change it at next sign-in)" if payload.require_change else ""),
    )
    db.commit()
    forget_account(employee_id)
    return {"message": f"Password reset for {emp.employee_name}", "must_change_password": payload.require_change}


# ---------------- Audit log ----------------

@router.get("/audit")
def list_audit(
    request: Request,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    employee_id: int | None = None,
    entity_type: str | None = None,
    action: str | None = None,
    q: str | None = None,
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    require_super_admin(request)
    log = models.AuditLog
    query = db.query(log, models.Employee.employee_name).outerjoin(
        models.Employee, log.employee_id == models.Employee.employee_id
    )
    if date_from:
        query = query.filter(log.created_at >= date_from)
    if date_to:
        query = query.filter(log.created_at < date_to)
    if employee_id:
        query = query.filter(log.employee_id == employee_id)
    if entity_type:
        query = query.filter(log.entity_type == entity_type)
    if action:
        query = query.filter(log.action == action)
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        query = query.filter(or_(log.summary.ilike(pattern), models.Employee.employee_name.ilike(pattern)))

    total = query.count()
    rows = query.order_by(log.created_at.desc(), log.audit_id.desc()).offset(offset).limit(limit).all()
    entries = []
    for entry, name in rows:
        try:
            details = json.loads(entry.details) if entry.details else None
        except ValueError:
            details = None
        entries.append(
            {
                "audit_id": entry.audit_id,
                "created_at": entry.created_at,
                "employee_id": entry.employee_id,
                "employee_name": name,
                "action": entry.action,
                "entity_type": entry.entity_type,
                "entity_id": entry.entity_id,
                "summary": entry.summary,
                "details": details,
            }
        )
    return {
        "total": total,
        "entries": entries,
        "entity_types": [row[0] for row in db.query(log.entity_type).distinct().order_by(log.entity_type).all()],
        "actions": [row[0] for row in db.query(log.action).distinct().order_by(log.action).all()],
    }


# ---------------- Settings ----------------

class SettingsUpdate(BaseModel):
    values: dict[str, str | bool | None]


def _settings_out(db: Session) -> list[dict]:
    return [{"key": key, **meta, "value": get_setting(db, key)} for key, meta in SETTINGS.items()]


@router.get("/settings")
def get_settings(request: Request, db: Session = Depends(get_db)):
    require_super_admin(request)
    return {"settings": _settings_out(db)}


@router.put("/settings")
def update_settings(payload: SettingsUpdate, request: Request, db: Session = Depends(get_db)):
    actor = require_super_admin(request)
    actor_id = employee_id_from_token(actor)
    changes = {}
    for key, raw in payload.values.items():
        value = clean_setting(key, raw)
        old = get_setting(db, key)
        if value == old:
            continue
        row = db.query(models.AppSetting).filter(models.AppSetting.key == key).first()
        if row is None:
            row = models.AppSetting(key=key)
            db.add(row)
        row.value = value
        row.updated_by_employee_id = actor_id
        changes[key] = {"from": old, "to": value}

    if changes:
        labels = ", ".join(SETTINGS[key]["label"] for key in changes)
        log_action(db, actor, "settings", "setting", None, f"Changed settings: {labels}", {"changes": changes})
        db.commit()
    return {"settings": _settings_out(db), "changed": list(changes)}


JOBS = {
    "weekly_reminder": ("pm_weekly_reminders", send_weekly_pm_reminders, "Monday PM reminder"),
    "overdue_alerts": ("pm_overdue_alerts", send_overdue_alerts, "overdue PM alerts"),
}


@router.post("/jobs/{job}/run")
def run_job_now(job: str, request: Request, db: Session = Depends(get_db)):
    """Run a scheduled notification job right away (e.g. to try it after changing settings)."""
    actor = require_super_admin(request)
    if job not in JOBS:
        raise HTTPException(status_code=404, detail="Unknown job")
    setting_key, run, label = JOBS[job]
    if not setting_enabled(db, setting_key):
        raise HTTPException(status_code=400, detail=f"The {label} is turned off. Turn it on and save first.")
    count = run(db)
    log_action(db, actor, "run_job", "setting", job, f"Ran the {label} now ({count} sent)")
    db.commit()
    return {"job": job, "count": count}


# ---------------- Announcements ----------------

class Announcement(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    message: str = Field(min_length=1, max_length=2000)
    roles: list[str] = []  # empty = everyone
    email: bool = False
    link: str | None = Field(default=None, max_length=255)


@router.post("/announcements")
def send_announcement(
    payload: Announcement, request: Request, background: BackgroundTasks, db: Session = Depends(get_db)
):
    """Send a bell notification (and optionally an email) to everyone, or to people with chosen access levels."""
    actor = require_super_admin(request)
    title = payload.title.strip()
    message = payload.message.strip()
    if not title or not message:
        raise HTTPException(status_code=400, detail="Title and message are required")
    roles = {_role(role) for role in payload.roles}
    link = (payload.link or "").strip() or None
    if link and not link.startswith("/dashboard"):
        raise HTTPException(status_code=400, detail="Link must be an MMIS page, e.g. /dashboard/documents")

    recipients = [
        emp
        for emp in db.query(models.Employee).filter(models.Employee.employee_active.isnot(False)).all()
        if not roles or normalize_role(emp.employee_access_level) in roles
    ]
    if not recipients:
        raise HTTPException(status_code=400, detail="Nobody has the chosen access level")

    actor_id = employee_id_from_token(actor)
    sender = next((e.employee_name for e in recipients if e.employee_id == actor_id), None) or (
        db.query(models.Employee.employee_name).filter(models.Employee.employee_id == actor_id).scalar()
    )
    for emp in recipients:
        notify(db, emp.employee_id, "announcement", title, f"{message}\n— {sender}", link)

    audience = ", ".join(ROLE_LABELS[r] for r in sorted(roles)) if roles else "Everyone"
    emails = [(e.employee_email, e.employee_name) for e in recipients if e.employee_email] if payload.email else []
    log_action(
        db, actor, "announce", "announcement", None,
        f"Announcement to {audience} ({len(recipients)} people): {title}",
        {"title": title, "message": message, "roles": sorted(roles), "email": payload.email, "link": link,
         "recipients": len(recipients)},
    )
    db.commit()

    def send_emails():
        for address, name in emails:
            send_list_email(address, name, title, f"{message}\n\n— {sender}", [], link)

    if emails:
        background.add_task(send_emails)
    return {"recipients": len(recipients), "emailed": len(emails), "audience": audience}


@router.get("/announcements")
def list_announcements(request: Request, limit: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    require_super_admin(request)
    rows = (
        db.query(models.AuditLog, models.Employee.employee_name)
        .outerjoin(models.Employee, models.AuditLog.employee_id == models.Employee.employee_id)
        .filter(models.AuditLog.action == "announce")
        .order_by(models.AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )
    items = []
    for entry, sender in rows:
        try:
            details = json.loads(entry.details or "{}")
        except ValueError:
            details = {}
        items.append(
            {
                "created_at": entry.created_at,
                "sender": sender,
                "summary": entry.summary,
                "title": details.get("title"),
                "message": details.get("message"),
                "roles": details.get("roles", []),
                "email": details.get("email", False),
                "recipients": details.get("recipients"),
            }
        )
    return {"announcements": items}

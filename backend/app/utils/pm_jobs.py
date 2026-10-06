"""Scheduled PM notifications: Monday reminder to assignees and overdue alerts to admins."""
import logging
import zlib
from datetime import datetime, timezone

from sqlalchemy import text

from .. import models
from .app_settings import setting_enabled, setting_int
from .email_service import send_list_email
from .notifications import MY_PMS_LINK, notify
from .roles import can_edit, is_admin

logger = logging.getLogger(__name__)

OVERDUE_TODO_LINK = "/dashboard/maintenance/dashboard?tab=todo&status=overdue"
MAX_LISTED = 8


def claim_run(db, job_id: str, period: str) -> bool:
    """True for the first worker to run `job_id` in `period`; the others get False."""
    db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": zlib.crc32(job_id.encode())})
    row = db.get(models.JobRun, job_id)
    if row is not None and row.period == period:
        db.rollback()
        return False
    if row is None:
        row = models.JobRun(job_id=job_id, period=period)
        db.add(row)
    row.period = period
    row.ran_at = datetime.now(timezone.utc)
    db.commit()
    return True


def _assigned_pm_tasks(db, now):
    """[(fixture, pm_type, entry)] for every assigned, active-PM fixture."""
    from ..routes.maintenance import _fixture_pm, _latest_pm_records, _pm_tracking_start

    fixtures = db.query(models.Fixture).filter(models.Fixture.pm_assigned_employee_id.isnot(None)).all()
    if not fixtures:
        return []
    tracking_start = _pm_tracking_start(db)
    latest_map = _latest_pm_records(db, [f.fixture_id for f in fixtures])
    tasks = []
    for fixture in fixtures:
        pm = _fixture_pm(fixture, latest_map, now, tracking_start)
        for pm_type, entry in pm["status"].items():
            tasks.append((fixture, pm_type, entry))
    return tasks


def _active_employees(db) -> dict[int, models.Employee]:
    return {
        e.employee_id: e
        for e in db.query(models.Employee).filter(models.Employee.employee_active.isnot(False)).all()
    }


def _plural(n: int, word: str) -> str:
    return f"{n} {word}{'' if n == 1 else 's'}"


def _describe(fixture, entry) -> str:
    days = entry.get("days_until_due")
    if days is None:
        when = ""
    elif days < 0:
        when = f", {_plural(-days, 'day')} overdue"
    elif days == 0:
        when = ", due today"
    else:
        when = f", due in {_plural(days, 'day')}"
    return f"{fixture.fixture_name} ({entry['label']}{when})"


def _trim(lines: list[str]) -> list[str]:
    if len(lines) <= MAX_LISTED:
        return lines
    return lines[:MAX_LISTED] + [f"…and {len(lines) - MAX_LISTED} more"]


def send_weekly_pm_reminders(db, now: datetime | None = None) -> int:
    """Notify each assignee about their overdue / due-soon PMs. Returns how many people were notified."""
    if not setting_enabled(db, "pm_weekly_reminders"):
        logger.info("[PM JOBS] Weekly reminders are turned off.")
        return 0
    now = now or datetime.now(timezone.utc)
    employees = _active_employees(db)
    email_on = setting_enabled(db, "pm_reminder_emails")

    by_person: dict[int, dict[str, list]] = {}
    for fixture, _pm_type, entry in _assigned_pm_tasks(db, now):
        if entry["state"] not in ("overdue", "due_soon"):
            continue
        bucket = by_person.setdefault(fixture.pm_assigned_employee_id, {"overdue": [], "due_soon": []})
        bucket[entry["state"]].append((fixture, entry))

    sent = 0
    for employee_id, bucket in by_person.items():
        person = employees.get(employee_id)
        if person is None or not can_edit(person.employee_access_level):
            continue
        overdue = sorted(bucket["overdue"], key=lambda t: t[1]["days_until_due"])
        due_soon = sorted(bucket["due_soon"], key=lambda t: t[1]["days_until_due"])
        parts = [p for p in (overdue and f"{len(overdue)} overdue", due_soon and f"{len(due_soon)} due soon") if p]
        title = f"Your PMs this week: {' and '.join(parts)}"
        lines = [_describe(f, e) for f, e in overdue + due_soon]
        message = (
            f"{'Start with the overdue ones. ' if overdue else ''}"
            f"{'; '.join(_trim(lines))}. Open My PMs to start."
        )
        notify(db, employee_id, "pm_weekly", title, message, MY_PMS_LINK)
        if email_on and person.employee_email:
            send_list_email(
                person.employee_email,
                person.employee_name,
                title,
                "These PMs on the fixtures assigned to you are overdue or due soon:",
                lines,
                MY_PMS_LINK,
            )
        sent += 1
    db.commit()
    logger.info("[PM JOBS] Weekly PM reminders sent to %s people.", sent)
    return sent


def send_overdue_alerts(db, now: datetime | None = None) -> int:
    """Tell admins (and the assignee) about assigned PMs newly overdue by the threshold. Returns new alerts."""
    if not setting_enabled(db, "pm_overdue_alerts"):
        logger.info("[PM JOBS] Overdue alerts are turned off.")
        return 0
    now = now or datetime.now(timezone.utc)
    threshold = setting_int(db, "pm_overdue_alert_days")
    employees = _active_employees(db)
    email_on = setting_enabled(db, "pm_reminder_emails")

    candidates = [
        (fixture, pm_type, entry)
        for fixture, pm_type, entry in _assigned_pm_tasks(db, now)
        if entry["state"] == "overdue"
        and entry.get("days_until_due") is not None
        and -entry["days_until_due"] >= threshold
        and entry.get("next_due_at") is not None
    ]
    if not candidates:
        logger.info("[PM JOBS] No new overdue PMs to report.")
        return 0

    already = {
        (a.fixture_id, a.pm_type, a.due_at.replace(tzinfo=a.due_at.tzinfo or timezone.utc))
        for a in db.query(models.PMOverdueAlert)
        .filter(models.PMOverdueAlert.fixture_id.in_({f.fixture_id for f, _, _ in candidates}))
        .all()
    }
    fresh = []
    for fixture, pm_type, entry in candidates:
        due = entry["next_due_at"]
        due = due if due.tzinfo else due.replace(tzinfo=timezone.utc)
        if (fixture.fixture_id, pm_type, due) in already:
            continue
        db.add(models.PMOverdueAlert(fixture_id=fixture.fixture_id, pm_type=pm_type, due_at=due))
        fresh.append((fixture, entry))
    if not fresh:
        db.commit()
        logger.info("[PM JOBS] Overdue PMs were already reported.")
        return 0

    fresh.sort(key=lambda t: t[1]["days_until_due"])

    def owner(fixture):
        person = employees.get(fixture.pm_assigned_employee_id)
        return person.employee_name if person else "someone"

    admin_lines = [f"{_describe(f, e)} — {owner(f)}" for f, e in fresh]
    title = f"{_plural(len(fresh), 'assigned PM')} overdue {threshold}+ days"
    admin_message = f"{'; '.join(_trim(admin_lines))}. Follow up with the people responsible."
    for admin in employees.values():
        if not is_admin(admin.employee_access_level):
            continue
        notify(db, admin.employee_id, "pm_overdue", title, admin_message, OVERDUE_TODO_LINK)
        if email_on and admin.employee_email:
            send_list_email(
                admin.employee_email,
                admin.employee_name,
                title,
                f"These assigned PMs are now {threshold} or more days overdue:",
                admin_lines,
                OVERDUE_TODO_LINK,
            )

    by_owner: dict[int, list] = {}
    for fixture, entry in fresh:
        by_owner.setdefault(fixture.pm_assigned_employee_id, []).append(_describe(fixture, entry))
    for employee_id, lines in by_owner.items():
        if employee_id not in employees:
            continue
        notify(
            db,
            employee_id,
            "pm_overdue",
            "1 of your PMs is overdue" if len(lines) == 1 else f"{len(lines)} of your PMs are overdue",
            f"{'; '.join(_trim(lines))}. Your admins have been told. Please do these PMs as soon as you can.",
            MY_PMS_LINK,
        )
    db.commit()
    logger.info("[PM JOBS] Reported %s newly overdue PMs.", len(fresh))
    return len(fresh)

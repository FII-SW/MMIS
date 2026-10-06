"""Audit log: who changed what. Entries are added to the caller's session and saved with its commit,
so a failed change never leaves an audit entry behind."""
import json

from .. import models


def _plain(value):
    return value if value is None or isinstance(value, (str, int, float, bool)) else str(value)


def changed_fields(obj, new_values: dict) -> dict:
    """{field: {"from": old, "to": new}} for every value in new_values that differs from obj."""
    changes = {}
    for field, new in new_values.items():
        old = getattr(obj, field, None)
        if _plain(old) != _plain(new):
            changes[field] = {"from": _plain(old), "to": _plain(new)}
    return changes


def log_action(
    db,
    actor,
    action: str,
    entity_type: str,
    entity_id,
    summary: str,
    details: dict | None = None,
) -> None:
    """actor: the token payload from get_current_user / require_admin, or an employee id."""
    employee_id = actor.get("employee_id") if isinstance(actor, dict) else actor
    db.add(
        models.AuditLog(
            employee_id=int(employee_id) if employee_id is not None else None,
            action=action,
            entity_type=entity_type,
            entity_id=None if entity_id is None else str(entity_id),
            summary=summary[:2000],
            details=json.dumps(details, default=str) if details else None,
        )
    )

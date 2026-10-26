"""Super Admin: edit the PM checklists without a code change."""
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..utils.audit import log_action
from ..utils.auth_deps import employee_id_from_token, require_super_admin
from ..utils.pm_checklists import (
    PM_TYPE_LABELS,
    _CHECKLISTS,
    checklist_item_ids,
    code_checklist_body,
    normalize_checklist_body,
)

router = APIRouter(prefix="/admin", tags=["Super Admin"])


class ChecklistSave(BaseModel):
    title: str | None = None
    description: str | None = None
    summary: str | None = None
    reference: str | None = None
    note: str | None = None
    sections: list[dict]


def _known(family: str, pm_type: str) -> tuple[str, str]:
    family = (family or "").strip().upper()
    pm_type = (pm_type or "").strip().lower()
    if pm_type not in _CHECKLISTS.get(family, {}):
        raise HTTPException(status_code=404, detail="That checklist is not configured")
    return family, pm_type


def _saved_row(db: Session, family: str, pm_type: str):
    return (
        db.query(models.PMChecklistTemplate)
        .filter(
            models.PMChecklistTemplate.family == family,
            models.PMChecklistTemplate.pm_type == pm_type,
        )
        .first()
    )


def _effective_body(db: Session, family: str, pm_type: str) -> tuple[dict, bool]:
    row = _saved_row(db, family, pm_type)
    if row and row.body:
        try:
            saved = json.loads(row.body)
        except ValueError:
            saved = None
        if isinstance(saved, dict) and saved.get("sections"):
            return saved, True
    return code_checklist_body(family, pm_type), False


def _serialize(db: Session, family: str, pm_type: str) -> dict:
    body, customized = _effective_body(db, family, pm_type)
    config = _CHECKLISTS[family][pm_type]
    return {
        "family": family,
        "pm_type": pm_type,
        "label": PM_TYPE_LABELS[pm_type],
        "requires_details": bool(config.get("details")),
        "customized": customized,
        "task_count": len(checklist_item_ids(body)),
        **body,
    }


def _blocked_removals(db: Session, pm_type: str, removed: set[str]) -> list[str]:
    if not removed:
        return []
    rows = (
        db.query(models.PMIssue.task)
        .filter(
            models.PMIssue.pm_type == pm_type,
            models.PMIssue.status == "open",
            models.PMIssue.item_id.in_(removed),
        )
        .distinct()
        .all()
    )
    return [row[0] for row in rows]


@router.get("/pm-checklists")
def list_pm_checklists(request: Request, db: Session = Depends(get_db)):
    require_super_admin(request)
    return {
        "checklists": [
            _serialize(db, family, pm_type)
            for family, types in _CHECKLISTS.items()
            for pm_type in types
        ]
    }


@router.put("/pm-checklists/{family}/{pm_type}")
def save_pm_checklist(
    family: str,
    pm_type: str,
    payload: ChecklistSave,
    request: Request,
    db: Session = Depends(get_db),
):
    actor = require_super_admin(request)
    family, pm_type = _known(family, pm_type)
    try:
        body = normalize_checklist_body(payload.model_dump() if hasattr(payload, "model_dump") else payload.dict())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    current, _customized = _effective_body(db, family, pm_type)
    removed = checklist_item_ids(current) - checklist_item_ids(body)
    blocked = _blocked_removals(db, pm_type, removed)
    if blocked:
        shown = "; ".join(blocked[:5])
        raise HTTPException(
            status_code=400,
            detail=(
                "These tasks still have open issues, so they can't be removed yet: "
                f"{shown}. Resolve the issues first, or leave the task on the checklist."
            ),
        )

    row = _saved_row(db, family, pm_type)
    if row is None:
        row = models.PMChecklistTemplate(family=family, pm_type=pm_type, body="{}")
        db.add(row)
    row.body = json.dumps(body)
    row.updated_at = datetime.now(timezone.utc)
    row.updated_by_employee_id = employee_id_from_token(actor)
    log_action(
        db,
        actor,
        "update",
        "pm_checklist",
        f"{family}:{pm_type}",
        f"Updated the {family} {PM_TYPE_LABELS[pm_type]} checklist ({len(checklist_item_ids(body))} tasks)",
    )
    db.commit()
    return _serialize(db, family, pm_type)


@router.delete("/pm-checklists/{family}/{pm_type}")
def reset_pm_checklist(family: str, pm_type: str, request: Request, db: Session = Depends(get_db)):
    actor = require_super_admin(request)
    family, pm_type = _known(family, pm_type)
    current, customized = _effective_body(db, family, pm_type)
    default = code_checklist_body(family, pm_type)
    removed = checklist_item_ids(current) - checklist_item_ids(default)
    blocked = _blocked_removals(db, pm_type, removed)
    if blocked:
        raise HTTPException(
            status_code=400,
            detail="Reset would remove tasks that still have open issues. Resolve those issues first.",
        )
    row = _saved_row(db, family, pm_type)
    if row is not None:
        db.delete(row)
    if customized:
        log_action(
            db,
            actor,
            "update",
            "pm_checklist",
            f"{family}:{pm_type}",
            f"Reset the {family} {PM_TYPE_LABELS[pm_type]} checklist to the built-in list",
        )
    db.commit()
    return _serialize(db, family, pm_type)

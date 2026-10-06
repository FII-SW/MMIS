# backend/app/routes/notifications.py
"""The signed-in employee's in-app notifications (bell icon)."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..utils.auth_deps import employee_id_from_token, get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _serialize(n: models.UserNotification) -> dict:
    return {
        "notification_id": n.notification_id,
        "kind": n.kind,
        "title": n.title,
        "message": n.message,
        "link": n.link,
        "created_at": n.created_at,
        "read": n.read_at is not None,
    }


@router.get("")
def my_notifications(request: Request, limit: int = Query(30, ge=1, le=100), db: Session = Depends(get_db)):
    employee_id = employee_id_from_token(get_current_user(request))
    mine = db.query(models.UserNotification).filter(models.UserNotification.employee_id == employee_id)
    unread = mine.filter(models.UserNotification.read_at.is_(None)).count()
    items = (
        mine.order_by(models.UserNotification.created_at.desc(), models.UserNotification.notification_id.desc())
        .limit(limit)
        .all()
    )
    return {"unread": unread, "items": [_serialize(n) for n in items]}


@router.post("/read-all")
def mark_all_read(request: Request, db: Session = Depends(get_db)):
    employee_id = employee_id_from_token(get_current_user(request))
    updated = (
        db.query(models.UserNotification)
        .filter(models.UserNotification.employee_id == employee_id, models.UserNotification.read_at.is_(None))
        .update({models.UserNotification.read_at: datetime.now(timezone.utc)}, synchronize_session=False)
    )
    db.commit()
    return {"updated": updated}


@router.post("/{notification_id}/read")
def mark_read(notification_id: int, request: Request, db: Session = Depends(get_db)):
    employee_id = employee_id_from_token(get_current_user(request))
    note = (
        db.query(models.UserNotification)
        .filter(
            models.UserNotification.notification_id == notification_id,
            models.UserNotification.employee_id == employee_id,
        )
        .first()
    )
    if not note:
        raise HTTPException(status_code=404, detail="Notification not found")
    if note.read_at is None:
        note.read_at = datetime.now(timezone.utc)
        db.commit()
    return _serialize(note)


@router.delete("")
def clear_read(request: Request, db: Session = Depends(get_db)):
    """Remove notifications already read (unread ones stay)."""
    employee_id = employee_id_from_token(get_current_user(request))
    deleted = (
        db.query(models.UserNotification)
        .filter(models.UserNotification.employee_id == employee_id, models.UserNotification.read_at.isnot(None))
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"deleted": deleted}

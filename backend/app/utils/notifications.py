"""In-app notifications. Added to the caller's session and saved with its commit."""
from .. import models

MY_PMS_LINK = "/dashboard/maintenance/dashboard?tab=mine"


def notify(db, employee_id: int, kind: str, title: str, message: str, link: str | None = None) -> None:
    db.add(
        models.UserNotification(
            employee_id=employee_id,
            kind=kind,
            title=title[:200],
            message=message,
            link=link,
        )
    )


def fixture_list(names: list[str], limit: int = 8) -> str:
    """'A, B, C and 12 more'"""
    shown = ", ".join(names[:limit])
    return f"{shown} and {len(names) - limit} more" if len(names) > limit else shown

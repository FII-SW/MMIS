"""System settings a Super Admin can change in the app (stored in app_settings).
A value saved in the app wins over the matching environment variable."""
from datetime import date

from fastapi import HTTPException

from .. import models

SETTINGS = {
    "pm_start_date": {
        "label": "PM tracking start date",
        "type": "date",
        "help": (
            "Work weeks before this date are never counted as overdue. Leave empty to start from the "
            "first PM ever recorded (or the MMIS_PM_START_DATE server setting)."
        ),
        "default": "",
    },
    "pm_assignment_emails": {
        "label": "Email people when PM fixtures are assigned to them",
        "type": "bool",
        "help": (
            "They always get an in-app notification. When this is on, people with an email address in MMIS "
            "also get an email listing the fixtures."
        ),
        "default": "true",
    },
    "pm_weekly_reminders": {
        "label": "Monday PM reminder to each person",
        "type": "bool",
        "help": (
            "Every Monday at 7:00 AM, each person with assigned fixtures gets a bell notification listing "
            "their PMs that are overdue or due soon (nothing is sent if they're all up to date)."
        ),
        "default": "true",
    },
    "pm_overdue_alerts": {
        "label": "Overdue alerts to admins",
        "type": "bool",
        "help": (
            "Every morning at 7:30 AM, admins and Super Admins get one notification listing assigned fixtures "
            "that became overdue by the number of days below. The assignee is told too. "
            "Each overdue PM is reported once."
        ),
        "default": "true",
    },
    "pm_overdue_alert_days": {
        "label": "Days overdue before alerting admins",
        "type": "int",
        "min": 1,
        "max": 60,
        "help": "How many days past due a PM must be before admins are alerted (1–60).",
        "default": "3",
    },
    "pm_reminder_emails": {
        "label": "Also email reminders and overdue alerts",
        "type": "bool",
        "help": "Send the Monday reminder and the overdue alerts by email too, to people with an email address.",
        "default": "true",
    },
    "low_stock_emails": {
        "label": "Daily low-stock email to admins",
        "type": "bool",
        "help": "At 11:59 PM, email every admin and super admin the list of items below their minimum count.",
        "default": "true",
    },
}


def setting_int(db, key: str) -> int:
    meta = SETTINGS[key]
    try:
        value = int(get_setting(db, key))
    except (TypeError, ValueError):
        value = int(meta["default"])
    return max(meta.get("min", value), min(meta.get("max", value), value))


def get_setting(db, key: str) -> str:
    row = db.query(models.AppSetting.value).filter(models.AppSetting.key == key).first()
    if row is None or row[0] is None:
        return SETTINGS[key]["default"]
    return row[0]


def setting_enabled(db, key: str) -> bool:
    return get_setting(db, key).strip().lower() in ("true", "1", "yes", "on")


def clean_setting(key: str, value) -> str:
    """Validate a value from the settings form and return how it is stored."""
    if key not in SETTINGS:
        raise HTTPException(status_code=400, detail=f"Unknown setting '{key}'")
    kind = SETTINGS[key]["type"]
    if kind == "bool":
        if isinstance(value, bool):
            return "true" if value else "false"
        text = str(value).strip().lower()
        if text not in ("true", "false"):
            raise HTTPException(status_code=400, detail=f"{SETTINGS[key]['label']} must be on or off")
        return text
    text = str(value or "").strip()
    if kind == "int":
        meta = SETTINGS[key]
        try:
            number = int(text)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"{meta['label']} must be a whole number")
        if not meta.get("min", number) <= number <= meta.get("max", number):
            raise HTTPException(
                status_code=400, detail=f"{meta['label']} must be between {meta['min']} and {meta['max']}"
            )
        return str(number)
    if kind == "date" and text:
        try:
            date.fromisoformat(text)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"{SETTINGS[key]['label']} must be a date (YYYY-MM-DD)")
    return text

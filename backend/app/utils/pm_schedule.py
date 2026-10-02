"""Calendar PM schedule: PMs are due per plant work week / month / quarter, not N days after the last one.

Weekly    - once every ISO work week (Monday-Sunday).
Biweekly  - within two work weeks: done in WW38 -> due by the end of WW40.
Monthly   - once every calendar month.
Quarterly - once every calendar quarter.
"""
import os
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

# (calendar unit, number of units in one PM period)
PM_SCHEDULE = {
    "weekly": ("week", 1),
    "biweekly": ("week", 2),
    "monthly": ("month", 1),
    "quarterly": ("quarter", 1),
}


def _plant_zone():
    try:
        return ZoneInfo(os.getenv("MMIS_PM_TIMEZONE", "America/Chicago").strip() or "America/Chicago")
    except (ZoneInfoNotFoundError, ValueError):
        return timezone.utc


PLANT_TZ = _plant_zone()


def _unit_start(day: date, unit: str) -> date:
    if unit == "week":
        return day - timedelta(days=day.weekday())
    if unit == "month":
        return day.replace(day=1)
    return date(day.year, 3 * ((day.month - 1) // 3) + 1, 1)


def _add_units(day: date, unit: str, count: int) -> date:
    if unit == "week":
        return day + timedelta(weeks=count)
    months = count * (3 if unit == "quarter" else 1)
    years, month_index = divmod(day.month - 1 + months, 12)
    return date(day.year + years, month_index + 1, 1)


def _end_of(day: date, tz) -> datetime:
    """Last second before local midnight starting `day`, in UTC."""
    midnight = datetime(day.year, day.month, day.day, tzinfo=tz)
    return (midnight - timedelta(seconds=1)).astimezone(timezone.utc)


def pm_due_at(
    pm_type: str,
    last: datetime | None,
    baseline: datetime | None,
    tz=None,
) -> datetime | None:
    """
    Due date for a PM type.
    last: latest (covering) PM record. The next one is due by the end of the following period.
    baseline: tracking start / resume date. With no record, the first PM is due by the end of
    the period containing it; after a resume it also pushes the due date to that period.
    """
    tz = tz or PLANT_TZ
    unit, count = PM_SCHEDULE[pm_type]
    candidates = []
    if last is not None:
        start = _unit_start(last.astimezone(tz).date(), unit)
        candidates.append(_add_units(start, unit, count + 1))
    if baseline is not None:
        start = _unit_start(baseline.astimezone(tz).date(), unit)
        candidates.append(_add_units(start, unit, count))
    return _end_of(max(candidates), tz) if candidates else None

"""Fixture lifecycle: Production / On Hold / Development.

On Hold and Development fixtures are excluded from PM overdue (same effect as PM pause).
When On Hold, a hold location is required: Warehouse, PM, or N/A.
"""
from sqlalchemy import and_, func

LIFECYCLE_PRODUCTION = "production"
LIFECYCLE_ON_HOLD = "on_hold"
LIFECYCLE_DEVELOPMENT = "development"
LIFECYCLE_STATUSES = (LIFECYCLE_PRODUCTION, LIFECYCLE_ON_HOLD, LIFECYCLE_DEVELOPMENT)
# Only Production counts toward PM overdue / due-soon attention.
PM_SUPPRESSED_STATUSES = (LIFECYCLE_ON_HOLD, LIFECYCLE_DEVELOPMENT)

HOLD_WAREHOUSE = "warehouse"
HOLD_PM = "pm"
HOLD_NA = "n_a"
HOLD_REASONS = (HOLD_WAREHOUSE, HOLD_PM, HOLD_NA)

LIFECYCLE_LABELS = {
    LIFECYCLE_PRODUCTION: "Production",
    LIFECYCLE_ON_HOLD: "On Hold",
    LIFECYCLE_DEVELOPMENT: "Development",
}
HOLD_LABELS = {
    HOLD_WAREHOUSE: "Warehouse",
    HOLD_PM: "PM",
    HOLD_NA: "N/A",
}


def normalize_lifecycle_status(value: str | None) -> str:
    text = (value or LIFECYCLE_PRODUCTION).strip().lower().replace(" ", "_").replace("-", "_")
    if text in ("hold", "onhold"):
        text = LIFECYCLE_ON_HOLD
    if text in ("dev",):
        text = LIFECYCLE_DEVELOPMENT
    if text not in LIFECYCLE_STATUSES:
        raise ValueError(f"Status must be Production, On Hold, or Development (got {value!r})")
    return text


def normalize_hold_reason(value: str | None, *, required: bool) -> str | None:
    if value is None or not str(value).strip():
        if required:
            raise ValueError("Select a hold location: Warehouse, PM, or N/A")
        return None
    text = str(value).strip().lower().replace(" ", "_").replace("-", "_").replace("/", "_")
    if text in ("na", "n/a", "none"):
        text = HOLD_NA
    if text not in HOLD_REASONS:
        raise ValueError("Hold location must be Warehouse, PM, or N/A")
    return text


def apply_lifecycle_fields(values: dict) -> dict:
    """Normalize lifecycle fields in a patch dict. Mutates and returns values."""
    if "lifecycle_status" not in values and "hold_reason" not in values:
        return values
    status = normalize_lifecycle_status(values.get("lifecycle_status"))
    values["lifecycle_status"] = status
    if status == LIFECYCLE_ON_HOLD:
        values["hold_reason"] = normalize_hold_reason(values.get("hold_reason"), required=True)
    else:
        values["hold_reason"] = None
    return values


def fixture_pm_suppressed(fixture) -> bool:
    """True when this fixture must not appear as PM overdue / due-soon attention."""
    return pm_suppress_state(fixture) is not None


def pm_suppress_state(fixture) -> str | None:
    """
    PM display state when overdue is suppressed, else None.
    Manual PM pause wins over lifecycle (paused > on_hold > development).
    """
    if getattr(fixture, "pm_paused", False):
        return "paused"
    status = (getattr(fixture, "lifecycle_status", None) or LIFECYCLE_PRODUCTION).strip().lower()
    if status == LIFECYCLE_ON_HOLD:
        return "on_hold"
    if status == LIFECYCLE_DEVELOPMENT:
        return "development"
    return None


def pm_active_sql_filter(Fixture):
    """SQLAlchemy filter: fixtures that still count toward PM overdue lists."""
    status = func.coalesce(Fixture.lifecycle_status, LIFECYCLE_PRODUCTION)
    return and_(Fixture.pm_paused.is_(False), status == LIFECYCLE_PRODUCTION)


def lifecycle_label(status: str | None) -> str:
    key = (status or LIFECYCLE_PRODUCTION).strip().lower()
    return LIFECYCLE_LABELS.get(key, LIFECYCLE_LABELS[LIFECYCLE_PRODUCTION])


def hold_label(reason: str | None) -> str | None:
    if not reason:
        return None
    return HOLD_LABELS.get(reason.strip().lower(), reason)

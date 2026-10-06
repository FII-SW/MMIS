"""Access levels. A Viewer can only look. A Super Admin can do everything an Admin can, plus user
management, permanent deletes, the audit log, system settings and PM assignments."""

VIEWER = "viewer"
USER = "user"
ADMIN = "admin"
SUPER_ADMIN = "superadmin"

ROLES = (VIEWER, USER, ADMIN, SUPER_ADMIN)
ROLE_LABELS = {VIEWER: "Viewer", USER: "User", ADMIN: "Admin", SUPER_ADMIN: "Super Admin"}


def normalize_role(role: str | None) -> str:
    """'Super Admin', 'super_admin', 'SUPERADMIN' -> 'superadmin'. Unknown values stay as typed (lowercase)."""
    value = str(role or "").strip().lower().replace("_", "").replace("-", "").replace(" ", "")
    return value if value in ROLES else str(role or "").strip().lower()


def is_admin(role: str | None) -> bool:
    return normalize_role(role) in (ADMIN, SUPER_ADMIN)


def is_super_admin(role: str | None) -> bool:
    return normalize_role(role) == SUPER_ADMIN


def can_edit(role: str | None) -> bool:
    """Everyone except a Viewer can request, return and record PMs."""
    return normalize_role(role) != VIEWER

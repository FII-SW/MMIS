import time

from fastapi import Request, HTTPException
from .jwt_handler import verify_access_token
from .roles import can_edit, is_admin, is_super_admin, normalize_role

# Role / active flag are re-read from the database (not trusted from the token) so a role change
# or deactivation applies within this many seconds instead of when the token expires.
ACCOUNT_CACHE_SECONDS = 30
_account_cache: dict[int, tuple[float, tuple[str, bool, bool] | None]] = {}

# The frontend matches this text to send the person to the Change Password page.
PASSWORD_CHANGE_REQUIRED = "Please change your temporary password before continuing."


def _password_change_allowed(request: Request) -> bool:
    """Requests that still work while a temporary password must be changed."""
    path = request.url.path.rstrip("/")
    if path.endswith("/change-password") or path.endswith("/auth/me"):
        return True
    return request.method == "GET" and ("/employees/" in path or path.endswith("/notifications"))


def _account_state(employee_id: int) -> tuple[str, bool, bool] | None:
    """(role, active, must_change_password)"""
    cached = _account_cache.get(employee_id)
    if cached and time.monotonic() - cached[0] < ACCOUNT_CACHE_SECONDS:
        return cached[1]

    from .. import models
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        row = (
            db.query(
                models.Employee.employee_access_level,
                models.Employee.employee_active,
                models.Employee.employee_must_change_password,
            )
            .filter(models.Employee.employee_id == employee_id)
            .first()
        )
    finally:
        db.close()
    state = (normalize_role(row[0]), row[1] is not False, bool(row[2])) if row else None
    _account_cache[employee_id] = (time.monotonic(), state)
    return state


def forget_account(employee_id: int) -> None:
    """Drop the cached role / active flag after an account is changed."""
    _account_cache.pop(employee_id, None)


def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization token")
    token = auth_header.split(" ", 1)[1].strip()
    payload = verify_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    employee_id = payload.get("employee_id")
    if employee_id is None:
        raise HTTPException(status_code=401, detail="Invalid token: missing employee_id")
    state = _account_state(int(employee_id))
    if state is None:
        raise HTTPException(status_code=401, detail="This account no longer exists")
    role, active, must_change_password = state
    if not active:
        raise HTTPException(status_code=401, detail="This account is deactivated. Contact your Super Admin.")
    if must_change_password and not _password_change_allowed(request):
        # Another worker may have just cleared the flag; re-check before blocking.
        forget_account(int(employee_id))
        state = _account_state(int(employee_id))
        must_change_password = bool(state and state[2])
        if must_change_password:
            raise HTTPException(status_code=403, detail=PASSWORD_CHANGE_REQUIRED)
    return {**payload, "role": role, "must_change_password": must_change_password}


def require_editor(request: Request) -> dict:
    """Any logged-in account that is allowed to make changes (everyone except a Viewer)."""
    payload = get_current_user(request)
    if not can_edit(payload.get("role")):
        raise HTTPException(
            status_code=403,
            detail="Your access is view-only. Ask your Super Admin if you need to make changes.",
        )
    return payload


def require_self_or_admin(request: Request, employee_id: int) -> dict:
    payload = get_current_user(request)
    if not is_admin(payload.get("role")) and payload.get("employee_id") != employee_id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this account")
    return payload


def require_admin(request: Request) -> dict:
    payload = get_current_user(request)
    if not is_admin(payload.get("role")):
        raise HTTPException(status_code=403, detail="Admin access required")
    return payload


def require_super_admin(request: Request) -> dict:
    payload = get_current_user(request)
    if not is_super_admin(payload.get("role")):
        raise HTTPException(status_code=403, detail="Super Admin access required")
    return payload


def employee_id_from_token(payload: dict) -> int:
    employee_id = payload.get("employee_id")
    if employee_id is None:
        raise HTTPException(status_code=401, detail="Invalid token: missing employee_id")
    return int(employee_id)

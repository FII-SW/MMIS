from fastapi import Request, HTTPException
from .jwt_handler import verify_access_token


def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization token")
    token = auth_header.split(" ", 1)[1].strip()
    payload = verify_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload


def require_self_or_admin(request: Request, employee_id: int) -> dict:
    payload = get_current_user(request)
    token_employee_id = payload.get("employee_id")
    role = str(payload.get("role", "")).lower()
    if role != "admin" and token_employee_id != employee_id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this account")
    return payload


def require_admin(request: Request) -> dict:
    payload = get_current_user(request)
    if str(payload.get("role", "")).lower() != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return payload


def employee_id_from_token(payload: dict) -> int:
    employee_id = payload.get("employee_id")
    if employee_id is None:
        raise HTTPException(status_code=401, detail="Invalid token: missing employee_id")
    return int(employee_id)

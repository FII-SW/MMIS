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

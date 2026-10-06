from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
import logging
from . import crud, models
from .database import get_db
from .utils.jwt_handler import create_access_token
from .utils.password_utils import verify_stored_password, normalize_password_for_storage, is_bcrypt_hash
from .utils.auth_deps import get_current_user
from .utils.roles import normalize_role

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    """Employee login using JSON data (not form-encoded)."""
    username = (credentials.username or "").strip()
    if not username or not credentials.password:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    user = crud.get_employee_by_username(db, username)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    try:
        password_ok = verify_stored_password(credentials.password, user.employee_password)
    except Exception:
        logger.exception("Password verification failed for user %s", username)
        raise HTTPException(status_code=500, detail="Login temporarily unavailable. Contact your admin.")

    if not password_ok:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if user.employee_active is False:
        raise HTTPException(status_code=403, detail="This account is deactivated. Contact your Super Admin.")

    # Upgrade legacy plain-text passwords to bcrypt on successful login
    if not is_bcrypt_hash(user.employee_password):
        user.employee_password = normalize_password_for_storage(credentials.password)
        db.commit()

    must_change = bool(user.employee_must_change_password)
    claims = {
        "sub": user.employee_username,
        "role": normalize_role(user.employee_access_level),
        "employee_id": user.employee_id,
    }
    if must_change:
        claims["pwd_change"] = True
    token = create_access_token(claims)

    return {"access_token": token, "token_type": "bearer", "must_change_password": must_change}


@router.get("/me")
def get_current_session(request: Request, db: Session = Depends(get_db)):
    """Validate the bearer token and return the signed-in employee."""
    payload = get_current_user(request)
    employee_id = payload.get("employee_id")
    if not employee_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    employee = db.query(models.Employee).filter(models.Employee.employee_id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return {
        "employee_id": employee.employee_id,
        "employee_name": employee.employee_name,
        "role": payload["role"],
        "must_change_password": bool(employee.employee_must_change_password),
    }

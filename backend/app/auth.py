from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from . import crud, models
from .database import get_db
from .utils.jwt_handler import create_access_token
from .utils.password_utils import verify_stored_password, normalize_password_for_storage, is_bcrypt_hash
from .utils.auth_deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    """Employee login using JSON data (not form-encoded)."""
    user = crud.get_employee_by_username(db, credentials.username)

    if not user or not verify_stored_password(credentials.password, user.employee_password):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Upgrade legacy plain-text passwords to bcrypt on successful login
    if not is_bcrypt_hash(user.employee_password):
        user.employee_password = normalize_password_for_storage(credentials.password)
        db.commit()

    token = create_access_token({
        "sub": user.employee_username,
        "role": user.employee_access_level,
        "employee_id": user.employee_id,
    })

    return {"access_token": token, "token_type": "bearer"}


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
        "role": employee.employee_access_level,
    }

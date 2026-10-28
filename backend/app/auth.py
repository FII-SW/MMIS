from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
import logging
import re
import secrets
from . import crud, models
from .database import get_db
from .utils.jwt_handler import create_access_token
from .utils.password_utils import verify_stored_password, normalize_password_for_storage, is_bcrypt_hash
from .utils.auth_deps import get_current_user
from .utils.audit import log_action
from .utils.notifications import notify
from .utils.roles import ROLE_LABELS, SUPER_ADMIN, VIEWER, normalize_role

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])

MIN_PASSWORD_LENGTH = 6
_USERNAME_RE = re.compile(r"^[A-Za-z0-9._-]{3,50}$")


class LoginRequest(BaseModel):
    username: str
    password: str


class SignupRequest(BaseModel):
    employee_name: str = Field(min_length=1, max_length=100)
    employee_username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=MIN_PASSWORD_LENGTH, max_length=128)
    employee_email: str | None = Field(default=None, max_length=255)
    employee_designation: str | None = Field(default=None, max_length=50)
    # Optional / legacy — form no longer collects these; badge is auto-assigned when omitted.
    employee_badge_number: str | None = Field(default=None, max_length=20)
    employee_shift: str | None = Field(default=None, max_length=20)


def _clean(value: str | None) -> str | None:
    value = (value or "").strip()
    return value or None


def _allocate_signup_badge(db: Session) -> str:
    """Unique placeholder badge (Super Admin can edit later)."""
    for _ in range(16):
        candidate = f"SG{secrets.token_hex(8)}"[:20]
        if not db.query(models.Employee).filter(models.Employee.employee_badge_number == candidate).first():
            return candidate
    raise HTTPException(status_code=500, detail="Could not allocate a badge number. Try again.")


def _resync_employee_id_sequence(db: Session) -> None:
    """Fix employees_pkey conflicts when the serial is behind MAX(employee_id)."""
    db.execute(
        text(
            "SELECT setval("
            "pg_get_serial_sequence('employees', 'employee_id'), "
            "GREATEST(COALESCE((SELECT MAX(employee_id) FROM employees), 1), 1), "
            "true)"
        )
    )


def _integrity_detail(exc: IntegrityError) -> str:
    return str(getattr(exc, "orig", None) or exc).lower()


def _is_username_conflict(detail: str) -> bool:
    return "employee_username" in detail or "employees_employee_username" in detail


def _is_badge_conflict(detail: str) -> bool:
    return "employee_badge" in detail or "employees_employee_badge" in detail


def _is_pkey_conflict(detail: str) -> bool:
    return "employees_pkey" in detail or "employee_id" in detail and "unique" in detail


def _username_taken(db: Session, username: str) -> bool:
    return (
        db.query(models.Employee)
        .filter(func.lower(models.Employee.employee_username) == username.lower())
        .first()
        is not None
    )


@router.post("/signup", status_code=201)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    """Public self-registration. New accounts always start as Viewer until a Super Admin raises access."""
    name = _clean(payload.employee_name)
    username = _clean(payload.employee_username)
    email = _clean(payload.employee_email)
    designation = _clean(payload.employee_designation)
    shift = _clean(payload.employee_shift)

    if not (name and username):
        raise HTTPException(status_code=400, detail="Name and username are required")
    if not _USERNAME_RE.match(username):
        raise HTTPException(
            status_code=400,
            detail="Username must be 3–50 characters: letters, numbers, dot, underscore, or hyphen",
        )
    if len(payload.password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(status_code=400, detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters")

    if _username_taken(db, username):
        raise HTTPException(status_code=400, detail=f"Username '{username}' is already taken")

    try:
        password_hash = normalize_password_for_storage(payload.password)
    except Exception:
        logger.exception("Self-signup password hashing failed for %s", username)
        raise HTTPException(status_code=500, detail="Could not secure the password. Please try again.")

    # Always assign a server-side badge — ignore any client value to avoid collisions.
    emp = None
    last_error = None
    for attempt in range(2):
        emp = models.Employee(
            employee_name=name,
            employee_username=username,
            employee_badge_number=_allocate_signup_badge(db),
            employee_password=password_hash,
            employee_access_level=VIEWER,
            employee_email=email,
            employee_designation=designation,
            employee_shift=shift,
            employee_active=True,
            employee_must_change_password=False,
        )
        try:
            db.add(emp)
            db.flush()
            last_error = None
            break
        except IntegrityError as exc:
            db.rollback()
            last_error = exc
            detail = _integrity_detail(exc)
            logger.warning("Self-signup IntegrityError for %s (attempt %s): %s", username, attempt + 1, detail)
            if _is_username_conflict(detail) or _username_taken(db, username):
                raise HTTPException(status_code=400, detail=f"Username '{username}' is already taken")
            if _is_pkey_conflict(detail):
                try:
                    _resync_employee_id_sequence(db)
                    db.commit()
                except Exception:
                    db.rollback()
                    logger.exception("Failed to resync employees employee_id sequence")
                continue
            if _is_badge_conflict(detail) and attempt == 0:
                continue
            break
        except Exception as exc:
            db.rollback()
            logger.exception("Self-signup failed while creating employee %s", username)
            raise HTTPException(
                status_code=500,
                detail=f"Could not create the account: {type(exc).__name__}. Please try again or contact an admin.",
            )

    if last_error is not None or emp is None or getattr(emp, "employee_id", None) is None:
        detail = _integrity_detail(last_error) if last_error else "unknown"
        logger.error("Self-signup gave up for %s: %s", username, detail)
        raise HTTPException(
            status_code=500,
            detail=(
                "Could not create the account (database constraint). "
                "Try a different username, or ask an admin to check the employees table / ID sequence."
            ),
        )

    log_action(
        db,
        None,
        "create",
        "user",
        emp.employee_id,
        f"Self-signup: {name} ({username}) as {ROLE_LABELS[VIEWER]}",
        {"source": "signup", "role": VIEWER},
    )

    try:
        super_admins = [
            admin.employee_id
            for admin in db.query(models.Employee).filter(models.Employee.employee_active.isnot(False)).all()
            if normalize_role(admin.employee_access_level) == SUPER_ADMIN
        ]
        for admin_id in super_admins:
            notify(
                db,
                admin_id,
                "signup",
                "New viewer signup",
                f"{name} ({username}) signed up with Viewer access. Change their access level in Super Admin → Users if needed.",
                "/dashboard/super-admin?tab=users",
            )
    except Exception:
        # Account should still succeed if bell notifications fail.
        logger.exception("Self-signup: could not notify Super Admins about %s", username)

    try:
        db.commit()
        db.refresh(emp)
    except IntegrityError as exc:
        db.rollback()
        detail = _integrity_detail(exc)
        logger.exception("Self-signup commit IntegrityError for %s: %s", username, detail)
        if _is_username_conflict(detail):
            raise HTTPException(status_code=400, detail=f"Username '{username}' is already taken")
        raise HTTPException(
            status_code=500,
            detail="Could not finish creating the account. Please try again with a different username.",
        )
    except Exception:
        db.rollback()
        logger.exception("Self-signup commit failed for %s", username)
        raise HTTPException(
            status_code=500,
            detail="Could not finish creating the account. Please try again.",
        )

    token = create_access_token(
        {
            "sub": emp.employee_username,
            "role": VIEWER,
            "employee_id": emp.employee_id,
        }
    )
    return {
        "message": "Account created. You have Viewer access until a Super Admin changes your role.",
        "access_token": token,
        "token_type": "bearer",
        "must_change_password": False,
        "role": VIEWER,
        "role_label": ROLE_LABELS[VIEWER],
    }


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

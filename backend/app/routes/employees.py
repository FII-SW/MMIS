# backend/app/routes/employees.py
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from ..database import get_db
from .. import schemas, models
from ..utils.password_utils import verify_stored_password, normalize_password_for_storage
from ..utils.auth_deps import require_self_or_admin

router = APIRouter(prefix="/employees", tags=["Employees"])


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


@router.get("/{employee_id}", response_model=schemas.EmployeeOut)
def get_employee(employee_id: int, db: Session = Depends(get_db)):
    emp = db.query(models.Employee).filter(models.Employee.employee_id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return emp


@router.put("/{employee_id}/change-password")
def change_password(
    employee_id: int,
    password_data: ChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Allow an employee to change their own password (admin may change any account)."""
    require_self_or_admin(request, employee_id)

    emp = db.query(models.Employee).filter(models.Employee.employee_id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    if not verify_stored_password(password_data.current_password, emp.employee_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    emp.employee_password = normalize_password_for_storage(password_data.new_password)
    db.commit()
    db.refresh(emp)

    return {"message": "Password changed successfully"}

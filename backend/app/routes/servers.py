# backend/app/routes/servers.py
"""FBT server inventory — project + FBT_Mobo / FBT_Agora."""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..utils.auth_deps import employee_id_from_token, get_current_user, require_admin
from ..utils.audit import log_action

router = APIRouter(prefix="/servers", tags=["Servers"])

SERVER_AREAS = schemas.SERVER_TEST_AREAS


def _get_or_404(db: Session, server_id: int) -> models.Server:
    row = db.query(models.Server).filter(models.Server.server_id == server_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Server not found")
    return row


@router.get("/", response_model=list[schemas.ServerOut])
def list_servers(
    request: Request,
    project: str | None = Query(None),
    test_area: str | None = Query(None),
    q: str | None = Query(None, description="Search model, serial, IP, switches, UPS"),
    db: Session = Depends(get_db),
):
    get_current_user(request)
    query = db.query(models.Server)
    if project:
        query = query.filter(models.Server.project_name == project.strip())
    if test_area:
        query = query.filter(models.Server.test_area == test_area.strip())
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(
                models.Server.server_model.ilike(like),
                models.Server.serial_number.ilike(like),
                models.Server.server_ip.ilike(like),
                models.Server.zpe_switch.ilike(like),
                models.Server.network_switch.ilike(like),
                models.Server.arista_switch.ilike(like),
                models.Server.ups.ilike(like),
                models.Server.notes.ilike(like),
            )
        )
    return (
        query.order_by(
            models.Server.project_name,
            models.Server.test_area,
            models.Server.server_model,
            models.Server.server_id,
        ).all()
    )


@router.get("/{server_id}", response_model=schemas.ServerOut)
def get_server(server_id: int, request: Request, db: Session = Depends(get_db)):
    get_current_user(request)
    return _get_or_404(db, server_id)


@router.post("/", response_model=schemas.ServerOut, status_code=201)
def create_server(
    payload: schemas.ServerCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    user = require_admin(request)
    employee_id = employee_id_from_token(user)
    row = models.Server(
        **payload.dict(),
        updated_by_employee_id=employee_id,
    )
    db.add(row)
    db.flush()
    log_action(
        db,
        user,
        "server.create",
        "server",
        str(row.server_id),
        f"Added server {row.server_model} ({row.project_name} · {row.test_area})",
    )
    db.commit()
    db.refresh(row)
    return row


@router.put("/{server_id}", response_model=schemas.ServerOut)
def update_server(
    server_id: int,
    payload: schemas.ServerUpdate,
    request: Request,
    db: Session = Depends(get_db),
):
    user = require_admin(request)
    employee_id = employee_id_from_token(user)
    row = _get_or_404(db, server_id)
    data = payload.dict(exclude_unset=True)
    if "server_model" in data and not data["server_model"]:
        raise HTTPException(status_code=400, detail="Server model is required")
    if "project_name" in data and not data["project_name"]:
        raise HTTPException(status_code=400, detail="Project is required")
    for key, value in data.items():
        setattr(row, key, value)
    row.updated_by_employee_id = employee_id
    log_action(
        db,
        user,
        "server.update",
        "server",
        str(row.server_id),
        f"Updated server {row.server_model} ({row.project_name} · {row.test_area})",
    )
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{server_id}", status_code=204)
def delete_server(server_id: int, request: Request, db: Session = Depends(get_db)):
    user = require_admin(request)
    row = _get_or_404(db, server_id)
    label = f"{row.server_model} ({row.project_name} · {row.test_area})"
    log_action(
        db,
        user,
        "server.delete",
        "server",
        str(server_id),
        f"Deleted server {label}",
    )
    db.delete(row)
    db.commit()
    return None

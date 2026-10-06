from pathlib import Path
from uuid import uuid4
import os
import shutil
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_

from .. import models, schemas
from ..database import get_db
from ..utils.audit import changed_fields, log_action
from ..utils.auth_deps import require_admin, require_super_admin

router = APIRouter(prefix="/documents", tags=["Documents"])

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".xls",
    ".xlsx",
    ".csv",
    ".ppt",
    ".pptx",
    ".doc",
    ".docx",
    ".txt",
    ".png",
    ".jpg",
    ".jpeg",
}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


def _get_upload_directory() -> Path:
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    upload_dir = Path(backend_dir) / "uploads" / "project_documents"
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir


def _require_admin(request: Request):
    try:
        return require_admin(request)
    except HTTPException as exc:
        if exc.status_code == 403:
            raise HTTPException(status_code=403, detail="Only admins can modify documents")
        raise


def _to_document_out(db: Session, document: models.ProjectDocument):
    uploader_name = None
    if document.uploaded_by_employee_id:
        uploader = (
            db.query(models.Employee)
            .filter(models.Employee.employee_id == document.uploaded_by_employee_id)
            .first()
        )
        uploader_name = uploader.employee_name if uploader else None

    return schemas.ProjectDocumentOut(
        document_id=document.document_id,
        document_scope=document.document_scope or "project",
        project_name=document.project_name,
        test_area=document.test_area,
        original_filename=document.original_filename,
        stored_filename=document.stored_filename,
        file_type=document.file_type,
        content_type=document.content_type,
        file_size=document.file_size,
        file_url=document.file_url,
        remarks=document.remarks,
        is_pinned=document.is_pinned,
        pinned_at=document.pinned_at,
        uploaded_by_employee_id=document.uploaded_by_employee_id,
        uploaded_by_name=uploader_name,
        created_at=document.created_at,
    )


@router.get("/", response_model=list[schemas.ProjectDocumentOut])
def list_documents(
    scope: str | None = Query(default=None),
    project: str | None = Query(default=None),
    test_area: str | None = Query(default=None),
    search: str | None = Query(default=None),
    doc_type: str | None = Query(default=None),
    include_common: bool = Query(default=True),
    db: Session = Depends(get_db),
):
    query = db.query(models.ProjectDocument, models.Employee.employee_name).outerjoin(
        models.Employee,
        models.Employee.employee_id == models.ProjectDocument.uploaded_by_employee_id,
    )

    if scope and scope.lower() in {"project", "common"}:
        query = query.filter(models.ProjectDocument.document_scope == scope.lower())
    if project:
        if include_common:
            query = query.filter(
                or_(
                    models.ProjectDocument.project_name == project,
                    models.ProjectDocument.document_scope == "common",
                )
            )
        else:
            query = query.filter(models.ProjectDocument.project_name == project)
    if test_area:
        query = query.filter(models.ProjectDocument.test_area == test_area)
    if doc_type and doc_type.lower() != "all":
        query = query.filter(models.ProjectDocument.file_type == doc_type.lower())
    if search:
        like_query = f"%{search}%"
        query = query.filter(
            models.ProjectDocument.original_filename.ilike(like_query)
            | models.ProjectDocument.project_name.ilike(like_query)
            | models.ProjectDocument.remarks.ilike(like_query)
            | models.Employee.employee_name.ilike(like_query)
        )

    rows = (
        query.order_by(
            models.ProjectDocument.is_pinned.desc(),
            models.ProjectDocument.pinned_at.desc(),
            models.ProjectDocument.created_at.desc(),
        )
        .all()
    )
    return [
        schemas.ProjectDocumentOut(
            document_id=doc.document_id,
            document_scope=doc.document_scope or "project",
            project_name=doc.project_name,
            test_area=doc.test_area,
            original_filename=doc.original_filename,
            stored_filename=doc.stored_filename,
            file_type=doc.file_type,
            content_type=doc.content_type,
            file_size=doc.file_size,
            file_url=doc.file_url,
            remarks=doc.remarks,
            is_pinned=doc.is_pinned,
            pinned_at=doc.pinned_at,
            uploaded_by_employee_id=doc.uploaded_by_employee_id,
            uploaded_by_name=employee_name,
            created_at=doc.created_at,
        )
        for doc, employee_name in rows
    ]


@router.post("/upload", response_model=schemas.ProjectDocumentOut)
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    document_scope: str = Form(default="project"),
    project_name: str | None = Form(default=None),
    test_area: str | None = Form(default=None),
    remarks: str | None = Form(default=None),
    db: Session = Depends(get_db),
):
    payload = _require_admin(request)
    scope_value = (document_scope or "project").strip().lower()
    if scope_value not in {"project", "common"}:
        raise HTTPException(status_code=400, detail="document_scope must be 'project' or 'common'")
    if scope_value == "project" and not (project_name or "").strip():
        raise HTTPException(status_code=400, detail="project_name is required for project documents")

    file_extension = Path(file.filename or "").suffix.lower()
    if file_extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    # Validate max size before writing.
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    if size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="File too large. Max size is 10MB")

    safe_name = f"{uuid4().hex}{file_extension}"
    upload_dir = _get_upload_directory()
    file_path = upload_dir / safe_name

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {exc}")

    file_type = file_extension.replace(".", "").lower()
    document = models.ProjectDocument(
        document_scope=scope_value,
        project_name=project_name.strip() if scope_value == "project" and project_name else None,
        test_area=test_area.strip() if test_area else None,
        original_filename=file.filename or safe_name,
        stored_filename=safe_name,
        file_type=file_type,
        content_type=file.content_type,
        file_size=size,
        file_url=f"/uploads/project_documents/{safe_name}",
        remarks=remarks.strip() if remarks else None,
        uploaded_by_employee_id=payload.get("employee_id"),
    )
    db.add(document)
    db.flush()
    log_action(
        db,
        payload,
        "upload",
        "document",
        document.document_id,
        f"Uploaded document {document.original_filename}"
        + (f" ({document.project_name})" if document.project_name else " (common)"),
    )
    db.commit()
    db.refresh(document)

    return _to_document_out(db, document)


@router.get("/{document_id}/download")
def download_document(document_id: int, db: Session = Depends(get_db)):
    document = (
        db.query(models.ProjectDocument)
        .filter(models.ProjectDocument.document_id == document_id)
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    upload_dir = _get_upload_directory()
    file_path = upload_dir / document.stored_filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Document file not found on server")

    return FileResponse(
        path=file_path,
        filename=document.original_filename,
        media_type=document.content_type or "application/octet-stream",
    )


@router.put("/{document_id}", response_model=schemas.ProjectDocumentOut)
def update_document(
    document_id: int,
    payload: schemas.ProjectDocumentUpdate,
    request: Request,
    db: Session = Depends(get_db),
):
    user = _require_admin(request)
    document = (
        db.query(models.ProjectDocument)
        .filter(models.ProjectDocument.document_id == document_id)
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    update_data = payload.dict(exclude_unset=True)
    if "document_scope" in update_data and update_data["document_scope"] is not None:
        update_data["document_scope"] = str(update_data["document_scope"]).strip().lower()
        if update_data["document_scope"] not in {"project", "common"}:
            raise HTTPException(status_code=400, detail="document_scope must be 'project' or 'common'")

    changes = changed_fields(document, update_data)
    if changes:
        log_action(
            db, user, "update", "document", document_id,
            f"Edited document {document.original_filename}", {"changes": changes},
        )
    for key, value in update_data.items():
        setattr(document, key, value)

    if document.document_scope == "common":
        document.project_name = None
    elif document.document_scope == "project" and not (document.project_name or "").strip():
        raise HTTPException(status_code=400, detail="project_name is required for project documents")

    db.commit()
    db.refresh(document)

    return _to_document_out(db, document)


@router.put("/{document_id}/pin", response_model=schemas.ProjectDocumentOut)
def pin_document(
    document_id: int,
    payload: schemas.ProjectDocumentPinUpdate,
    request: Request,
    db: Session = Depends(get_db),
):
    user = _require_admin(request)
    document = (
        db.query(models.ProjectDocument)
        .filter(models.ProjectDocument.document_id == document_id)
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if bool(document.is_pinned) != bool(payload.is_pinned):
        log_action(
            db, user, "pin" if payload.is_pinned else "unpin", "document", document_id,
            f"{'Pinned' if payload.is_pinned else 'Unpinned'} document {document.original_filename}",
        )
    document.is_pinned = bool(payload.is_pinned)
    document.pinned_at = datetime.now(timezone.utc) if payload.is_pinned else None
    db.commit()
    db.refresh(document)
    return _to_document_out(db, document)


@router.delete("/{document_id}")
def delete_document(document_id: int, request: Request, db: Session = Depends(get_db)):
    """Permanently delete a document (Super Admin)."""
    user = require_super_admin(request)
    document = (
        db.query(models.ProjectDocument)
        .filter(models.ProjectDocument.document_id == document_id)
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    upload_dir = _get_upload_directory()
    file_path = upload_dir / document.stored_filename
    if file_path.exists() and file_path.is_file():
        try:
            file_path.unlink()
        except Exception:
            # Continue deleting the DB record even if file cleanup fails.
            pass

    log_action(
        db, user, "delete", "document", document_id,
        f"Deleted document {document.original_filename}"
        + (f" ({document.project_name})" if document.project_name else " (common)"),
    )
    db.delete(document)
    db.commit()
    return {"message": "Document deleted successfully"}

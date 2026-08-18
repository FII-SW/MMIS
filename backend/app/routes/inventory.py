from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from sqlalchemy.orm import Session
from .. import crud, schemas, models
from ..database import get_db
from ..utils.auth_deps import get_current_user, require_admin, employee_id_from_token
from ..utils.inventory_rules import project_requires_test_area
import os
import shutil
import uuid
from pathlib import Path
from typing import Optional


def _uploads_base_dir() -> Path:
    backend_dir = Path(__file__).resolve().parents[2]
    return backend_dir / "uploads"


def _item_images_dir() -> Path:
    return _uploads_base_dir() / "item_images"


def _safe_path_under(base: Path, relative_url: str) -> Optional[Path]:
    if not relative_url:
        return None
    rel = relative_url.lstrip("/")
    if rel.startswith("uploads/"):
        rel = rel[len("uploads/") :]
    candidate = (base / rel).resolve()
    try:
        candidate.relative_to(base.resolve())
    except ValueError:
        return None
    return candidate


router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get("/", response_model=list[schemas.InventoryOut])
def get_inventory(
    project: str | None = None,
    test_area: str | None = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Inventory)

    if project:
        query = query.filter(models.Inventory.project_name == project)

    if test_area:
        query = query.filter(models.Inventory.test_area == test_area)

    return query.order_by(models.Inventory.item_name).all()


@router.get("/{item_id}", response_model=schemas.InventoryOut)
def get_single_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(models.Inventory).filter(models.Inventory.item_id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.post("/")
def add_inventory(data: dict, request: Request, db: Session = Depends(get_db)):
    """Add new inventory item (admin only). Always inserts a new row for every project."""
    admin = require_admin(request)
    employee_id = employee_id_from_token(admin)
    def _require_text(field: str, label: str):
        value = data.get(field)
        if value is None or not str(value).strip():
            raise HTTPException(status_code=400, detail=f"{label} is required")

    _require_text("item_name", "Item name")
    _require_text("project_name", "Project name")
    _require_text("item_part_number", "Part number")

    project_name = str(data.get("project_name", "")).strip()
    test_area_raw = data.get("test_area")
    test_area = str(test_area_raw).strip() if test_area_raw is not None else ""

    if project_requires_test_area(project_name) and not test_area:
        raise HTTPException(status_code=400, detail="Test area is required for this project")

    data["test_area"] = test_area or None

    # Normalize fields before insert (same rules for every project and test area)
    for field in ("item_name", "project_name", "item_part_number", "item_description"):
        raw = data.get(field)
        if raw is not None:
            data[field] = str(raw).strip() or None
    if data.get("item_name") is None:
        raise HTTPException(status_code=400, detail="Item name is required")

    data.pop("confirm_merge", None)

    if data.get("item_current_quantity") is None:
        raise HTTPException(status_code=400, detail="Current quantity is required")
    try:
        qty = int(data.get("item_current_quantity"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Current quantity must be a valid number")
    if qty < 0:
        raise HTTPException(status_code=400, detail="Current quantity must be 0 or greater")

    # Extract employee_id from JWT (ignore client-supplied value)
    data.pop("employee_id", None)
    
    # Create InventoryBase from the data
    item_data = {k: v for k, v in data.items() if k != "employee_id"}
    item = schemas.InventoryBase(**item_data)

    # Get first available fixture before creating inventory (needed for transaction)
    default_fixture = None
    if employee_id:
        default_fixture = db.query(models.Fixture).first()
        if not default_fixture:
            raise HTTPException(status_code=400, detail="No fixtures available. Please create at least one fixture.")

    db_item = crud.insert_new_inventory_item(db, item)

    # Create transaction record if employee_id is provided (for activity history)
    if employee_id and default_fixture:
        transaction = models.Transaction(
            item_id=db_item.item_id,
            employee_id=employee_id,
            fixture_id=default_fixture.fixture_id,
            quantity_used=item.item_current_quantity,
            transaction_type="restock",
            remarks="New item added",
            test_area=item.test_area,
            project_name=item.project_name,
        )
        db.add(transaction)
        db.commit()
        db.refresh(db_item)

    return {
        "item_id": db_item.item_id,
        "item_name": db_item.item_name,
        "item_description": db_item.item_description,
        "item_part_number": db_item.item_part_number,
        "item_current_quantity": db_item.item_current_quantity,
        "item_min_count": db_item.item_min_count,
        "item_unit": db_item.item_unit,
        "item_unit_price": db_item.item_unit_price,
        "item_manufacturer": db_item.item_manufacturer,
        "item_type": db_item.item_type,
        "test_area": db_item.test_area,
        "project_name": db_item.project_name,
        "item_life_cycle": db_item.item_life_cycle,
        "item_image_url": db_item.item_image_url,
        "created_at": db_item.created_at,
        "is_new_item": True,
        "message": "New item created",
    }


@router.put("/{item_id}")
def update_inventory(item_id: int, item: schemas.InventoryBase, request: Request, db: Session = Depends(get_db)):
    """Update an existing inventory item by ID (admin only)."""
    require_admin(request)
    db_item = db.query(models.Inventory).filter(models.Inventory.item_id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Update all fields except quantity (quantity is handled by restock endpoint)
    # item_image_url is only set via dedicated upload endpoints
    update_data = item.dict(exclude={"item_current_quantity", "item_image_url"})
    for key, value in update_data.items():
        if value is not None:
            setattr(db_item, key, value)
    
    db.commit()
    db.refresh(db_item)
    return db_item



@router.post("/request")
def request_item(data: schemas.RequestCreate, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request)
    employee_id = employee_id_from_token(user)

    item_id = data.item_id
    qty = data.quantity

    if qty <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than 0")

    # Lock the row to prevent race conditions
    item = (
        db.query(models.Inventory)
        .filter(models.Inventory.item_id == item_id)
        .with_for_update()
        .first()
    )

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Check if current project has enough stock
    if item.item_current_quantity >= qty:
        # Normal request - enough stock in current project
        item.item_current_quantity -= qty
        
        transaction = models.Transaction(
            item_id=item_id,
            employee_id=employee_id,
            fixture_id=data.fixture_id,
            quantity_used=qty,
            test_area=item.test_area,
            project_name=item.project_name,
            transaction_type="request",
        )
        
        db.add(transaction)
        db.commit()
        
        return {
            "message": "Request successful", 
            "new_quantity": item.item_current_quantity,
            "transfer_used": False
        }
    
    # Not enough stock in current project - check other projects for same catalog item
    other_project_candidates = (
        db.query(models.Inventory)
        .filter(
            models.Inventory.item_id != item_id,
            models.Inventory.item_current_quantity > 0,
        )
        .order_by(models.Inventory.item_current_quantity.desc())
        .all()
    )
    available_in_other_projects = [
        c for c in other_project_candidates if crud.is_same_catalog_item(item, c)
    ]
    
    if not available_in_other_projects:
        raise HTTPException(
            status_code=400, 
            detail=f"Not enough stock. Available: {item.item_current_quantity}, Requested: {qty}. No stock available in other projects."
        )
    
    # Calculate how much we need from other projects
    remaining_needed = qty - item.item_current_quantity
    used_from_current = item.item_current_quantity
    
    # Transfer from other projects first
    transfers_made = []
    total_transferred = 0
    
    for source_item in available_in_other_projects:
        if total_transferred >= remaining_needed:
            break
            
        # Lock the source item
        source_item_locked = (
            db.query(models.Inventory)
            .filter(models.Inventory.item_id == source_item.item_id)
            .with_for_update()
            .first()
        )
        
        if not source_item_locked or source_item_locked.item_current_quantity == 0:
            continue
        
        transfer_qty = min(
            source_item_locked.item_current_quantity,
            remaining_needed - total_transferred
        )
        
        # Deduct from source project
        source_item_locked.item_current_quantity -= transfer_qty
        
        # Add to destination project
        item.item_current_quantity += transfer_qty
        
        # Create transfer transaction for source project
        transfer_tx_source = models.Transaction(
            item_id=source_item_locked.item_id,
            employee_id=employee_id,
            fixture_id=data.fixture_id,
            quantity_used=transfer_qty,
            test_area=source_item_locked.test_area,
            project_name=source_item_locked.project_name,
            transaction_type="transfer_out",
            remarks=f"Transferred to {item.project_name} project. Request ID: {item_id}"
        )
        db.add(transfer_tx_source)
        
        # Create transfer transaction for destination project
        transfer_tx_dest = models.Transaction(
            item_id=item_id,
            employee_id=employee_id,
            fixture_id=data.fixture_id,
            quantity_used=transfer_qty,
            test_area=item.test_area,
            project_name=item.project_name,
            transaction_type="transfer_in",
            remarks=f"Transferred from {source_item_locked.project_name} project. Source Item ID: {source_item_locked.item_id}"
        )
        db.add(transfer_tx_dest)
        
        transfers_made.append({
            "from_project": source_item_locked.project_name,
            "from_item_id": source_item_locked.item_id,
            "quantity": transfer_qty
        })
        
        total_transferred += transfer_qty
    
    # Now deduct the full requested quantity from destination
    # (which now has original stock + transferred items)
    item.item_current_quantity -= qty
    
    # Create final request transaction for the full quantity
    final_request_tx = models.Transaction(
        item_id=item_id,
        employee_id=employee_id,
        fixture_id=data.fixture_id,
        quantity_used=qty,
        test_area=item.test_area,
        project_name=item.project_name,
        transaction_type="request",
        remarks=f"Fulfilled via cross-project transfer. Used {used_from_current} from current project, {total_transferred} transferred from other projects."
    )
    db.add(final_request_tx)
    
    db.commit()
    db.refresh(item)
    
    return {
        "message": "Request fulfilled with cross-project transfer",
        "new_quantity": item.item_current_quantity,
        "transfer_used": True,
        "used_from_current": used_from_current,
        "transferred_from_other_projects": total_transferred,
        "transfers": transfers_made
    }


@router.post("/restock")
def restock_item(data: dict, request: Request, db: Session = Depends(get_db)):
    """Restock an item by adding quantity (admin only)."""
    admin = require_admin(request)
    employee_id = employee_id_from_token(admin)

    item_id = data.get("item_id")
    quantity = data.get("quantity")
    remarks = data.get("remarks", "")

    if not item_id or quantity is None:
        raise HTTPException(status_code=400, detail="item_id and quantity are required")

    if quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than 0")

    # Lock the row to prevent race conditions
    item = (
        db.query(models.Inventory)
        .filter(models.Inventory.item_id == item_id)
        .with_for_update()
        .first()
    )

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Add quantity
    item.item_current_quantity += quantity
    
    # Create transaction record for restock
    # Use first available fixture as default for restock (restock doesn't require a specific fixture)
    default_fixture = db.query(models.Fixture).first()
    if not default_fixture:
        # If no fixtures exist, create a dummy transaction without fixture
        # But since fixture_id is required, we'll need at least one fixture
        # For now, raise an error or use a workaround
        raise HTTPException(status_code=400, detail="No fixtures available. Please create at least one fixture.")
    
    fixture_id = default_fixture.fixture_id
    
    transaction = models.Transaction(
        item_id=item_id,
        employee_id=employee_id,
        fixture_id=fixture_id,
        quantity_used=quantity,
        transaction_type="restock",
        remarks=remarks,
        test_area=item.test_area,
        project_name=item.project_name,
    )
    
    db.add(transaction)
    db.commit()
    db.refresh(item)

    return {"message": "Restock successful", "new_quantity": item.item_current_quantity}


@router.post("/upload-image")
async def upload_item_image(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload an image file and return the URL path (admin only)."""
    require_admin(request)
    upload_dir = _item_images_dir()
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Validate file type
    allowed_extensions = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
    file_extension = Path(file.filename or "").suffix.lower()

    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed types: {', '.join(allowed_extensions)}",
        )

    safe_filename = f"{uuid.uuid4().hex}{file_extension}"
    file_path = upload_dir / safe_filename
    
    # Save file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Return the URL path
    image_url = f"/uploads/item_images/{safe_filename}"
    return {"image_url": image_url, "filename": safe_filename}


@router.post("/upload-image/{item_id}")
async def upload_and_update_item_image(
    item_id: int,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload an image for a specific inventory item and update the database (admin only)."""
    require_admin(request)
    # Verify item exists
    item = db.query(models.Inventory).filter(models.Inventory.item_id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Get the backend directory
    upload_dir = _item_images_dir()
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Validate file type
    allowed_extensions = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
    file_extension = Path(file.filename or "").suffix.lower()

    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed types: {', '.join(allowed_extensions)}",
        )

    # Generate filename using item_id to ensure uniqueness
    safe_filename = f"item_{item_id}{file_extension}"
    file_path = upload_dir / safe_filename

    # Delete old image if it exists (only under uploads/)
    if item.item_image_url:
        old_image_path = _safe_path_under(_uploads_base_dir(), item.item_image_url)
        if old_image_path and old_image_path.exists() and old_image_path.is_file():
            try:
                old_image_path.unlink()
            except Exception:
                pass
    
    # Save new file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Update item with image URL
    item.item_image_url = f"/uploads/item_images/{safe_filename}"
    db.commit()
    db.refresh(item)
    
    return {"message": "Image uploaded successfully", "image_url": item.item_image_url}


# New endpoint to get available items from other projects
@router.get("/{item_id}/alternatives")
def get_alternative_items(item_id: int, db: Session = Depends(get_db)):
    """Get the same item from other projects that have stock available."""
    item = db.query(models.Inventory).filter(models.Inventory.item_id == item_id).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Find same catalog items in other projects
    candidates = (
        db.query(models.Inventory)
        .filter(
            models.Inventory.item_id != item_id,
            models.Inventory.item_current_quantity > 0,
        )
        .order_by(models.Inventory.item_current_quantity.desc())
        .all()
    )
    alternatives = [c for c in candidates if crud.is_same_catalog_item(item, c)]

    return alternatives


# New endpoint for explicit transfer between projects
@router.post("/transfer")
def transfer_item(data: dict, request: Request, db: Session = Depends(get_db)):
    """Explicitly transfer items from one project to another (admin only)."""
    admin = require_admin(request)
    employee_id = employee_id_from_token(admin)

    source_item_id = data.get("source_item_id")
    dest_item_id = data.get("dest_item_id")
    quantity = data.get("quantity")
    fixture_id = data.get("fixture_id")
    remarks = data.get("remarks", "")

    if not all([source_item_id, dest_item_id, quantity, fixture_id]):
        raise HTTPException(status_code=400, detail="Missing required fields")
    
    if quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than 0")
    
    # Lock both items
    source_item = (
        db.query(models.Inventory)
        .filter(models.Inventory.item_id == source_item_id)
        .with_for_update()
        .first()
    )
    
    dest_item = (
        db.query(models.Inventory)
        .filter(models.Inventory.item_id == dest_item_id)
        .with_for_update()
        .first()
    )
    
    if not source_item or not dest_item:
        raise HTTPException(status_code=404, detail="Source or destination item not found")
    
    if not crud.is_same_catalog_item(source_item, dest_item):
        raise HTTPException(
            status_code=400,
            detail="Items must have the same name, part number, and description",
        )
    
    if source_item.item_current_quantity < quantity:
        raise HTTPException(
            status_code=400, 
            detail=f"Insufficient stock. Available: {source_item.item_current_quantity}, Requested: {quantity}"
        )
    
    # Perform transfer
    source_item.item_current_quantity -= quantity
    dest_item.item_current_quantity += quantity
    
    # Create transactions
    transfer_out_tx = models.Transaction(
        item_id=source_item_id,
        employee_id=employee_id,
        fixture_id=fixture_id,
        quantity_used=quantity,
        test_area=source_item.test_area,
        project_name=source_item.project_name,
        transaction_type="transfer_out",
        remarks=f"Transferred to {dest_item.project_name}. {remarks}"
    )
    
    transfer_in_tx = models.Transaction(
        item_id=dest_item_id,
        employee_id=employee_id,
        fixture_id=fixture_id,
        quantity_used=quantity,
        test_area=dest_item.test_area,
        project_name=dest_item.project_name,
        transaction_type="transfer_in",
        remarks=f"Transferred from {source_item.project_name}. {remarks}"
    )
    
    db.add(transfer_out_tx)
    db.add(transfer_in_tx)
    db.commit()
    db.refresh(source_item)
    db.refresh(dest_item)
    
    return {
        "message": "Transfer successful",
        "source_quantity": source_item.item_current_quantity,
        "dest_quantity": dest_item.item_current_quantity
    }
    

# backend/app/crud.py
# --------------------------------------------------------------
# Contains all database helper functions for employees, inventory,
# transactions, and reports. Each function receives a SQLAlchemy
# session and performs the necessary DB operation.
# --------------------------------------------------------------

from sqlalchemy.orm import Session
from sqlalchemy import func
from . import models, schemas
from datetime import date, timedelta

# ---------------- Employee ----------------
def create_employee(db: Session, emp: schemas.EmployeeCreate, hashed_pw: str):
    """Create a new employee record."""
    new_emp = models.Employee(
        employee_badge_number=emp.employee_badge_number,
        employee_name=emp.employee_name,
        employee_designation=emp.employee_designation,
        employee_shift=emp.employee_shift,
        employee_access_level=emp.employee_access_level,
        employee_username=emp.employee_username,
        employee_password=hashed_pw,
        employee_email=emp.employee_email
    )
    db.add(new_emp)
    db.commit()
    db.refresh(new_emp)
    return new_emp

def get_employee_by_username(db: Session, username: str):
    """Find employee by username for login."""
    return db.query(models.Employee).filter(models.Employee.employee_username == username).first()

def get_admin_users(db: Session):
    """Get all admin users with email addresses."""
    return db.query(models.Employee).filter(
        models.Employee.employee_access_level == "admin",
        models.Employee.employee_email.isnot(None)
    ).all()

# ---------------- Inventory ----------------
def get_all_inventory(db: Session):
    """Return the entire inventory list."""
    return db.query(models.Inventory).order_by(models.Inventory.item_name).all()

def get_filtered_inventory(db: Session, project: str | None, test_area: str | None):
    """Return inventory filtered by project and/or test area."""
    query = db.query(models.Inventory)

    if project:
        query = query.filter(models.Inventory.project_name == project)

    if test_area:
        query = query.filter(models.Inventory.test_area == test_area)

    return query.order_by(models.Inventory.item_name).all()
 

def get_item(db: Session, item_id: int):
    """Return a single inventory item."""
    return db.query(models.Inventory).filter(models.Inventory.item_id == item_id).first()

def _normalize_inventory_field(value) -> str:
    """Normalize text fields for identity comparison (None and blank treated as empty)."""
    if value is None:
        return ""
    return str(value).strip()


def _inventory_identity_key(item) -> tuple:
    """Identity tuple: all must match to treat as the same inventory record."""
    return (
        _normalize_inventory_field(item.item_name),
        _normalize_inventory_field(item.project_name),
        _normalize_inventory_field(item.test_area),
        _normalize_inventory_field(item.item_part_number),
        _normalize_inventory_field(item.item_description),
    )


def inventory_catalog_key(item) -> tuple:
    """Catalog identity across projects (name, part number, description)."""
    return (
        _normalize_inventory_field(item.item_name),
        _normalize_inventory_field(item.item_part_number),
        _normalize_inventory_field(item.item_description),
    )


def is_same_catalog_item(source, candidate) -> bool:
    """True when candidate is the same catalog item in another location."""
    if source.item_id == candidate.item_id:
        return False
    return inventory_catalog_key(source) == inventory_catalog_key(candidate)


def find_matching_inventory(db: Session, item: schemas.InventoryBase):
    """
    Find an existing row that matches on name, project, test area, part number, and description.
    Returns None if any identity field differs (those cases must create a new item).

    Scoped by project first, then compared in Python so NULL/empty test areas and all
    test area values (ICT_Mobo, FBT_Agora, etc.) behave consistently for every project.
    """
    key = _inventory_identity_key(item)
    if not key[0] or not key[1]:
        return None

    candidates = (
        db.query(models.Inventory)
        .filter(models.Inventory.project_name == item.project_name)
        .all()
    )

    for db_item in candidates:
        if _inventory_identity_key(db_item) == key:
            return db_item
    return None


def create_inventory_item(db: Session, item: schemas.InventoryBase, *, confirm_merge: bool = False):
    """
    Insert a new inventory row.

    Only merges quantity when ALL identity fields match AND confirm_merge=True
    (user intentionally adding to an exact duplicate). Otherwise always creates a new row.

    Returns (db_item, is_new_item).
    """
    existing = find_matching_inventory(db, item)
    if existing:
        if confirm_merge:
            existing.item_current_quantity += item.item_current_quantity
            db.commit()
            db.refresh(existing)
            return existing, False
        raise ValueError(
            f"DUPLICATE_ITEM:{existing.item_id}:{existing.item_current_quantity}"
        )

    payload = item.model_dump() if hasattr(item, "model_dump") else item.dict()
    db_item = models.Inventory(**payload)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item, True


def create_or_update_inventory(db: Session, item: schemas.InventoryBase):
    """Deprecated alias — always creates; use create_inventory_item with confirm_merge for merges."""
    return create_inventory_item(db, item, confirm_merge=False)

def subtract_item_quantity(db: Session, item_id: int, qty: int):
    """Decrease item quantity atomically (for Request)."""
    item = get_item(db, item_id)
    if not item or item.item_current_quantity < qty:
        return None
    item.item_current_quantity -= qty
    db.commit()
    db.refresh(item)
    return item

def add_item_quantity(db: Session, item_id: int, qty: int):
    """Increase item quantity atomically (for Return)."""
    item = get_item(db, item_id)
    if not item:
        return None
    item.item_current_quantity += qty
    db.commit()
    db.refresh(item)
    return item

def get_low_stock_items(db: Session):
    """List items below their minimum count."""
    return db.query(models.Inventory).filter(models.Inventory.item_current_quantity < models.Inventory.item_min_count).all()

# ---------------- Transactions ----------------
def create_transaction(db: Session, t: schemas.TransactionBase):
    """Create a transaction record."""
    tx = models.Transaction(
        item_id=t.item_id,
        employee_id=t.employee_id,
        fixture_id=t.fixture_id,
        quantity_used=t.quantity_used,
        transaction_type=t.transaction_type,
        remarks=t.remarks,
        test_area=t.test_area,
        project_name=t.project_name
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx

def get_all_transactions(db: Session):
    result = (
        db.query(
            models.Transaction.transaction_id,
            models.Transaction.transaction_type,
            models.Transaction.quantity_used,
            models.Transaction.created_at,
            models.Inventory.item_name,
            models.Inventory.item_part_number,
            models.Inventory.item_description,
            models.Inventory.item_manufacturer,
            models.Inventory.test_area,
            models.Inventory.project_name,
            models.Fixture.fixture_name,
            models.Employee.employee_name,
            models.Transaction.fixture_id,
            models.Transaction.item_id,
        )
        .join(models.Inventory, models.Transaction.item_id == models.Inventory.item_id)
        .join(models.Fixture, models.Transaction.fixture_id == models.Fixture.fixture_id)
        .join(models.Employee, models.Transaction.employee_id == models.Employee.employee_id)
        .order_by(models.Transaction.created_at.desc())
        .all()
    )

    # Convert row tuples to dicts
    transactions = []
    for row in result:
        transactions.append({
            "transaction_id": row[0],
            "transaction_type": row[1],
            "quantity_used": row[2],
            "created_at": row[3],
            "item_name": row[4],
            "item_part_number": row[5],
            "item_description": row[6],
            "item_manufacturer": row[7],
            "test_area": row[8],
            "project_name": row[9],
            "fixture_name": row[10],
            "employee_name": row[11],
        })

    return transactions



def get_transactions_by_employee(db: Session, emp_id: int):
    rows = (
        db.query(
            models.Transaction.transaction_id.label("transaction_id"),
            models.Transaction.item_id.label("item_id"),
            models.Transaction.fixture_id.label("fixture_id"),
            models.Transaction.employee_id.label("employee_id"),
            models.Transaction.transaction_type.label("transaction_type"),
            models.Transaction.quantity_used.label("quantity_used"),
            models.Transaction.created_at.label("created_at"),

            models.Inventory.item_name.label("item_name"),
            models.Inventory.item_part_number.label("item_part_number"),
            models.Inventory.item_description.label("item_description"),
            models.Inventory.item_manufacturer.label("item_manufacturer"),
            models.Inventory.item_image_url.label("item_image_url"),
            models.Inventory.test_area.label("test_area"),
            models.Inventory.project_name.label("project_name"),

            models.Fixture.fixture_name.label("fixture_name"),
            models.Employee.employee_name.label("employee_name"),
        )
        .join(models.Inventory, models.Transaction.item_id == models.Inventory.item_id)
        .outerjoin(models.Fixture, models.Transaction.fixture_id == models.Fixture.fixture_id)  # LEFT JOIN for projects without fixtures
        .join(models.Employee, models.Transaction.employee_id == models.Employee.employee_id)
        .filter(models.Transaction.employee_id == emp_id)
        .filter(models.Transaction.transaction_type == "request")
        .order_by(models.Transaction.created_at.desc())
        .all()
    )

    # Convert tuple rows to dictionaries and filter out fully returned transactions
    transactions = []
    for row in rows:
        # Calculate total returned quantity for this SPECIFIC request transaction
        # First, try to match returns that explicitly reference this request_transaction_id in remarks
        # Format: "REQUEST_TX_ID:123|remarks" or "REQUEST_TX_ID:123"
        explicit_returns = (
            db.query(
                func.coalesce(func.sum(models.Transaction.quantity_used), 0)
            )
            .filter(models.Transaction.transaction_type == "return")
            .filter(models.Transaction.remarks.like(f"REQUEST_TX_ID:{row.transaction_id}%"))
            .scalar() or 0
        )
        
        # If no explicit returns found, fall back to the old matching logic
        # but only for returns that don't have a REQUEST_TX_ID in remarks (backward compatibility)
        if explicit_returns == 0:
            total_returned = (
                db.query(
                    func.coalesce(func.sum(models.Transaction.quantity_used), 0)
                )
                .filter(models.Transaction.item_id == row.item_id)
                .filter(models.Transaction.employee_id == row.employee_id)
                .filter(models.Transaction.fixture_id == row.fixture_id)
                .filter(models.Transaction.transaction_type == "return")
                .filter(models.Transaction.created_at >= row.created_at)
                # Exclude returns that are already linked to other requests
                .filter(
                    ~models.Transaction.remarks.like("REQUEST_TX_ID:%")
                )
                .scalar() or 0
            )
        else:
            total_returned = explicit_returns
        
        # Convert to int to ensure proper type
        total_returned = int(total_returned) if total_returned else 0
        
        # Calculate remaining quantity
        remaining_quantity = row.quantity_used - total_returned
        
        # Only include if not fully returned (remaining_quantity > 0)
        if remaining_quantity > 0:
            transactions.append({
                "transaction_id": row.transaction_id,
                "item_id": row.item_id,
                "fixture_id": row.fixture_id,
                "employee_id": row.employee_id,
                "transaction_type": row.transaction_type,
                "quantity_used": row.quantity_used,  # Original requested quantity
                "remaining_quantity": remaining_quantity,  # Quantity that can still be returned
                "created_at": row.created_at,
                "item_name": row.item_name,
                "item_part_number": row.item_part_number,
                "item_description": row.item_description,
                "item_manufacturer": row.item_manufacturer,
                "item_image_url": row.item_image_url,
                "test_area": row.test_area,
                "project_name": row.project_name,
                "fixture_name": row.fixture_name,
                "employee_name": row.employee_name,
            })

    return transactions





# ---------------- Fixtures ----------------
def get_all_fixtures(db: Session):
    return db.query(models.Fixture).order_by(models.Fixture.fixture_name).all()

def create_fixture(db: Session, fx: schemas.FixtureBase):
    new_fx = models.Fixture(**fx.dict())
    db.add(new_fx)
    db.commit()
    db.refresh(new_fx)
    return new_fx

# ---------------- Reports ----------------
def generate_weekly_report(db: Session):
    """Aggregate transactions of the past week for reporting."""
    end_date = date.today()
    start_date = end_date - timedelta(days=7)
    txs = db.query(models.Transaction).filter(models.Transaction.created_at >= start_date).all()

    for t in txs:
        rep = models.Report(
            week_start_date=start_date,
            week_end_date=end_date,
            item_id=t.item_id,
            item_name=t.item.item_name,
            item_description=t.item.item_description,
            quantity_used=t.quantity_used,
            current_quantity=t.item.item_current_quantity
        )
        db.add(rep)
    db.commit()
    return db.query(models.Report).filter(models.Report.week_start_date == start_date).all()

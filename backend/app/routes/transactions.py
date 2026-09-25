# backend/app/routes/transactions.py
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from .. import crud, schemas, models
from ..database import get_db
from ..utils.auth_deps import get_current_user, employee_id_from_token

router = APIRouter(prefix="/transactions", tags=["Transactions"])

@router.post("/request")
def request_item(t: schemas.TransactionBase, request: Request, db: Session = Depends(get_db)):
    """Deprecated: use POST /inventory/request instead."""
    raise HTTPException(
        status_code=410,
        detail="This endpoint is deprecated. Use POST /inventory/request instead.",
    )


@router.get("/all")
def get_all(
    test_area: str | None = None,
    project: str | None = None,
    transaction_type: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db)
):
    """View all transactions with optional filters."""
    from datetime import datetime
    
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
            models.Inventory.item_unit_price,
            models.Transaction.test_area,  # Use test_area from Transaction (works for both inventory and fixtures)
            models.Transaction.project_name,  # Use project_name from Transaction (works for both inventory and fixtures)
            models.Fixture.fixture_name,
            models.Employee.employee_name,
            models.Transaction.fixture_id,
            models.Transaction.item_id,
        )
        .outerjoin(models.Inventory, models.Transaction.item_id == models.Inventory.item_id)  # LEFT JOIN for inventory
        .outerjoin(models.Fixture, models.Transaction.fixture_id == models.Fixture.fixture_id)  # LEFT JOIN for fixture
        .join(models.Employee, models.Transaction.employee_id == models.Employee.employee_id)
    )

    # Apply filters
    if test_area:
        result = result.filter(models.Transaction.test_area == test_area)
    
    if project:
        result = result.filter(models.Transaction.project_name == project)
    
    if transaction_type:
        result = result.filter(models.Transaction.transaction_type == transaction_type.lower())
    
    if start_date:
        try:
            # Parse date string (format: YYYY-MM-DD)
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            result = result.filter(models.Transaction.created_at >= start_dt)
        except Exception as e:
            print(f"Error parsing start_date: {e}")
            pass
    
    if end_date:
        try:
            # Parse date string and add one day to include the entire end date
            from datetime import timedelta
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            end_dt = end_dt + timedelta(days=1)
            result = result.filter(models.Transaction.created_at < end_dt)
        except Exception as e:
            print(f"Error parsing end_date: {e}")
            pass

    result = result.order_by(models.Transaction.created_at.desc()).all()

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
            "item_unit_price": str(row[8]) if row[8] is not None else None,  # Convert Decimal to string
            "test_area": row[9],
            "project_name": row[10],
            "fixture_name": row[11],
            "employee_name": row[12],
        })

    return transactions

@router.get("/user/{employee_id}", response_model=list[schemas.TransactionOut])
def get_user_transactions(employee_id: int, db: Session = Depends(get_db)):
    """Returns user transactions WITH item details."""
    return crud.get_transactions_by_employee(db, employee_id)

@router.get("/{transaction_id}", response_model=schemas.TransactionOut)
def get_transaction(transaction_id: int, db: Session = Depends(get_db)):
    from sqlalchemy import func
    
    tx = (
        db.query(models.Transaction)
        .join(models.Inventory, models.Transaction.item_id == models.Inventory.item_id)
        .outerjoin(models.Fixture, models.Transaction.fixture_id == models.Fixture.fixture_id)  # LEFT JOIN for projects without fixtures
        .join(models.Employee, models.Transaction.employee_id == models.Employee.employee_id)
        .filter(models.Transaction.transaction_id == transaction_id)
        .first()
    )

    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Calculate remaining returnable quantity if this is a request transaction
    remaining_quantity = None
    if tx.transaction_type == "request":
        # First, try to match returns that explicitly reference this request_transaction_id
        explicit_returns = (
            db.query(
                func.coalesce(func.sum(models.Transaction.quantity_used), 0)
            )
            .filter(models.Transaction.transaction_type == "return")
            .filter(models.Transaction.remarks.like(f"REQUEST_TX_ID:{tx.transaction_id}%"))
            .scalar() or 0
        )
        
        # If no explicit returns found, fall back to old matching logic (backward compatibility)
        if explicit_returns == 0:
            total_returned = (
                db.query(
                    func.coalesce(func.sum(models.Transaction.quantity_used), 0)
                )
                .filter(models.Transaction.item_id == tx.item_id)
                .filter(models.Transaction.employee_id == tx.employee_id)
                .filter(models.Transaction.fixture_id == tx.fixture_id)
                .filter(models.Transaction.transaction_type == "return")
                .filter(models.Transaction.created_at >= tx.created_at)
                # Exclude returns that are already linked to other requests
                .filter(
                    ~models.Transaction.remarks.like("REQUEST_TX_ID:%")
                )
                .scalar() or 0
            )
        else:
            total_returned = explicit_returns
            
        remaining_quantity = tx.quantity_used - total_returned

    result = {
        "transaction_id": tx.transaction_id,
        "item_id": tx.item_id,
        "fixture_id": tx.fixture_id,
        "employee_id": tx.employee_id,
        "transaction_type": tx.transaction_type,
        "quantity_used": tx.quantity_used,
        "created_at": tx.created_at,
        "remarks": tx.remarks,
        "test_area": tx.test_area,
        "project_name": tx.project_name,

        # Item info
        "item_name": tx.item.item_name,
        "item_part_number": tx.item.item_part_number,
        "item_description": tx.item.item_description,
        "item_manufacturer": tx.item.item_manufacturer,
        "item_image_url": tx.item.item_image_url,

        # Fixture info (may be None for projects without fixtures)
        "fixture_name": tx.fixture.fixture_name if tx.fixture else None,

        # Employee info
        "employee_name": tx.employee.employee_name,
    }
    
    # Add remaining_quantity if it's a request transaction
    if remaining_quantity is not None:
        result["remaining_quantity"] = remaining_quantity

    return result

@router.post("/return")
def return_item(
    t: schemas.TransactionBase,
    request: Request,
    request_transaction_id: int = Query(None, description="The transaction_id of the original request this return belongs to"),
    db: Session = Depends(get_db)
):
    """Employee returns an item (increase quantity)."""
    user = get_current_user(request)
    employee_id = employee_id_from_token(user)
    role = str(user.get("role", "")).lower()

    if t.quantity_used <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than 0")

    item = db.query(models.Inventory).filter(models.Inventory.item_id == t.item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    original_request = None
    if request_transaction_id:
        original_request = (
            db.query(models.Transaction)
            .filter(models.Transaction.transaction_id == request_transaction_id)
            .first()
        )
        if not original_request:
            raise HTTPException(status_code=404, detail="Original request transaction not found")
        if original_request.transaction_type != "request":
            raise HTTPException(status_code=400, detail="Linked transaction is not a request")

        if role != "admin" and original_request.employee_id != employee_id:
            raise HTTPException(
                status_code=403,
                detail="Not authorized to return items for this request",
            )

        from sqlalchemy import func

        explicit_returns = (
            db.query(func.coalesce(func.sum(models.Transaction.quantity_used), 0))
            .filter(models.Transaction.transaction_type == "return")
            .filter(models.Transaction.remarks.like(f"REQUEST_TX_ID:{request_transaction_id}%"))
            .scalar()
            or 0
        )
        remaining = original_request.quantity_used - explicit_returns
        if t.quantity_used > remaining:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot return more than remaining quantity ({remaining})",
            )

    # Add quantity back
    crud.add_item_quantity(db, t.item_id, t.quantity_used)

    # Store request_transaction_id in remarks if provided, so we can link returns to specific requests
    # Format: "REQUEST_TX_ID:123|user remarks" or just "REQUEST_TX_ID:123" if no remarks
    remarks_with_tx_id = t.remarks or ""
    if request_transaction_id:
        if remarks_with_tx_id:
            remarks_with_tx_id = f"REQUEST_TX_ID:{request_transaction_id}|{remarks_with_tx_id}"
        else:
            remarks_with_tx_id = f"REQUEST_TX_ID:{request_transaction_id}"

    # Create the return transaction
    new_tx = models.Transaction(
        item_id=t.item_id,
        employee_id=employee_id,
        fixture_id=t.fixture_id or (original_request.fixture_id if original_request else None),
        quantity_used=t.quantity_used,
        transaction_type="return",
        remarks=remarks_with_tx_id,
        test_area=t.test_area,
        project_name=t.project_name
    )

    db.add(new_tx)
    db.commit()
    db.refresh(new_tx)

    return {"message": "Return logged"}



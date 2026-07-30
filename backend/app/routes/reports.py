# backend/app/routes/reports.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from datetime import datetime, timedelta
from ..database import get_db
from .. import crud, schemas, models

router = APIRouter(prefix="/reports", tags=["Reports"])

@router.get("/weekly", response_model=list[schemas.ReportOut])
def generate_report(db: Session = Depends(get_db)):
    """Generate and return weekly usage report."""
    return crud.generate_weekly_report(db)

@router.get("/weekly/projects")
def get_weekly_projects_stats(db: Session = Depends(get_db)):
    """Get weekly statistics grouped by project."""
    # Get date 7 days ago
    week_ago = datetime.now() - timedelta(days=7)
    
    results = (
        db.query(
            models.Transaction.project_name,
            func.count(models.Transaction.transaction_id).label("total"),
            func.sum(case((models.Transaction.transaction_type == "request", models.Transaction.quantity_used), else_=0)).label("requests"),
            func.sum(case((models.Transaction.transaction_type == "return", models.Transaction.quantity_used), else_=0)).label("returns"),
            func.sum(case((models.Transaction.transaction_type == "restock", models.Transaction.quantity_used), else_=0)).label("restocks"),
        )
        .filter(models.Transaction.created_at >= week_ago)
        .filter(models.Transaction.project_name.isnot(None))
        .group_by(models.Transaction.project_name)
        .order_by(func.count(models.Transaction.transaction_id).desc())
        .limit(10)
        .all()
    )
    
    return [
        {
            "name": row.project_name,
            "total": row.total or 0,
            "requests": int(row.requests or 0),
            "returns": int(row.returns or 0),
            "restocks": int(row.restocks or 0),
        }
        for row in results
    ]

@router.get("/weekly/test-areas")
def get_weekly_test_areas_stats(db: Session = Depends(get_db)):
    """Get weekly statistics grouped by test area."""
    # Get date 7 days ago
    week_ago = datetime.now() - timedelta(days=7)
    
    results = (
        db.query(
            models.Transaction.test_area,
            func.count(models.Transaction.transaction_id).label("total"),
            func.sum(case((models.Transaction.transaction_type == "request", models.Transaction.quantity_used), else_=0)).label("requests"),
            func.sum(case((models.Transaction.transaction_type == "return", models.Transaction.quantity_used), else_=0)).label("returns"),
            func.sum(case((models.Transaction.transaction_type == "restock", models.Transaction.quantity_used), else_=0)).label("restocks"),
        )
        .filter(models.Transaction.created_at >= week_ago)
        .filter(models.Transaction.test_area.isnot(None))
        .filter(models.Transaction.test_area != "BSI")
        .filter(models.Transaction.test_area != "FBT")
        .filter(models.Transaction.test_area != "ICT")
        .group_by(models.Transaction.test_area)
        .order_by(func.count(models.Transaction.transaction_id).desc())
        .limit(10)
        .all()
    )
    
    return [
        {
            "name": row.test_area,
            "total": row.total or 0,
            "requests": int(row.requests or 0),
            "returns": int(row.returns or 0),
            "restocks": int(row.restocks or 0),
        }
        for row in results
    ]

@router.get("/weekly/most-used-items")
def get_weekly_most_used_items(db: Session = Depends(get_db)):
    """Get most used items in the last 7 days."""
    # Get date 7 days ago
    week_ago = datetime.now() - timedelta(days=7)
    
    results = (
        db.query(
            models.Inventory.item_id,
            models.Inventory.item_name,
            models.Inventory.item_part_number,
            func.sum(
                case(
                    (models.Transaction.transaction_type == "request", models.Transaction.quantity_used),
                    else_=0
                )
            ).label("total_requested"),
            func.count(models.Transaction.transaction_id).label("transaction_count"),
        )
        .join(models.Transaction, models.Inventory.item_id == models.Transaction.item_id)
        .filter(models.Transaction.created_at >= week_ago)
        .filter(models.Transaction.transaction_type == "request")
        .group_by(models.Inventory.item_id, models.Inventory.item_name, models.Inventory.item_part_number)
        .order_by(
            func.sum(
                case(
                    (models.Transaction.transaction_type == "request", models.Transaction.quantity_used),
                    else_=0,
                )
            ).desc()
        )
        .limit(10)
        .all()
    )
    
    return [
        {
            "item_id": row.item_id,
            "item_name": row.item_name,
            "item_part_number": row.item_part_number or "N/A",
            "total_requested": int(row.total_requested or 0),
            "transaction_count": row.transaction_count or 0,
        }
        for row in results
    ]

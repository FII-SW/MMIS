# backend/app/routes/fixtures.py
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from ..database import get_db
from .. import crud, schemas
from .. import models
from ..utils.auth_deps import require_admin

router = APIRouter(prefix="/fixtures", tags=["Fixtures"])

@router.get("/", response_model=list[schemas.FixtureOut])
def list_fixtures(db: Session = Depends(get_db)):
    """Return all fixtures."""
    return crud.get_all_fixtures(db)


@router.get("/filter", response_model=list[schemas.FixtureOut])
def filter_fixtures(
    project: str | None = None,
    test_area: str | None = None,
    db: Session = Depends(get_db)
):
    """
    Filter fixtures by project and/or test area.
    Example:
        /fixtures/filter?project=Athena
        /fixtures/filter?project=Athena&test_area=FBT
    """
    query = db.query(models.Fixture)

    if project:
        query = query.filter(models.Fixture.project_name == project)

    if test_area:
        query = query.filter(models.Fixture.test_area == test_area)

    return query.order_by(models.Fixture.fixture_name).all()


@router.get("/descriptor-options")
def fixture_descriptor_options(db: Session = Depends(get_db)):
    """Distinct manufacturers and production lines already in use, for form suggestions."""
    def distinct_values(column):
        rows = db.query(column).filter(column.isnot(None), column != "").distinct().all()
        return sorted({row[0].strip() for row in rows if row[0] and row[0].strip()}, key=str.lower)

    return {
        "manufacturers": distinct_values(models.Fixture.manufacturer),
        "production_lines": distinct_values(models.Fixture.production_line),
    }


@router.patch("/bulk-descriptors")
def bulk_update_fixture_descriptors(
    data: schemas.FixtureDescriptorsBulkUpdate,
    request: Request,
    db: Session = Depends(get_db),
):
    """Admin: set manufacturer / production line for many fixtures, each with its own values."""
    require_admin(request)
    if not data.updates:
        return {"updated": 0}
    if len(data.updates) > 1000:
        raise HTTPException(status_code=400, detail="Too many fixtures in one request (max 1000)")

    ids = {item.fixture_id for item in data.updates}
    fixtures_by_id = {
        fx.fixture_id: fx
        for fx in db.query(models.Fixture).filter(models.Fixture.fixture_id.in_(ids)).all()
    }
    missing = sorted(ids - fixtures_by_id.keys())
    if missing:
        raise HTTPException(status_code=404, detail=f"Fixtures not found: {missing[:10]}")

    for item in data.updates:
        fixture = fixtures_by_id[item.fixture_id]
        for key, value in item.dict(exclude_unset=True, exclude={"fixture_id"}).items():
            setattr(fixture, key, (value or "").strip() or None)

    db.commit()
    return {"updated": len(data.updates)}


@router.patch("/{fixture_id}/descriptors", response_model=schemas.FixtureOut)
def update_fixture_descriptors(
    fixture_id: int,
    data: schemas.FixtureDescriptorsUpdate,
    request: Request,
    db: Session = Depends(get_db),
):
    """Admin quick edit of manufacturer / production line."""
    require_admin(request)
    db_fixture = db.query(models.Fixture).filter(models.Fixture.fixture_id == fixture_id).first()
    if not db_fixture:
        raise HTTPException(status_code=404, detail="Fixture not found")

    for key, value in data.dict(exclude_unset=True).items():
        setattr(db_fixture, key, (value or "").strip() or None)

    db.commit()
    db.refresh(db_fixture)
    return db_fixture


@router.get("/{fixture_id}", response_model=schemas.FixtureOut)
def get_single_fixture(fixture_id: int, db: Session = Depends(get_db)):
    """Get a single fixture by ID."""
    fixture = db.query(models.Fixture).filter(models.Fixture.fixture_id == fixture_id).first()
    if not fixture:
        raise HTTPException(status_code=404, detail="Fixture not found")
    return fixture


@router.put("/{fixture_id}", response_model=schemas.FixtureOut)
def update_fixture(fixture_id: int, fixture: schemas.FixtureBase, db: Session = Depends(get_db)):
    """Update an existing fixture by ID."""
    db_fixture = db.query(models.Fixture).filter(models.Fixture.fixture_id == fixture_id).first()
    if not db_fixture:
        raise HTTPException(status_code=404, detail="Fixture not found")
    
    # Only fields the client sent are updated, so older clients don't blank newer columns
    update_data = fixture.dict(exclude_unset=True)
    for key, value in update_data.items():
        if key in ("manufacturer", "production_line"):
            final_value = (value or "").strip() or None
        else:
            final_value = value if value is not None else ""
        setattr(db_fixture, key, final_value)
    
    db.commit()
    db.refresh(db_fixture)
    return db_fixture


@router.post("/", response_model=schemas.FixtureOut)
def add_fixture(data: dict, db: Session = Depends(get_db)):
    """Add a new fixture and create transaction record if employee_id provided."""
    # Extract employee_id if provided
    employee_id = data.get("employee_id")
    
    # Create FixtureBase from the data (excluding employee_id)
    # Convert None to empty string for optional fields
    fixture_data = {k: (v if v is not None else "") for k, v in data.items() if k != "employee_id"}
    for key in ("manufacturer", "production_line"):
        fixture_data[key] = str(fixture_data.get(key) or "").strip() or None
    fx = schemas.FixtureBase(**fixture_data)
    
    # Create the fixture
    db_fixture = crud.create_fixture(db, fx)
    
    # Create transaction record if employee_id is provided (for activity history)
    if employee_id:
        transaction = models.Transaction(
            item_id=None,  # Fixtures are not inventory items
            employee_id=employee_id,
            fixture_id=db_fixture.fixture_id,
            quantity_used=1,  # Representing that one fixture was added
            transaction_type="restock",  # Using "restock" for new fixtures added
            remarks="New fixture added",
            test_area=fx.test_area,
            project_name=fx.project_name,
        )
        db.add(transaction)
        db.commit()
        db.refresh(db_fixture)
    
    return db_fixture

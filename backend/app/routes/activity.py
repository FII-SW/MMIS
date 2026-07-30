# backend/app/routes/activity.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from .. import crud

router = APIRouter(prefix="/activity", tags=["Activity"])


@router.get("/all")
def get_all_activity(db: Session = Depends(get_db)):
    return crud.get_all_transactions(db)

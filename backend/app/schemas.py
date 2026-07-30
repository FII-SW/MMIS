# backend/app/schemas.py
from pydantic import BaseModel, validator, Field   # Base class for creating Pydantic data validation models
from datetime import datetime, date
from typing import Optional, Union  # Allows defining optional (nullable) fields
from decimal import Decimal

# ===== Employee =====
# Schema for creating a new employee (used for POST requests)
class EmployeeCreate(BaseModel):
    employee_badge_number: str
    employee_name: str
    employee_designation: Optional[str]
    employee_shift: Optional[str]
    employee_access_level: str
    employee_username: str
    employee_password: str
    employee_email: Optional[str] = None

# Schema for returning employee data to the client (response model)
class EmployeeOut(BaseModel):
    employee_id: int
    employee_name: str
    employee_access_level: str
    employee_badge_number: Optional[str] = None
    employee_designation: Optional[str] = None
    employee_shift: Optional[str] = None
    employee_username: Optional[str] = None
    employee_email: Optional[str] = None
    class Config:
        from_attributes = True
#-----------------------------------------------------------------------------------------------------------------------------------------
# ===== Inventory =====
class InventoryBase(BaseModel):
    item_name: str
    item_description: Optional[str]
    item_part_number: Optional[str]
    item_current_quantity: int
    item_min_count: int
    item_unit: Optional[str]
    item_unit_price: Optional[Union[str, Decimal, float]] = None
    item_manufacturer: Optional[str]
    item_type: Optional[str]
    test_area: Optional[str]
    project_name: Optional[str]
    item_life_cycle: Optional[int]
    item_image_url: Optional[str] = None

    @validator('item_unit_price', pre=True)
    def convert_decimal_to_string(cls, v):
        if v is None:
            return None
        if isinstance(v, Decimal):
            return str(v)
        if isinstance(v, (int, float)):
            return str(v)
        return v


class RequestCreate(BaseModel):
    item_id: int
    employee_id: int
    fixture_id: Optional[int] = None
    quantity: int = Field(gt=0)

# Schema for returning full inventory details to the client
class InventoryOut(InventoryBase):
    item_id: int
    created_at: datetime
    class Config:
        from_attributes = True
    
#-----------------------------------------------------------------------------------------------------------------------------------------------------
# ===== Transaction =====
# Base schema for creating or updating a transaction
class TransactionBase(BaseModel):
    item_id: int
    employee_id: int
    fixture_id: Optional[int] = None  # Optional for projects that don't require fixtures
    quantity_used: int = Field(gt=0)
    transaction_type: str
    remarks: Optional[str] = None
    test_area: Optional[str] = None
    project_name: Optional[str] = None

# Schema for returning transaction details (includes DB-generated fields)
class TransactionOut(BaseModel):
    transaction_id: int
    item_id: int
    fixture_id: Optional[int] = None  # Optional for projects that don't require fixtures
    employee_id: int
    transaction_type: str
    quantity_used: int
    created_at: datetime
    remarks: Optional[str] = None

    item_name: Optional[str] = None
    item_part_number: Optional[str] = None
    item_description: Optional[str] = None
    item_manufacturer: Optional[str] = None
    item_unit_price: Optional[str] = None
    item_image_url: Optional[str] = None
    test_area: Optional[str] = None
    project_name: Optional[str] = None

    fixture_name: Optional[str] = None
    employee_name: Optional[str] = None
    remaining_quantity: Optional[int] = None  # For request transactions: quantity that can still be returned
    class Config:
        from_attributes = True
#-----------------------------------------------------------------------------------------------------------------------------------------
# ===== Report =====
# Schema for returning report data
class ReportOut(BaseModel):
    report_id: int
    item_id: int
    item_name: str
    quantity_used: int
    current_quantity: int
    created_at: datetime
    class Config:
        from_attributes = True  # Enables ORM model conversion
#------------------------------------------------------------------------------------------------------------------------------------------
# ===== Fixture =====
# Schema for reporting fixture data
class FixtureBase(BaseModel):
    fixture_name: str
    test_area: str
    project_name: str
    asset_tag: Optional[str] = ""
    fixture_serial_number: Optional[str] = ""

class FixtureOut(FixtureBase):
    fixture_id: int
    class Config:
        from_attributes = True


# ===== Project Documents =====
class ProjectDocumentUpdate(BaseModel):
    document_scope: Optional[str] = None
    project_name: Optional[str] = None
    test_area: Optional[str] = None
    remarks: Optional[str] = None


class ProjectDocumentOut(BaseModel):
    document_id: int
    document_scope: str
    project_name: Optional[str] = None
    test_area: Optional[str] = None
    original_filename: str
    stored_filename: str
    file_type: str
    content_type: Optional[str] = None
    file_size: int
    file_url: str
    remarks: Optional[str] = None
    is_pinned: bool = False
    pinned_at: Optional[datetime] = None
    uploaded_by_employee_id: Optional[int] = None
    uploaded_by_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ProjectDocumentPinUpdate(BaseModel):
    is_pinned: bool

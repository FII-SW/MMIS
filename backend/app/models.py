
# Import necessary SQLAlchemy components for defining database tables and relationships
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, CheckConstraint, Date, Boolean
from sqlalchemy.sql import func        # For automatic timestamps (e.g., created_at)
from sqlalchemy.orm import relationship      # For defining relationships between tables
from .database import Base   # Import the Base class from database.py

# EMPLOYEE MODEL
class Employee(Base):
    __tablename__ = "employees"       # Database table name

    employee_id = Column(Integer, primary_key=True, index=True)
    employee_badge_number = Column(String(20), unique=True, nullable=False)
    employee_name = Column(String(100), nullable=False)
    employee_designation = Column(String(50))
    employee_shift = Column(String(20))
    employee_access_level = Column(String(20))
    employee_username = Column(String(50), unique=True, nullable=False)
    employee_password = Column(String(255), nullable=False)
    employee_email = Column(String(255), nullable=True)

     # Relationship: one employee → many transactions
    transactions = relationship("Transaction", back_populates="employee")

class Fixture(Base):
    __tablename__ = "fixtures"

    fixture_id = Column(Integer, primary_key=True, index=True)
    fixture_name = Column(String(100), nullable=False)
    test_area = Column(String(20), nullable=False)
    project_name = Column(String(100), nullable=False)
    asset_tag = Column(String(50), nullable=True)
    fixture_serial_number = Column(String(50), nullable=True)
    manufacturer = Column(String(100), nullable=True)
    production_line = Column(String(50), nullable=True)

    # Relationship: one fixture → many transactions
    transactions = relationship("Transaction", back_populates="fixture")

class Inventory(Base):
    __tablename__ = "inventory"

    item_id = Column(Integer, primary_key=True, index=True)
    item_name = Column(String(100), nullable=False)
    item_description = Column(Text)
    item_part_number = Column(String(50))
    item_current_quantity = Column(Integer, default=0)
    item_min_count = Column(Integer, default=0)
    item_unit = Column(String(20))
    item_unit_price = Column(String(50), nullable=True)
    item_manufacturer = Column(String(100))
    item_type = Column(String(20))
    test_area = Column(String(20))
    project_name = Column(String(100))
    item_life_cycle = Column(Integer, default=0)
    item_image_url = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship: one inventory item → many transactions
    transactions = relationship("Transaction", back_populates="item")

class Transaction(Base):
    __tablename__ = "transactions"

    transaction_id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("inventory.item_id"), nullable=True)
    employee_id = Column(Integer, ForeignKey("employees.employee_id"))
    fixture_id = Column(Integer, ForeignKey("fixtures.fixture_id"))
    quantity_used = Column(Integer, nullable=False)
    transaction_type = Column(String(20))
    remarks = Column(Text)
    test_area = Column(String(20))
    project_name = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Define relationships to other tables
    employee = relationship("Employee", back_populates="transactions") # Many-to-one with Employee
    fixture = relationship("Fixture", back_populates="transactions") # Many-to-one with Fixture
    item = relationship("Inventory", back_populates="transactions") # Many-to-one with Inventory


class Report(Base):
    __tablename__ = "reports"

    report_id = Column(Integer, primary_key=True, index=True)
    week_start_date = Column(Date)
    week_end_date = Column(Date)
    item_id = Column(Integer, ForeignKey("inventory.item_id"))
    item_name = Column(String(100))
    item_description = Column(Text)
    quantity_used = Column(Integer)
    current_quantity = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class FixturePMRecord(Base):
    __tablename__ = "fixture_pm_records"

    pm_id = Column(Integer, primary_key=True, index=True)
    fixture_id = Column(Integer, ForeignKey("fixtures.fixture_id"), nullable=False, index=True)
    pm_type = Column(String(20), nullable=False, index=True)
    overall_result = Column(String(20), nullable=False)
    # JSON list of {item_id, section, task, result}; stores the checklist as performed
    checklist_results = Column(Text, nullable=False)
    notes = Column(Text, nullable=True)
    parts_replaced = Column(Text, nullable=True)
    indysoft_recorded = Column(Boolean, nullable=False, default=False)
    project_name = Column(String(100))
    test_area = Column(String(20))
    performed_by_employee_id = Column(Integer, ForeignKey("employees.employee_id"), nullable=True)
    performed_at = Column(DateTime(timezone=True), server_default=func.now())


class ProjectDocument(Base):
    __tablename__ = "project_documents"

    document_id = Column(Integer, primary_key=True, index=True)
    document_scope = Column(String(20), nullable=False, default="project", index=True)
    project_name = Column(String(100), nullable=True, index=True)
    test_area = Column(String(50), nullable=True)
    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=False, unique=True)
    file_type = Column(String(20), nullable=False)
    content_type = Column(String(100), nullable=True)
    file_size = Column(Integer, nullable=False, default=0)
    file_url = Column(String(500), nullable=False)
    remarks = Column(Text, nullable=True)
    is_pinned = Column(Boolean, nullable=False, default=False)
    pinned_at = Column(DateTime(timezone=True), nullable=True)
    uploaded_by_employee_id = Column(Integer, ForeignKey("employees.employee_id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

# backend/app/main.py
# ----------------------------------------------------------
# FastAPI entrypoint: initializes DB, includes routers,
# and sets up middleware.
# ----------------------------------------------------------
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from sqlalchemy.exc import ProgrammingError
from .database import Base, engine
from .routes import admin, checklist_admin, notifications, employees, inventory, transactions, reports, alerts, activity, fixtures, documents, maintenance, pm_workflow, pm_dashboard, pm_report
from . import auth
from .utils.scheduler import start_scheduler, stop_scheduler
import os
import atexit

app = FastAPI(title="Machine Maintenance Inventory System (MMIS)")

# Must not equal a job lock key in utils/pm_jobs.py (crc32 of the job id).
MIGRATION_LOCK_ID = 73_210_001


def ensure_project_documents_columns():
    """Backward-compatible migration for project_documents table columns."""
    inspector = inspect(engine)
    try:
        columns = {col["name"] for col in inspector.get_columns("project_documents")}
    except Exception:
        # Table may not exist yet in first boot; create_all handles that.
        return

    with engine.begin() as conn:
        if "is_pinned" not in columns:
            conn.execute(
                text(
                    "ALTER TABLE project_documents "
                    "ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT FALSE"
                )
            )
        if "pinned_at" not in columns:
            conn.execute(
                text("ALTER TABLE project_documents ADD COLUMN pinned_at TIMESTAMP WITH TIME ZONE")
            )
        if "document_scope" not in columns:
            conn.execute(
                text(
                    "ALTER TABLE project_documents "
                    "ADD COLUMN document_scope VARCHAR(20) NOT NULL DEFAULT 'project'"
                )
            )
        # Allow null project_name for common documents.
        try:
            conn.execute(text("ALTER TABLE project_documents ALTER COLUMN project_name DROP NOT NULL"))
        except Exception:
            # Ignore when database/user doesn't allow alter or column already nullable.
            pass


def ensure_fixture_descriptor_columns():
    """Backward-compatible migration for fixture manufacturer / production line."""
    inspector = inspect(engine)
    try:
        columns = {col["name"] for col in inspector.get_columns("fixtures")}
    except Exception:
        return

    with engine.begin() as conn:
        if "manufacturer" not in columns:
            conn.execute(text("ALTER TABLE fixtures ADD COLUMN manufacturer VARCHAR(100)"))
        if "production_line" not in columns:
            conn.execute(text("ALTER TABLE fixtures ADD COLUMN production_line VARCHAR(50)"))


def _add_missing_columns(table: str, definitions: dict[str, str]):
    """ALTER TABLE ... ADD COLUMN for each column not present yet."""
    inspector = inspect(engine)
    try:
        columns = {col["name"] for col in inspector.get_columns(table)}
    except Exception:
        return
    missing = [
        f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {name} {ddl};"
        for name, ddl in definitions.items()
        if name not in columns
    ]
    if not missing:
        return
    try:
        with engine.begin() as conn:
            for statement in missing:
                conn.execute(text(statement))
    except ProgrammingError as exc:
        if "must be owner" not in str(exc):
            raise
        raise RuntimeError(
            f"The MMIS database user doesn't own the '{table}' table, so it can't add new columns. "
            f"Run this once as the postgres user, then restart mmis-backend:\n" + "\n".join(missing)
        ) from None


def ensure_pm_workflow_columns():
    """Backward-compatible migration for PM pause, void/edit audit and PM-linked parts."""
    created_at_missing = False
    try:
        created_at_missing = "created_at" not in {
            col["name"] for col in inspect(engine).get_columns("fixtures")
        }
    except Exception:
        pass

    _add_missing_columns(
        "fixtures",
        {
            # Existing fixtures keep NULL (their PM clock starts at the tracking start date).
            "created_at": "TIMESTAMP WITH TIME ZONE",
            "pm_paused": "BOOLEAN NOT NULL DEFAULT FALSE",
            "pm_pause_reason": "VARCHAR(255)",
            "pm_paused_at": "TIMESTAMP WITH TIME ZONE",
            "pm_paused_by_employee_id": "INTEGER REFERENCES employees(employee_id)",
            "pm_resumed_at": "TIMESTAMP WITH TIME ZONE",
        },
    )
    if created_at_missing:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE fixtures ALTER COLUMN created_at SET DEFAULT now()"))

    _add_missing_columns(
        "fixture_pm_records",
        {
            "voided": "BOOLEAN NOT NULL DEFAULT FALSE",
            "voided_at": "TIMESTAMP WITH TIME ZONE",
            "voided_by_employee_id": "INTEGER REFERENCES employees(employee_id)",
            "void_reason": "TEXT",
            "edited_at": "TIMESTAMP WITH TIME ZONE",
            "edited_by_employee_id": "INTEGER REFERENCES employees(employee_id)",
            "maintenance_type": "VARCHAR(20)",
            "activation_counter": "BIGINT",
            "commodity_replacement": "TEXT",
            "downtime_minutes": "INTEGER",
        },
    )
    _add_missing_columns(
        "transactions",
        {"pm_id": "INTEGER REFERENCES fixture_pm_records(pm_id)"},
    )
    # ADD COLUMN does not create the model's index; the dashboard filters PMs by date range.
    with engine.begin() as conn:
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_transactions_pm_id ON transactions (pm_id)"))
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_fixture_pm_records_performed_at "
                "ON fixture_pm_records (performed_at)"
            )
        )


def ensure_super_admin_columns():
    """Backward-compatible migration for account deactivation and PM assignments."""
    _add_missing_columns(
        "employees",
        {
            "employee_active": "BOOLEAN NOT NULL DEFAULT TRUE",
            "employee_must_change_password": "BOOLEAN NOT NULL DEFAULT FALSE",
        },
    )
    _add_missing_columns(
        "fixtures",
        {
            "pm_assigned_employee_id": "INTEGER REFERENCES employees(employee_id)",
            "pm_assigned_at": "TIMESTAMP WITH TIME ZONE",
            "pm_assigned_by_employee_id": "INTEGER REFERENCES employees(employee_id)",
        },
    )
    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_fixtures_pm_assigned_employee_id "
                "ON fixtures (pm_assigned_employee_id)"
            )
        )


def run_startup_migrations():
    """Create missing tables and columns. Every uvicorn worker imports this module at the same
    time, so they take turns under a Postgres advisory lock instead of racing on CREATE/ALTER."""
    with engine.connect() as lock_conn:
        lock_conn.execute(text("SELECT pg_advisory_lock(:id)"), {"id": MIGRATION_LOCK_ID})
        try:
            Base.metadata.create_all(bind=engine)
            ensure_project_documents_columns()
            ensure_fixture_descriptor_columns()
            ensure_pm_workflow_columns()
            ensure_super_admin_columns()
        finally:
            lock_conn.execute(text("SELECT pg_advisory_unlock(:id)"), {"id": MIGRATION_LOCK_ID})


run_startup_migrations()

# Create uploads directory if it doesn't exist (relative to backend directory)
# Get the backend directory (parent of app directory)
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
uploads_dir = os.path.join(backend_dir, "uploads", "item_images")
os.makedirs(uploads_dir, exist_ok=True)
documents_upload_dir = os.path.join(backend_dir, "uploads", "project_documents")
os.makedirs(documents_upload_dir, exist_ok=True)

# Mount static files directory for serving images
uploads_base_dir = os.path.join(backend_dir, "uploads")
app.mount("/uploads", StaticFiles(directory=uploads_base_dir), name="uploads")

# CORS configuration - production ready with environment variable support
# Default allows all origins for development, use CORS_ORIGINS env var for production
cors_origins_env = os.getenv("CORS_ORIGINS", "*")
if cors_origins_env == "*":
    cors_origins = ["*"]
    allow_credentials = False
else:
    cors_origins = [origin.strip() for origin in cors_origins_env.split(",")]
    allow_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routers
app.include_router(auth.router)
app.include_router(employees.router)
app.include_router(inventory.router)
app.include_router(transactions.router)
app.include_router(reports.router)
app.include_router(alerts.router)
app.include_router(activity.router)
app.include_router(fixtures.router)
app.include_router(documents.router)
app.include_router(maintenance.router)
app.include_router(pm_workflow.router)
app.include_router(pm_dashboard.router)
app.include_router(pm_report.router)
app.include_router(admin.router)
app.include_router(checklist_admin.router)
app.include_router(notifications.router)

@app.get("/")
def root():
    return {"message": "Inventory Management System API running!"}

@app.on_event("startup")
def startup_event():
    """Start the scheduler when the application starts."""
    start_scheduler()

@app.on_event("shutdown")
def shutdown_event():
    """Stop the scheduler when the application shuts down."""
    stop_scheduler()

# Register shutdown handler
atexit.register(stop_scheduler) 
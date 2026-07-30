# backend/app/main.py
# ----------------------------------------------------------
# FastAPI entrypoint: initializes DB, includes routers,
# and sets up middleware.
# ----------------------------------------------------------
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from .database import Base, engine
from .routes import employees, inventory, transactions, reports, alerts, activity, fixtures, documents
from . import auth
from .utils.scheduler import start_scheduler, stop_scheduler
import os
import atexit

app = FastAPI(title="Machine Maintenance Inventory System (MMIS)")

# Auto-create tables if not exist
Base.metadata.create_all(bind=engine)


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


ensure_project_documents_columns()

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
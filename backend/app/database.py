# backend/app/database.py
from sqlalchemy import create_engine          # Used to create the database connection engine
from sqlalchemy.orm import declarative_base     # Base class for creating ORM(Object Relational Mapping) models
from sqlalchemy.orm import sessionmaker        # Factory for creating new database sessions
import os                                      # Used to access environment variables

# --- Database Configuration ---
# Set DATABASE_URL in environment; do not commit real credentials.
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/MMIS"

# Create a SQLAlchemy engine that manages the connection pool to the PostgreSQL database
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

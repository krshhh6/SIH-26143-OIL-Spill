from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

# We expect a PostGIS enabled Postgres connection string
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://postgres:postgres@localhost:5432/spillsense"
)

try:
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    # Quick probe to verify the dialect driver loaded
    _ = engine.dialect
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
except Exception as e:
    # Graceful fallback to SQLite in-memory for standalone / dev mode without PostgreSQL driver
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False}
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """Dependency to generate DB sessions for FastAPI routes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


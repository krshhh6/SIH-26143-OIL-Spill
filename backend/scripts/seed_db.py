import sys
import os
import uuid
from datetime import datetime

# Add the backend directory to sys.path so we can import the app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal, engine
from app.db.models import Base, Incident

def seed_database():
    """Seeds the PostgreSQL database with the 4 benchmark incidents."""
    
    print("Creating tables if they don't exist...")
    # This automatically creates all tables based on the models. 
    # In production, Alembic handles this.
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    # Check if we already seeded
    existing = db.query(Incident).count()
    if existing > 0:
        print(f"Database already contains {existing} incidents. Skipping seed.")
        db.close()
        return

    print("Seeding benchmark incidents into PostgreSQL...")

    incidents = [
        Incident(
            id=uuid.UUID("11111111-1111-1111-1111-111111111111"),
            incident_number="INC-2026-001",
            title="Mumbai High Offshore Basin",
            center_latitude=18.743,
            center_longitude=71.218,
            severity="CRITICAL",
            oil_classification="Crude Oil",
            oil_color_hex="#B45309",
            surface_area_sq_km=4.82,
            detection_time_utc=datetime.utcnow()
        ),
        Incident(
            id=uuid.UUID("22222222-2222-2222-2222-222222222222"),
            incident_number="INC-2026-002",
            title="Chennai–Ennore Coastal Corridor",
            center_latitude=13.234,
            center_longitude=80.345,
            severity="HIGH",
            oil_classification="Heavy Bunker Fuel",
            oil_color_hex="#0D0D11",
            surface_area_sq_km=3.15,
            detection_time_utc=datetime.utcnow()
        ),
        Incident(
            id=uuid.UUID("33333333-3333-3333-3333-333333333333"),
            incident_number="INC-2026-003",
            title="Andaman Sea Shipping Lane 7",
            center_latitude=10.456,
            center_longitude=93.123,
            severity="MEDIUM",
            oil_classification="Oil Bilge Water",
            oil_color_hex="#38BDF8",
            surface_area_sq_km=1.94,
            detection_time_utc=datetime.utcnow()
        ),
        Incident(
            id=uuid.UUID("44444444-4444-4444-4444-444444444444"),
            incident_number="INC-2026-004",
            title="Goa Coastal Waters (Bunkering Leak)",
            center_latitude=15.421,
            center_longitude=73.682,
            severity="LOW",
            oil_classification="Diesel / Marine Gas Oil",
            oil_color_hex="#EAB308",
            surface_area_sq_km=0.85,
            detection_time_utc=datetime.utcnow()
        )
    ]
    
    try:
        db.add_all(incidents)
        db.commit()
        print("Successfully seeded 4 benchmark incidents!")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()

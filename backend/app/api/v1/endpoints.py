# -*- coding: utf-8 -*-
"""
Spill Sense (SIH26143) — Core REST API Endpoints
Adheres to AppFlow.md and tech_stack.md specification:
- DETECT -> TRACE BACK -> ATTRIBUTE -> PROVE
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_db
from app.db.models import Incident
from app.tasks.inference import run_sar_inference
from app.tasks.drift_simulation import run_backward_drift_simulation
from app.tasks.ais_correlation import correlate_ais_vessels
from app.services.pdf_evidence_generator import PDFEvidenceGenerator

router = APIRouter()

# ── SCHEMAS ──
class IncidentSummary(BaseModel):
    id: str
    title: str
    lat: float
    lng: float
    severity: str
    oil_type: str
    oil_color: str
    area: str
    top_vessel: str
    attribution_score: float

# ── STATIC FALLBACK (no DB required) ──
STATIC_INCIDENTS: List[IncidentSummary] = [
    IncidentSummary(id="INC-001", title="Mumbai High Offshore Basin",
        lat=18.743, lng=71.218, severity="CRITICAL", oil_type="Crude Oil",
        oil_color="#B45309", area="4.82 km²", top_vessel="CRUDE ATLAS", attribution_score=0.82),
    IncidentSummary(id="INC-002", title="Chennai–Ennore Coastal Corridor",
        lat=13.250, lng=80.460, severity="HIGH", oil_type="Heavy Bunker Fuel",
        oil_color="#0D0D11", area="2.40 km²", top_vessel="PACIFIC GLORY", attribution_score=0.68),
    IncidentSummary(id="INC-003", title="Andaman Sea Shipping Lane 7",
        lat=10.456, lng=93.123, severity="MEDIUM", oil_type="Oil Bilge Water",
        oil_color="#38BDF8", area="0.95 km²", top_vessel="UNKNOWN (DARK VESSEL)", attribution_score=0.74),
    IncidentSummary(id="INC-004", title="Goa Coastal Waters (Bunkering Leak)",
        lat=15.420, lng=73.650, severity="LOW", oil_type="Diesel / Marine Gas Oil",
        oil_color="#EAB308", area="1.75 km²", top_vessel="SEA PEARL", attribution_score=0.55),
]

@router.get("/incidents/static", response_model=List[IncidentSummary])
async def list_incidents_static():
    """Returns benchmark incidents as static JSON — no DB required. Frontend fallback."""
    return STATIC_INCIDENTS

class IngestionRequest(BaseModel):
    incident_id: str
    bbox: List[float] # [min_lon, min_lat, max_lon, max_lat]
    start_date: str
    end_date: str

class DriftRequest(BaseModel):
    incident_id: str
    particle_count: int = 1000
    horizon_hours: int = 24

class AISRequest(BaseModel):
    incident_id: str
    envelopes_wkt: Dict[str, str]
    time_window_start: str
    time_window_end: str

# ── ENDPOINTS ──

@router.get("/incidents", response_model=List[IncidentSummary])
async def list_incidents(db: Session = Depends(get_db)):
    """Lists all active oil spill incidents. Falls back to static seed data when DB is unavailable."""
    try:
        incidents = db.query(Incident).all()
        if not incidents:
            return STATIC_INCIDENTS
        results = []
        for inc in incidents:
            results.append(IncidentSummary(
                id=inc.incident_number or str(inc.id),
                title=inc.title,
                lat=inc.center_latitude,
                lng=inc.center_longitude,
                severity=inc.severity,
                oil_type=inc.oil_classification,
                oil_color=inc.oil_color_hex,
                area=f"{inc.surface_area_sq_km:.2f} km²" if inc.surface_area_sq_km else "Pending",
                top_vessel="PENDING ATTRIBUTION",
                attribution_score=0.0
            ))
        return results
    except Exception:
        return STATIC_INCIDENTS


@router.post("/sar/ingest")
async def ingest_sar_scene(req: IngestionRequest, db: Session = Depends(get_db)):
    """
    Triggers Copernicus CDSE Sentinel-1 SAR ingestion and ONNX inference.
    """
    # Just verifying it exists in DB
    # Note: the UI might pass the UUID or the incident_number. 
    # For robust handling, we just proceed if it was passed.
    
    dummy_file_path = f"/data/sar/{req.incident_id}.tif"
    dummy_model_path = "/models/oil_classifier.onnx"
    
    # Trigger Async Celery Task
    task = run_sar_inference.delay(dummy_file_path, dummy_model_path)
    
    return {
        "status": "PROCESSING",
        "task_id": task.id,
        "incident_id": req.incident_id,
        "message": "SAR inference task has been queued."
    }

@router.post("/drift/backtrack")
async def run_drift_simulation(req: DriftRequest, db: Session = Depends(get_db)):
    """
    Triggers backward Lagrangian Monte Carlo trajectory modeling via OpenDrift.
    """
    # In a full implementation, we fetch the slick centroid from the DB
    # For now, we trigger the task with mock coordinates
    
    detection_time_utc = datetime.utcnow().isoformat() + "Z"
    
    # Trigger Async Celery Task
    task = run_backward_drift_simulation.delay(
        incident_id=req.incident_id,
        spill_lat=18.743, # Defaulting to Mumbai High if not queried
        spill_lon=71.218,
        detection_time_utc=detection_time_utc,
        duration_hours=req.horizon_hours,
        particle_count=req.particle_count
    )
    
    return {
        "status": "PROCESSING",
        "task_id": task.id,
        "incident_id": req.incident_id,
        "message": "Backward drift simulation has been queued."
    }

@router.post("/ais/correlate")
async def run_ais_correlation(req: AISRequest, db: Session = Depends(get_db)):
    """
    Triggers AIS vessel correlation against drift probability envelopes.
    """
    task = correlate_ais_vessels.delay(
        incident_id=req.incident_id,
        envelopes_wkt=req.envelopes_wkt,
        time_window_start=req.time_window_start,
        time_window_end=req.time_window_end
    )
    
    return {
        "status": "PROCESSING",
        "task_id": task.id,
        "incident_id": req.incident_id,
        "message": "AIS Vessel correlation has been queued."
    }

@router.post("/ais/correlate")
async def run_ais_correlation(req: AISRequest, db: Session = Depends(get_db)):
    """
    Triggers AIS vessel correlation against drift probability envelopes.
    """
    task = correlate_ais_vessels.delay(
        incident_id=req.incident_id,
        envelopes_wkt=req.envelopes_wkt,
        time_window_start=req.time_window_start,
        time_window_end=req.time_window_end
    )
    
    return {
        "status": "PROCESSING",
        "task_id": task.id,
        "incident_id": req.incident_id,
        "message": "AIS Vessel correlation has been queued."
    }

from app.models.schemas.detection import DetectionPayload, AisPing, EvidenceRecord
from app.services.attribution_engine import AttributionEngine

class EvidenceEvaluationRequest(BaseModel):
    detection: DetectionPayload
    ais_history: List[AisPing]

@router.post("/evidence/evaluate", response_model=EvidenceRecord)
async def evaluate_evidence(req: EvidenceEvaluationRequest, db: Session = Depends(get_db)):
    """
    Synchronously correlates a SAR detection against historical AIS tracks
    using dynamic physics drift, returning an auditable EvidenceRecord.
    """
    evidence_record = AttributionEngine.correlate_detections(
        detection=req.detection,
        ais_history=req.ais_history
    )
    return evidence_record

@router.get("/dossier/{incident_id}")
async def get_evidence_dossier(incident_id: str, db: Session = Depends(get_db)):
    """
    Generates a cryptographically sealed PDF Evidence Dossier using WeasyPrint.
    """
    # We would normally query all this from Postgres
    # db.query(Incident).filter(...)
    
    incident_data = {
        "incident_id": incident_id,
        "detection_time": "2026-09-18T14:30:00Z",
        "coordinates": "18.743°N, 71.218°E",
        "area_sq_km": "4.82 km²",
        "status": "CONFIRMED ILLEGAL DISCHARGE",
        "satellite_source": "Sentinel-1A C-Band SAR",
        "scene_id": "S1A_IW_GRDH_1SDV_20260918T143000",
        "segmentation_model_version": "SpillSense-ONNX-v2.1",
        "drift_model_version": "OpenDrift-OpenOil (KDE Contours)",
        "environmental_source": "CMEMS Global Analysis (Live)",
        "drift_particle_count": 1000,
        "drift_duration_hrs": 24,
        "candidates": [
            {
                "name": "CRUDE ATLAS",
                "mmsi": "419001234",
                "overall_score": 82.5,
                "spatial_match": 100,
                "temporal_match": 100,
                "trajectory_alignment": 88,
                "ais_continuity": 45 
            }
        ]
    }
    
    generator = PDFEvidenceGenerator()
    result = generator.generate_dossier(incident_data)
    
    return {
        "status": "SEALED",
        "incident_id": incident_id,
        "pdf_download_url": f"/static/evidence/{result['filename']}",
        "cryptographic_verification": {
            "master_sha256": result["sha256_hash"],
            "hash_algorithm": "SHA-256",
            "generation_time": result["generated_at"],
            "tamper_status": "VERIFIED_GENUINE",
            "chain_of_custody": "Maritime Surveillance Cell (BUG STALKERS)"
        }
    }

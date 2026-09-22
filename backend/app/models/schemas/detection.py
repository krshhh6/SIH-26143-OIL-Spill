from pydantic import BaseModel, Field
from typing import Optional, List, Tuple
from datetime import datetime
import uuid

class BoundingBox(BaseModel):
    min_lon: float
    min_lat: float
    max_lon: float
    max_lat: float

class DetectionPayload(BaseModel):
    """Raw inference output from the SAR trained model"""
    detection_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime
    sensor_id: str
    bounding_box: BoundingBox
    confidence_score: float = Field(ge=0.0, le=1.0)
    
    # Model derived physical attributes
    estimated_length_m: Optional[float] = None
    estimated_beam_m: Optional[float] = None
    heading_deg: Optional[float] = Field(None, ge=0, le=360)
    
    # Optional image chip path
    sar_chip_uri: Optional[str] = None

class DriftVector(BaseModel):
    """Calculated environmental drift vector applied"""
    u_current_ms: float
    v_current_ms: float
    u_wind_ms: float
    v_wind_ms: float
    drift_time_seconds: float
    
    # Resulting spatial displacement
    delta_x_m: float
    delta_y_m: float

class ConfidenceMatrix(BaseModel):
    """Breakdown of how strongly the AIS ping matches the SAR detection"""
    spatial_score: float = Field(ge=0.0, le=1.0) # How close to drift centroid?
    dimension_score: float = Field(ge=0.0, le=1.0) # Length/beam match?
    heading_score: float = Field(ge=0.0, le=1.0) # Heading alignment?
    overall_confidence: float = Field(ge=0.0, le=1.0)

class AisPing(BaseModel):
    mmsi: str
    timestamp: datetime
    lon: float
    lat: float
    sog_knots: Optional[float] = None # Speed over ground
    cog_deg: Optional[float] = None # Course over ground
    vessel_length_m: Optional[float] = None
    vessel_beam_m: Optional[float] = None
    vessel_type: Optional[str] = None

class EvidenceRecord(BaseModel):
    """Auditable chain of evidence linking SAR detection to AIS via physical drift"""
    incident_id: str
    record_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    detection: DetectionPayload
    classification: str = Field(..., description="Correlated (Reporting) | Suspect / Dark | Uncorrelated Novel")
    
    # The physical tracking that connects them
    drift_applied: Optional[DriftVector] = None
    
    # The matched AIS data (None if Uncorrelated Novel)
    correlated_ais: Optional[AisPing] = None
    
    confidence: Optional[ConfidenceMatrix] = None

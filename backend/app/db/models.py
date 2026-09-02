# -*- coding: utf-8 -*-
"""
Spill Sense (SIH26143) — SQLAlchemy Models
Implements schema.md Section 4 tables with PostGIS Geometry support.
CRS Standard: WGS 84 (EPSG:4326)
Time Standard: UTC (ISO 8601)
"""

import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Float, Integer, Boolean, DateTime,
    ForeignKey, Text, Enum as SQLEnum, JSON
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

# ── 4.1 INCIDENTS ──
class Incident(Base):
    __tablename__ = "incidents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    incident_number = Column(String(50), unique=True, nullable=False, index=True) # e.g. INC-2026-001
    title = Column(String(255), nullable=False)
    status = Column(String(50), default="DETECTED", nullable=False) # DETECTED, SIMULATED, ATTRIBUTED, CLOSED
    severity = Column(String(50), default="CRITICAL", nullable=False)
    oil_classification = Column(String(100), default="Crude Oil", nullable=False) # MARPOL Annex I
    oil_color_hex = Column(String(10), default="#B45309", nullable=False)
    
    center_latitude = Column(Float, nullable=False)
    center_longitude = Column(Float, nullable=False)
    surface_area_sq_km = Column(Float, nullable=True)
    estimated_volume_m3 = Column(Float, nullable=True)
    
    detection_time_utc = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    scenes = relationship("SatelliteScene", back_populates="incident")
    spills = relationship("OilSpill", back_populates="incident")
    drift_runs = relationship("DriftRun", back_populates="incident")
    reports = relationship("EvidenceArtifact", back_populates="incident")

# ── 4.2 SATELLITE SCENES ──
class SatelliteScene(Base):
    __tablename__ = "satellite_scenes"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id"), nullable=False)
    
    satellite_constellation = Column(String(50), default="Sentinel-1A", nullable=False)
    sensor_mode = Column(String(50), default="IW", nullable=False)
    polarization = Column(String(20), default="VV VH", nullable=False)
    scene_product_id = Column(String(255), unique=True, nullable=False)
    copernicus_id = Column(String(100), nullable=True)
    
    acquisition_time_utc = Column(DateTime, nullable=False)
    orbit_direction = Column(String(20), default="DESCENDING")
    
    raw_dn_min = Column(Float, nullable=True)
    raw_dn_max = Column(Float, nullable=True)
    sigma0_damping_db = Column(Float, default=-8.4, nullable=False) # Damping delta (dB)
    sha256_hash = Column(String(64), nullable=False)
    
    incident = relationship("Incident", back_populates="scenes")

# ── 4.4 OIL SPILLS (DETECTED SLICKS) ──
class OilSpill(Base):
    __tablename__ = "oil_spills"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id"), nullable=False)
    
    confidence_score = Column(Float, default=0.82, nullable=False) # [0, 1]
    segmentation_model = Column(String(100), default="U-Net (ResNet-50)", nullable=False)
    slick_geojson = Column(JSON, nullable=False) # GeoJSON Polygon (EPSG:4326)
    
    area_sq_km = Column(Float, nullable=False)
    wind_exclusion_passed = Column(Boolean, default=True, nullable=False)
    chlorophyll_exclusion_passed = Column(Boolean, default=True, nullable=False)
    
    incident = relationship("Incident", back_populates="spills")

# ── 4.6 DRIFT RUNS (LAGRANGIAN ENGINE) ──
class DriftRun(Base):
    __tablename__ = "drift_runs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id"), nullable=False)
    
    engine_name = Column(String(100), default="OpenDrift/OpenOil", nullable=False)
    direction = Column(String(20), default="BACKWARD", nullable=False)
    time_horizon_hours = Column(Integer, default=72, nullable=False)
    particle_count = Column(Integer, default=1000, nullable=False)
    numerical_scheme = Column(String(50), default="Runge-Kutta 4th Order", nullable=False)
    
    current_forcing_source = Column(String(100), default="CMEMS Global Ocean Current (0.083°)", nullable=False)
    wind_forcing_source = Column(String(100), default="ERA5 Reanalysis 10m Wind", nullable=False)
    wind_drift_factor = Column(Float, default=0.035, nullable=False) # 3.5% Stokes windage
    
    run_started_at = Column(DateTime, default=datetime.utcnow)
    run_completed_at = Column(DateTime, default=datetime.utcnow)
    
    incident = relationship("Incident", back_populates="drift_runs")
    envelopes = relationship("OriginEnvelope", back_populates="drift_run")

# ── 4.8 ORIGIN ENVELOPES ──
class OriginEnvelope(Base):
    __tablename__ = "origin_envelopes"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    drift_run_id = Column(UUID(as_uuid=True), ForeignKey("drift_runs.id"), nullable=False)
    
    probability_level = Column(Integer, nullable=False) # 50, 75, 90
    area_sq_km = Column(Float, nullable=False)
    polygon_geojson = Column(JSON, nullable=False) # GeoJSON Polygon
    centroid_lat = Column(Float, nullable=False)
    centroid_lng = Column(Float, nullable=False)
    
    drift_run = relationship("DriftRun", back_populates="envelopes")

# ── 4.9 VESSELS & CANDIDATES ──
class Vessel(Base):
    __tablename__ = "vessels"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mmsi = Column(Integer, unique=True, nullable=False, index=True)
    imo = Column(Integer, unique=True, nullable=True)
    vessel_name = Column(String(150), nullable=False)
    flag_state = Column(String(100), nullable=True)
    vessel_type = Column(String(100), default="Crude Oil Tanker", nullable=False)
    
    total_attribution_score = Column(Float, default=0.0, nullable=False)
    has_ais_gap = Column(Boolean, default=False, nullable=False)
    gap_duration_minutes = Column(Integer, default=0)

# ── 4.11 AIS GAPS (TRANSPONDER BLACKOUT) ──
class AISGap(Base):
    __tablename__ = "ais_gaps"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vessel_id = Column(UUID(as_uuid=True), ForeignKey("vessels.id"), nullable=False)
    
    gap_start_utc = Column(DateTime, nullable=False)
    gap_end_utc = Column(DateTime, nullable=False)
    duration_hours = Column(Float, nullable=False)
    
    last_known_lat = Column(Float, nullable=False)
    last_known_lng = Column(Float, nullable=False)
    reconnect_lat = Column(Float, nullable=False)
    reconnect_lng = Column(Float, nullable=False)
    
    speed_drop_knots = Column(Float, nullable=True) # e.g. 13.2kn -> 4.1kn
    inside_origin_envelope = Column(Boolean, default=True, nullable=False)

# ── 4.14 EVIDENCE ARTIFACTS & DOSSIER ──
class EvidenceArtifact(Base):
    __tablename__ = "evidence_artifacts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id"), nullable=False)
    
    artifact_type = Column(String(50), default="FORENSIC_DOSSIER_PDF", nullable=False)
    legal_framework = Column(String(150), default="Merchant Shipping Act 1958 §356 / MARPOL 73/78", nullable=False)
    master_sha256_hash = Column(String(64), nullable=False)
    verified_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    manifest_data = Column(JSON, nullable=False)
    
    incident = relationship("Incident", back_populates="reports")

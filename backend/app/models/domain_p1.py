import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Numeric, ForeignKey, Text, Enum, DateTime, BigInteger, JSON, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry, Geography
from app.models.base import Base
from app.models.enums import (
    IncidentStatus, Severity, DataSourceMode, SatelliteSource, ProductType,
    RasterStage, EnvironmentalSource, DataSourceFlag, CurrentSource, WindSource,
    JobStatus, JobType, ProbabilityBand, AisDataSource, AisGapClassification,
    ArtifactType, ModelComponent
)

def utcnow():
    return datetime.now(timezone.utc)

class Incident(Base):
    __tablename__ = "incidents"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    status = Column(Enum(IncidentStatus), default=IncidentStatus.created)
    severity = Column(Enum(Severity), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    region_of_interest = Column(Geometry("POLYGON", srid=4326), nullable=True)
    mode = Column(Enum(DataSourceMode), default=DataSourceMode.demo)
    notes = Column(Text, nullable=True)
    
    __table_args__ = (
        Index("ix_incidents_status", "status"),
        Index("ix_incidents_created_at", "created_at"),
    )

class SatelliteScene(Base):
    __tablename__ = "satellite_scenes"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id", ondelete="RESTRICT"))
    source = Column(Enum(SatelliteSource))
    scene_identifier = Column(Text)
    product_type = Column(Enum(ProductType))
    acquisition_time = Column(DateTime(timezone=True))
    footprint = Column(Geometry("POLYGON", srid=4326))
    file_hash = Column(Text)
    
    __table_args__ = (
        Index("ix_satellite_scenes_acquisition_time", "acquisition_time"),
    )

class RasterAsset(Base):
    __tablename__ = "raster_assets"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scene_id = Column(UUID(as_uuid=True), ForeignKey("satellite_scenes.id", ondelete="RESTRICT"))
    stage = Column(Enum(RasterStage))
    storage_uri = Column(Text)
    file_hash = Column(Text)
    crs = Column(Text)
    preprocessing_version = Column(Text)

class ModelVersion(Base):
    __tablename__ = "model_versions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    component = Column(Enum(ModelComponent))
    version_label = Column(Text)
    git_commit = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    notes = Column(Text, nullable=True)

class OilSpill(Base):
    __tablename__ = "oil_spills"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id", ondelete="RESTRICT"))
    scene_id = Column(UUID(as_uuid=True), ForeignKey("satellite_scenes.id", ondelete="RESTRICT"))
    geometry = Column(Geometry("MULTIPOLYGON", srid=4326))
    centroid = Column(Geography("POINT", srid=4326))
    bounding_box = Column(Geometry("POLYGON", srid=4326))
    area_sq_km = Column(Numeric)
    perimeter_km = Column(Numeric)
    segmentation_confidence = Column(Numeric(3,2))
    environmental_compatibility = Column(Numeric(3,2), nullable=True)
    look_alike_risk = Column(Numeric(3,2), nullable=True)
    final_confidence = Column(Numeric(3,2), nullable=True)
    model_version_id = Column(UUID(as_uuid=True), ForeignKey("model_versions.id", ondelete="RESTRICT"))
    detected_at = Column(DateTime(timezone=True))
    
    __table_args__ = (
        Index("ix_oil_spills_incident_id", "incident_id"),
        Index("ix_oil_spills_detected_at", "detected_at"),
    )

class EnvironmentalObservation(Base):
    __tablename__ = "environmental_observations"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    oil_spill_id = Column(UUID(as_uuid=True), ForeignKey("oil_spills.id", ondelete="RESTRICT"))
    source = Column(Enum(EnvironmentalSource))
    observation_time = Column(DateTime(timezone=True))
    wind_speed_ms = Column(Numeric)
    wind_direction_deg = Column(Numeric)
    current_speed_ms = Column(Numeric)
    current_direction_deg = Column(Numeric)
    data_source_flag = Column(Enum(DataSourceFlag))

class DriftRun(Base):
    __tablename__ = "drift_runs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    oil_spill_id = Column(UUID(as_uuid=True), ForeignKey("oil_spills.id", ondelete="RESTRICT"))
    simulation_start = Column(DateTime(timezone=True))
    simulation_end = Column(DateTime(timezone=True))
    timestep_seconds = Column(Integer)
    particle_count = Column(Integer)
    windage_coefficient = Column(Numeric)
    perturbation_model = Column(Text)
    forcing_current_source = Column(Enum(CurrentSource))
    forcing_wind_source = Column(Enum(WindSource))
    data_source_flag = Column(Enum(DataSourceFlag))
    software_version = Column(Text)
    status = Column(Enum(JobStatus))
    created_at = Column(DateTime(timezone=True), default=utcnow)

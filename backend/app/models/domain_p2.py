import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Numeric, ForeignKey, Text, Enum, DateTime, BigInteger, JSON, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry, Geography
from app.models.base import Base
from app.models.enums import (
    ProbabilityBand, AisDataSource, AisGapClassification, ArtifactType, JobStatus, JobType
)

def utcnow():
    return datetime.now(timezone.utc)

class DriftParticle(Base):
    __tablename__ = "drift_particles"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    drift_run_id = Column(UUID(as_uuid=True), ForeignKey("drift_runs.id", ondelete="RESTRICT"))
    member_index = Column(Integer)
    final_position = Column(Geography("POINT", srid=4326))
    final_time = Column(DateTime(timezone=True))
    
    __table_args__ = (
        Index("ix_drift_particles_drift_run_id", "drift_run_id"),
    )

class OriginEnvelope(Base):
    __tablename__ = "origin_envelopes"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    drift_run_id = Column(UUID(as_uuid=True), ForeignKey("drift_runs.id", ondelete="RESTRICT"))
    probability_band = Column(Enum(ProbabilityBand))
    geometry = Column(Geometry("MULTIPOLYGON", srid=4326))
    probability_threshold = Column(Numeric(3,2))

class Vessel(Base):
    __tablename__ = "vessels"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mmsi = Column(Text, unique=True, index=True)
    imo_number = Column(Text, nullable=True)
    vessel_name = Column(Text)
    vessel_type = Column(Text)
    data_source = Column(Enum(AisDataSource))

class AisPosition(Base):
    __tablename__ = "ais_positions"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    vessel_id = Column(UUID(as_uuid=True), ForeignKey("vessels.id", ondelete="RESTRICT"))
    position = Column(Geography("POINT", srid=4326))
    timestamp = Column(DateTime(timezone=True))
    speed_over_ground = Column(Numeric)
    course_over_ground = Column(Numeric)
    heading = Column(Numeric)
    navigational_status = Column(Text)
    
    __table_args__ = (
        Index("ix_ais_positions_timestamp", "timestamp"),
        Index("ix_ais_positions_vessel_id_timestamp", "vessel_id", "timestamp"),
    )

class AisGap(Base):
    __tablename__ = "ais_gaps"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vessel_id = Column(UUID(as_uuid=True), ForeignKey("vessels.id", ondelete="RESTRICT"))
    incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id", ondelete="RESTRICT"), nullable=True)
    gap_start = Column(DateTime(timezone=True))
    gap_end = Column(DateTime(timezone=True))
    classification = Column(Enum(AisGapClassification))
    last_known_position = Column(Geography("POINT", srid=4326))
    reappearance_position = Column(Geography("POINT", srid=4326), nullable=True)

class VesselCandidate(Base):
    __tablename__ = "vessel_candidates"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id", ondelete="RESTRICT"))
    vessel_id = Column(UUID(as_uuid=True), ForeignKey("vessels.id", ondelete="RESTRICT"))
    origin_envelope_id = Column(UUID(as_uuid=True), ForeignKey("origin_envelopes.id", ondelete="RESTRICT"))
    extracted_at = Column(DateTime(timezone=True))

class AttributionScore(Base):
    __tablename__ = "attribution_scores"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vessel_candidate_id = Column(UUID(as_uuid=True), ForeignKey("vessel_candidates.id", ondelete="RESTRICT"), unique=True)
    spatial_match = Column(Numeric(3,2))
    temporal_match = Column(Numeric(3,2))
    trajectory_alignment = Column(Numeric(3,2))
    behavior_signal = Column(Numeric(3,2))
    ais_continuity = Column(Numeric(3,2))
    overall_score = Column(Numeric(3,2))
    scoring_config_version = Column(Text)
    rank = Column(Integer)

class EvidenceArtifact(Base):
    __tablename__ = "evidence_artifacts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id", ondelete="RESTRICT"))
    artifact_type = Column(Enum(ArtifactType))
    storage_uri = Column(Text)
    sha256_hash = Column(Text)
    generated_at = Column(DateTime(timezone=True))
    provenance = Column(JSONB)

class Report(Base):
    __tablename__ = "reports"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id", ondelete="RESTRICT"))
    evidence_artifact_id = Column(UUID(as_uuid=True), ForeignKey("evidence_artifacts.id", ondelete="RESTRICT"))
    software_version = Column(Text)
    model_versions_snapshot = Column(JSONB)
    generated_at = Column(DateTime(timezone=True))

class ProcessingJob(Base):
    __tablename__ = "processing_jobs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id", ondelete="RESTRICT"))
    job_type = Column(Enum(JobType))
    status = Column(Enum(JobStatus))
    progress_pct = Column(Integer)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    __table_args__ = (
        Index("ix_processing_jobs_incident_id_status", "incident_id", "status"),
    )

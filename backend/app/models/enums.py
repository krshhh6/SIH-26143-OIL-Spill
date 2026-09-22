import enum

class IncidentStatus(str, enum.Enum):
    created = "created"
    processing = "processing"
    detected = "detected"
    traced = "traced"
    attributed = "attributed"
    evidence_ready = "evidence_ready"
    failed = "failed"

class Severity(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"

class DataSourceMode(str, enum.Enum):
    demo = "demo"
    live = "live"

class SatelliteSource(str, enum.Enum):
    copernicus = "copernicus"
    bhoonidhi = "bhoonidhi"
    cached_demo = "cached_demo"

class ProductType(str, enum.Enum):
    GRD = "GRD"
    SLC = "SLC"

class RasterStage(str, enum.Enum):
    raw = "raw"
    calibrated = "calibrated"
    normalized = "normalized"
    mask = "mask"

class EnvironmentalSource(str, enum.Enum):
    incois = "incois"
    cmems = "cmems"
    era5 = "era5"
    open_meteo = "open_meteo"
    cached = "cached"

class DataSourceFlag(str, enum.Enum):
    live = "live"
    cached = "cached"

class CurrentSource(str, enum.Enum):
    incois = "incois"
    cmems = "cmems"
    cached = "cached"

class WindSource(str, enum.Enum):
    era5 = "era5"
    open_meteo = "open_meteo"
    cached = "cached"

class JobStatus(str, enum.Enum):
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"

class JobType(str, enum.Enum):
    ingestion = "ingestion"
    sar_processing = "sar_processing"
    inference = "inference"
    drift_simulation = "drift_simulation"
    ais_analysis = "ais_analysis"
    evidence_generation = "evidence_generation"

class ProbabilityBand(str, enum.Enum):
    high = "high"
    medium = "medium"
    low = "low"

class AisDataSource(str, enum.Enum):
    marinecadastre = "marinecadastre"
    gfw = "gfw"
    cached = "cached"

class AisGapClassification(str, enum.Enum):
    normal = "normal"
    uncertain = "uncertain"
    suspicious = "suspicious"

class ArtifactType(str, enum.Enum):
    pdf_dossier = "pdf_dossier"
    map_image = "map_image"
    raw_data_export = "raw_data_export"

class ModelComponent(str, enum.Enum):
    segmentation_model = "segmentation_model"
    lookalike_scoring = "lookalike_scoring"
    drift_config = "drift_config"
    attribution_scoring = "attribution_scoring"
    ais_pipeline = "ais_pipeline"
    software_release = "software_release"

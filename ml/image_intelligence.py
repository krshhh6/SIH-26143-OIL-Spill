# -*- coding: utf-8 -*-
"""
Spill Sense (SIH-26143) — ML Image Intelligence Bridge
Exposes SAR Image Intelligence services to the ML & data pipeline.
"""

import sys
from pathlib import Path

# Add backend directory to sys.path if not present
backend_dir = Path(__file__).resolve().parent.parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.services.image_intelligence import (
    ImageModality,
    IdentityMatchStatus,
    ImageIdentity,
    GeoTIFFReader,
    RasterQualityAnalyzer,
    ImageModalityClassifier,
    WebPreviewGenerator,
    SARImageIntelligenceService
)

__all__ = [
    "ImageModality",
    "IdentityMatchStatus",
    "ImageIdentity",
    "GeoTIFFReader",
    "RasterQualityAnalyzer",
    "ImageModalityClassifier",
    "WebPreviewGenerator",
    "SARImageIntelligenceService"
]

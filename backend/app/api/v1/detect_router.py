# -*- coding: utf-8 -*-
"""
Spill Sense (SIH26143) — Real Sentinel-1 SAR + ML Segmentation Detection API
Endpoints:
- POST /api/v1/detect (and /api/detect)
- GET /api/v1/detect/status/{job_id}
"""

import uuid
import datetime
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional

from app.services.cdse_sar_service import CDSESARService
from app.services.sar_preprocessing import SARPreprocessor
from app.services.sar_segmentation_model import SARSPILLSegmentationEngine

router = APIRouter(tags=["Sentinel-1 SAR Detection Pipeline"])

# Singleton engine instance
segmentation_engine = SARSPILLSegmentationEngine()

# Asynchronous job store
DETECTION_JOBS: Dict[str, Dict[str, Any]] = {}

class DetectionRequest(BaseModel):
    aoi: Optional[Dict[str, Any]] = Field(
        default=None,
        description="GeoJSON Polygon defining Area of Interest. If omitted, default incident AOI is used."
    )
    date_range: Optional[List[str]] = Field(
        default=None,
        description="[start_iso_date, end_iso_date] lookback range."
    )
    client_id: Optional[str] = Field(default=None, description="Optional CDSE Client ID")
    client_secret: Optional[str] = Field(default=None, description="Optional CDSE Client Secret")
    sensitivity: float = Field(default=0.35, ge=0.1, le=0.9, description="U-Net probability threshold")
    async_mode: bool = Field(default=False, description="Run detection asynchronously")

def _extract_bbox_from_aoi(aoi: Optional[Dict[str, Any]]) -> List[float]:
    """Extracts [min_lon, min_lat, max_lon, max_lat] from GeoJSON Polygon."""
    if not aoi or "coordinates" not in aoi:
        # Default to Mumbai High / Arabian Sea EEZ
        return [70.9, 18.4, 71.5, 19.0]

    coords = aoi["coordinates"]
    if not coords or not coords[0]:
        return [70.9, 18.4, 71.5, 19.0]

    ring = coords[0]
    lons = [pt[0] for pt in ring]
    lats = [pt[1] for pt in ring]
    return [min(lons), min(lats), max(lons), max(lats)]

def _execute_detection(req: DetectionRequest) -> Dict[str, Any]:
    bbox = _extract_bbox_from_aoi(req.aoi)
    cdse = CDSESARService(client_id=req.client_id, client_secret=req.client_secret)

    end_date = req.date_range[1] if (req.date_range and len(req.date_range) > 1) else None
    scene_info = cdse.search_latest_sentinel1_scene(bbox=bbox, lookback_days=30, end_date=end_date)

    if not scene_info:
        return {
            "status": "no_recent_imagery",
            "message": "No Sentinel-1 IW GRD passes found over the requested AOI within lookback window (30 days).",
            "aoi": req.aoi,
            "polygons": [],
            "model_version": segmentation_engine.MODEL_VERSION,
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
        }

    # Pull calibrated SAR backscatter tile
    vv_arr, vh_arr, cal_factor = cdse.fetch_sar_backscatter_tile(bbox, scene_info, grid_size=(256, 256))

    # Preprocessing Pipeline:
    # 1. Radiometric calibration to sigma0 (dB)
    sigma0_db = SARPreprocessor.calibrate_to_sigma0_db(vv_arr, cal_factor)
    # 2. Adaptive Lee speckle filtering
    filtered_db = SARPreprocessor.lee_speckle_filter(sigma0_db, window_size=5)
    # 3. Land-sea masking
    masked_sar, sea_mask = SARPreprocessor.mask_land_pixels(filtered_db)

    # ML Inference via PyTorch U-Net (SOS benchmark)
    polygons = segmentation_engine.run_inference(
        sar_sigma0_db=masked_sar,
        sea_mask=sea_mask,
        bbox=bbox,
        sensitivity_threshold=req.sensitivity,
        min_area_km2=0.05
    )

    if not polygons:
        return {
            "status": "no_oil_detected",
            "scene_timestamp": scene_info["scene_timestamp"],
            "sensor": scene_info["sensor"],
            "scene_id": scene_info["name"],
            "polarization": scene_info["polarization"],
            "orbit_direction": scene_info["orbit_direction"],
            "polygons": [],
            "total_detected_area_km2": 0.0,
            "model_version": segmentation_engine.MODEL_VERSION,
            "message": f"No hydrocarbon signature detected in the most recent Sentinel-1 pass ({scene_info['scene_timestamp'][:10]})."
        }

    total_area = round(sum(p["area_km2"] for p in polygons), 2)

    return {
        "status": "detected",
        "scene_timestamp": scene_info["scene_timestamp"],
        "sensor": scene_info["sensor"],
        "scene_id": scene_info["name"],
        "polarization": scene_info["polarization"],
        "orbit_direction": scene_info["orbit_direction"],
        "polygons": polygons,
        "total_detected_area_km2": total_area,
        "model_version": segmentation_engine.MODEL_VERSION,
        "message": f"Active hydrocarbon signature detected across {len(polygons)} slick segment(s) totaling {total_area} km²."
    }

@router.post("/detect")
@router.post("/v1/detect")
async def detect_oil_spill(req: DetectionRequest, background_tasks: BackgroundTasks):
    """
    Executes end-to-end Sentinel-1 SAR oil spill detection:
    1. Finds latest Sentinel-1 IW GRD pass over AOI in Copernicus Data Space Ecosystem.
    2. Performs radiometric calibration to sigma0 (dB) + Lee speckle filtering.
    3. Runs PyTorch U-Net segmentation trained on Sentinel-1 SAR Oil Spill (SOS) dataset.
    4. Converts raster mask to vector polygons with geodesic area (km²).
    """
    if req.async_mode:
        job_id = f"job-{uuid.uuid4().hex[:12]}"
        DETECTION_JOBS[job_id] = {
            "status": "PROCESSING",
            "job_id": job_id,
            "started_at": datetime.datetime.utcnow().isoformat() + "Z",
            "result": None
        }

        def run_async_task(jid: str, request_data: DetectionRequest):
            try:
                res = _execute_detection(request_data)
                DETECTION_JOBS[jid]["status"] = "COMPLETED"
                DETECTION_JOBS[jid]["result"] = res
            except Exception as ex:
                DETECTION_JOBS[jid]["status"] = "FAILED"
                DETECTION_JOBS[jid]["error"] = str(ex)

        background_tasks.add_task(run_async_task, job_id, req)
        return {
            "job_id": job_id,
            "status": "PROCESSING",
            "message": "Sentinel-1 pass query and SAR U-Net inference initiated."
        }

    return _execute_detection(req)

@router.get("/detect/status/{job_id}")
@router.get("/v1/detect/status/{job_id}")
async def get_detection_status(job_id: str):
    """Retrieves status and output of an asynchronous detection job."""
    if job_id not in DETECTION_JOBS:
        raise HTTPException(status_code=404, detail="Detection job ID not found.")
    return DETECTION_JOBS[job_id]

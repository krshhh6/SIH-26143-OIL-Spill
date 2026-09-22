# -*- coding: utf-8 -*-
"""
Spill Sense (SIH26143) — AISHub Live Maritime Routing & Attribution Endpoints
"""

from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.services.aishub_service import AISHubService

router = APIRouter(prefix="/ais", tags=["AIS Maritime Surveillance"])

ais_service = AISHubService()

class CorrelationWeights(BaseModel):
    dist: float = 0.30
    time: float = 0.25
    gap: float = 0.20
    type: float = 0.15

class CorrelateRequest(BaseModel):
    incident_id: str = "INC-2026-001"
    lat: float = 18.743
    lng: float = 71.218
    radius_nm: float = 30.0
    username: Optional[str] = None
    weights: CorrelationWeights = CorrelationWeights()

@router.get("/live")
async def get_live_ais_vessels(
    latmin: float = Query(17.5, description="South latitude"),
    latmax: float = Query(19.5, description="North latitude"),
    lonmin: float = Query(70.0, description="West longitude"),
    lonmax: float = Query(72.5, description="East longitude"),
    username: Optional[str] = Query(None, description="Optional AISHub username")
):
    """
    Fetches real-time AIS vessel locations from AISHub webservice.
    Cached for 60 seconds to satisfy AISHub's rate limit.
    """
    return ais_service.get_live_vessels(latmin, latmax, lonmin, lonmax, username=username)

@router.post("/score")
@router.post("/attribute")
async def score_vessels(req: CorrelateRequest):
    """
    Computes explainable vessel attribution scores across live/cached AISHub vessels
    using customizable spatiotemporal sensitivity weights.
    """
    deg_delta = req.radius_nm / 60.0
    latmin = req.lat - deg_delta
    latmax = req.lat + deg_delta
    lonmin = req.lng - deg_delta
    lonmax = req.lng + deg_delta

    feed = ais_service.get_live_vessels(latmin, latmax, lonmin, lonmax, username=req.username)
    raw_vessels = feed.get("vessels", [])

    w = req.weights
    total_w = w.dist + w.time + w.gap + w.type or 1.0

    ranked = []
    for v in raw_vessels:
        # Distance score: closer CPA => higher score
        cpa = v.get("cpa_nm", 10.0)
        s_dist = max(0.0, min(1.0, 1.0 - (cpa / req.radius_nm)))

        # AIS Gap score: larger gap near slick => higher suspicion
        gap_h = v.get("ais_gap_hours", 0.0)
        s_gap = min(1.0, gap_h / 4.0)

        # Vessel type score
        v_type = v.get("type", "").lower()
        if "crude" in v_type:
            s_type = 0.95
        elif "product" in v_type or "bunker" in v_type:
            s_type = 0.85
        elif "chemical" in v_type:
            s_type = 0.70
        elif "cargo" in v_type or "container" in v_type:
            s_type = 0.35
        else:
            s_type = 0.20

        # Time score (derived or default 0.80)
        s_time = v.get("timeScore", 0.80)

        # Weighted Attribution Score
        score = (w.dist * s_dist + w.time * s_time + w.gap * s_gap + w.type * s_type) / total_w
        score = round(min(1.0, max(0.05, score)), 2)

        v_copy = dict(v)
        v_copy["attribution_score"] = score
        v_copy["metrics"] = {
            "spatial_match_pct": round(s_dist * 100),
            "temporal_alignment_pct": round(s_time * 100),
            "dark_gap_suspicion_pct": round(s_gap * 100),
            "vessel_risk_prior_pct": round(s_type * 100)
        }
        ranked.append(v_copy)

    # Sort descending by attribution score
    ranked.sort(key=lambda x: x["attribution_score"], reverse=True)

    # Assign ranks
    for idx, r in enumerate(ranked):
        r["rank"] = idx + 1

    return {
        "status": "SUCCESS",
        "incident_id": req.incident_id,
        "feed_source": feed.get("source"),
        "total_vessels_screened": len(ranked),
        "candidates": ranked,
        "active_weights": w.dict()
    }

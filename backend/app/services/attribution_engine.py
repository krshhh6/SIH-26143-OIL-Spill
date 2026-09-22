import math
from typing import List, Tuple, Optional
from app.models.schemas.detection import DetectionPayload, AisPing, ConfidenceMatrix, EvidenceRecord
from app.services.environmental_service import EnvironmentalService

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance in meters between two points on the earth."""
    R = 6371000  # radius of Earth in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

class AttributionEngine:
    """
    Engine to correlate SAR model detections with AIS data using dynamic physics drift.
    """
    
    @staticmethod
    def correlate_detections(detection: DetectionPayload, ais_history: List[AisPing]) -> EvidenceRecord:
        """
        Cross-references a SAR detection against historical AIS tracks.
        Returns the strongest EvidenceRecord match, or a Novel detection if no matches found.
        """
        
        # Calculate SAR centroid
        det_lon = (detection.bounding_box.min_lon + detection.bounding_box.max_lon) / 2.0
        det_lat = (detection.bounding_box.min_lat + detection.bounding_box.max_lat) / 2.0
        
        best_match: Optional[AisPing] = None
        best_confidence: Optional[ConfidenceMatrix] = None
        best_drift = None
        highest_score = 0.0
        
        for ais in ais_history:
            # We only project forward in time (AIS ping -> SAR detection time)
            if ais.timestamp > detection.timestamp:
                continue
                
            # 1. Physics-based Kinematic Drift
            drift_result = EnvironmentalService.calculate_kinematic_drift(
                start_lat=ais.lat,
                start_lon=ais.lon,
                start_time=ais.timestamp,
                end_time=detection.timestamp,
                windage_coefficient=0.03 # Standard baseline
            )
            
            projected_lat = drift_result["end_lat"]
            projected_lon = drift_result["end_lon"]
            
            # 2. Spatial Scoring
            distance_m = haversine_distance(projected_lat, projected_lon, det_lat, det_lon)
            
            # Score decays exponentially with distance. E.g., 500m off is a score of ~0.6
            # Assuming a drift uncertainty radius (which could be dynamic, but static here for MVP)
            uncertainty_radius_m = 1000.0 + (drift_result["drift_vector"]["drift_time_seconds"] * 0.1)
            spatial_score = math.exp(- (distance_m / uncertainty_radius_m))
            
            # 3. Dimension Scoring
            dimension_score = 1.0 # Default if no data
            if detection.estimated_length_m and ais.vessel_length_m:
                # E.g. difference of 10% drops score
                length_diff = abs(detection.estimated_length_m - ais.vessel_length_m)
                dimension_score = math.exp(- (length_diff / (ais.vessel_length_m * 0.2)))
                
            # 4. Heading Scoring
            heading_score = 1.0 # Default
            if detection.heading_deg is not None and ais.cog_deg is not None:
                diff = abs(detection.heading_deg - ais.cog_deg)
                if diff > 180:
                    diff = 360 - diff
                # Score drops to ~0.3 if off by 45 degrees
                heading_score = math.exp(- (diff / 30.0))
                
            # Weighted Overall Confidence
            overall = (spatial_score * 0.6) + (dimension_score * 0.25) + (heading_score * 0.15)
            
            if overall > highest_score:
                highest_score = overall
                best_match = ais
                best_drift = drift_result["drift_vector"]
                best_confidence = ConfidenceMatrix(
                    spatial_score=max(0.0, min(1.0, spatial_score)),
                    dimension_score=max(0.0, min(1.0, dimension_score)),
                    heading_score=max(0.0, min(1.0, heading_score)),
                    overall_confidence=max(0.0, min(1.0, overall))
                )
                
        # Determine classification
        if not best_match or highest_score < 0.2:
            return EvidenceRecord(
                incident_id="TBD_INCIDENT",
                detection=detection,
                classification="Uncorrelated Novel",
                drift_applied=None,
                correlated_ais=None,
                confidence=None
            )
            
        elif highest_score >= 0.6:
            classification = "Correlated (Reporting)"
        else:
            # Low match, could be spoofed or heavily obscured
            classification = "Suspect / Dark"
            
        return EvidenceRecord(
            incident_id="TBD_INCIDENT",
            detection=detection,
            classification=classification,
            drift_applied=best_drift,
            correlated_ais=best_match,
            confidence=best_confidence
        )

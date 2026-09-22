import os
from datetime import datetime, timedelta
import numpy as np
from celery import shared_task
from scipy.stats import gaussian_kde
from shapely.geometry import Polygon, MultiPolygon
import json
try:
    from opendrift.models.openoil import OpenOil
    from opendrift.readers import reader_netCDF_CF_generic
    from opendrift.models.physics_methods import HorizontalDiffusion
except ImportError:
    OpenOil = None
    reader_netCDF_CF_generic = None
    HorizontalDiffusion = None

from app.services.environmental_service import EnvironmentalService

# Fallback basic contour extraction since we might not have scikit-image installed
def extract_contour_from_kde(x_grid, y_grid, z, threshold):
    """
    Very basic marching squares contour extraction fallback.
    In production, use skimage.measure.find_contours.
    """
    # For hackathon safety without breaking pip dependencies, 
    # we return a bounding box of points above threshold
    mask = z > threshold
    if not np.any(mask):
        return None
    valid_x = x_grid[mask]
    valid_y = y_grid[mask]
    
    # Return convex hull of these valid points to approximate the contour
    from scipy.spatial import ConvexHull
    points = np.column_stack((valid_x, valid_y))
    if len(points) < 3:
        return None
        
    try:
        hull = ConvexHull(points)
        hull_points = points[hull.vertices]
        hull_points_closed = np.vstack([hull_points, hull_points[0]])
        return Polygon(hull_points_closed)
    except:
        return None


@shared_task
def run_backward_drift_simulation(
    incident_id: str,
    spill_lat: float, 
    spill_lon: float, 
    detection_time_utc: str, 
    duration_hours: int = 24, 
    particle_count: int = 1000
):
    """
    Executes a high-precision backward Lagrangian drift simulation.
    Generates High (50%), Medium (75%), and Low (95%) confidence envelopes.
    """
    if OpenOil is None:
        return {"status": "failed", "error": "OpenDrift library not installed."}

    try:
        # 1. Initialize OpenOil Engine
        o = OpenOil(loglevel=50) 
        
        # Add physics
        o.set_config('drift:horizontal_diffusivity_fallback', 10) # 10 m2/s
        o.set_config('drift:wind_drift_factor', 0.03) # Standard 3% wind drift

        # 2. Add Forcing Data (Live or Cached)
        env_data = EnvironmentalService.get_forcing_data(spill_lat, spill_lon, detection_time_utc)
        
        if env_data.get("currents_path") and os.path.exists(env_data["currents_path"]):
            reader_current = reader_netCDF_CF_generic.Reader(env_data["currents_path"])
            o.add_reader(reader_current)
        if env_data.get("winds_path") and os.path.exists(env_data["winds_path"]):
            reader_wind = reader_netCDF_CF_generic.Reader(env_data["winds_path"])
            o.add_reader(reader_wind)

        # 3. Seed Monte Carlo Particles
        time_start = datetime.fromisoformat(detection_time_utc.replace("Z", "+00:00"))
        o.seed_elements(
            lon=spill_lon,
            lat=spill_lat,
            radius=1500, # Initial 1.5km dispersion footprint
            number=particle_count,
            time=time_start,
            oil_type='GENERIC MEDIUM CRUDE'
        )

        # 4. Run Backward Simulation
        o.run(
            duration=timedelta(hours=duration_hours),
            time_step=timedelta(minutes=-15), # Finer time step for precision
            time_step_output=timedelta(hours=1)
        )

        # 5. Extract Final Positions
        final_lons = o.history.lon[:, -1]
        final_lats = o.history.lat[:, -1]
        
        valid = ~np.isnan(final_lons) & ~np.isnan(final_lats)
        valid_lons = final_lons[valid]
        valid_lats = final_lats[valid]

        if len(valid_lons) < 10:
            return {"status": "failed", "error": "Insufficient valid particles."}

        # 6. Perform KDE for Probability Contours
        positions = np.vstack([valid_lons, valid_lats])
        kernel = gaussian_kde(positions, bw_method='silverman')
        
        # Create a grid for KDE evaluation
        lon_min, lon_max = valid_lons.min() - 0.1, valid_lons.max() + 0.1
        lat_min, lat_max = valid_lats.min() - 0.1, valid_lats.max() + 0.1
        
        lon_grid, lat_grid = np.mgrid[lon_min:lon_max:100j, lat_min:lat_max:100j]
        grid_coords = np.vstack([lon_grid.ravel(), lat_grid.ravel()])
        z = kernel(grid_coords).reshape(100, 100)
        
        # Calculate density thresholds for 50%, 75%, 95% 
        z_flat = z.ravel()
        z_flat_sorted = np.sort(z_flat)[::-1]
        z_cumsum = np.cumsum(z_flat_sorted)
        z_cumsum_normalized = z_cumsum / z_cumsum[-1]
        
        def get_threshold(percentile):
            idx = np.searchsorted(z_cumsum_normalized, percentile)
            if idx >= len(z_flat_sorted): idx = len(z_flat_sorted) - 1
            return z_flat_sorted[idx]
            
        thresh_50 = get_threshold(0.50) # High confidence
        thresh_75 = get_threshold(0.75) # Medium confidence
        thresh_95 = get_threshold(0.95) # Low confidence
        
        # Extract polygons
        poly_high = extract_contour_from_kde(lon_grid, lat_grid, z, thresh_50)
        poly_med = extract_contour_from_kde(lon_grid, lat_grid, z, thresh_75)
        poly_low = extract_contour_from_kde(lon_grid, lat_grid, z, thresh_95)
        
        from shapely.geometry import mapping
        
        envelopes_geojson = {}
        
        def to_geojson_feature(poly, prob):
            return {
                "type": "Feature",
                "properties": {"probability": prob},
                "geometry": mapping(poly)
            }
            
        features = []
        if poly_high: 
            features.append(to_geojson_feature(poly_high, "50%"))
        if poly_med: 
            features.append(to_geojson_feature(poly_med, "75%"))
        if poly_low: 
            features.append(to_geojson_feature(poly_low, "95%"))
            
        feature_collection = {
            "type": "FeatureCollection",
            "features": features
        }

        result_payload = {
            "status": "success",
            "incident_id": incident_id,
            "envelopes_geojson": feature_collection,
            "data_source_flag": env_data["data_source_flag"],
            "particle_count_final": len(valid_lons)
        }
        
        # Broadcast via WebSockets to React Frontend
        try:
            import socketio
            redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
            mgr = socketio.RedisManager(redis_url, write_only=True)
            mgr.emit('drift_completed', data=result_payload)
            print("[Celery] Successfully broadcasted drift_completed via WebSockets.")
        except Exception as ws_err:
            print(f"[Celery] Failed to broadcast WebSocket event: {ws_err}")

        return result_payload

    except Exception as e:
        return {"status": "failed", "error": str(e)}

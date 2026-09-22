import os
import logging
from typing import Dict
from datetime import datetime, timedelta

try:
    import copernicusmarine
except ImportError:
    copernicusmarine = None

logger = logging.getLogger(__name__)

class EnvironmentalService:
    """
    Handles fetching and caching of ocean current and wind data 
    (from CMEMS via copernicusmarine package) for the OpenDrift engine.
    """
    
    @staticmethod
    def get_forcing_data(incident_lat: float, incident_lon: float, timestamp_utc: str, force_cached: bool = False) -> Dict[str, str]:
        """
        Retrieves NetCDF forcing data or returns paths to cached files.
        Uses CMEMS live data if credentials are set, otherwise falls back to demo cache.
        """
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        data_dir = os.path.join(base_dir, '..', 'data', 'environmental')
        os.makedirs(data_dir, exist_ok=True)
        
        cached_currents = os.path.join(data_dir, 'cached_currents.nc')
        cached_winds = os.path.join(data_dir, 'cached_winds.nc')
        
        cmems_user = os.getenv("COPERNICUS_USERNAME")
        cmems_pass = os.getenv("COPERNICUS_PASSWORD")
        
        # If forced to cached, or no credentials/library available, use cached mode
        if force_cached or not copernicusmarine or not cmems_user or not cmems_pass:
            return {
                "currents_path": cached_currents,
                "winds_path": cached_winds,
                "data_source_flag": "cached"
            }
            
        try:
            # We need data for 24 hours prior to the detection time
            end_time = datetime.fromisoformat(timestamp_utc.replace("Z", "+00:00"))
            start_time = end_time - timedelta(hours=36) # Buffer
            
            # Spatial bounding box for download (e.g. +/- 1.5 degrees from spill)
            min_lon, max_lon = incident_lon - 1.5, incident_lon + 1.5
            min_lat, max_lat = incident_lat - 1.5, incident_lat + 1.5
            
            currents_filename = f"cmems_currents_{int(end_time.timestamp())}.nc"
            currents_out = os.path.join(data_dir, currents_filename)
            
            if not os.path.exists(currents_out):
                # Download Global Ocean Physics Analysis and Forecast
                copernicusmarine.subset(
                    dataset_id="cmems_mod_glo_phy_anfc_0.083deg_PT1H-m",
                    variables=["uo", "vo"],
                    start_datetime=start_time.strftime("%Y-%m-%dT%H:%M:%S"),
                    end_datetime=end_time.strftime("%Y-%m-%dT%H:%M:%S"),
                    minimum_longitude=min_lon,
                    maximum_longitude=max_lon,
                    minimum_latitude=min_lat,
                    maximum_latitude=max_lat,
                    minimum_depth=0.49,
                    maximum_depth=0.51, # Surface currents only
                    output_filename=currents_out,
                    username=cmems_user,
                    password=cmems_pass,
                    force_download=True
                )
                
            return {
                "currents_path": currents_out,
                "winds_path": cached_winds, # Usually use ECMWF ERA5 or similar for winds, keeping cached for simplicity unless specified
                "data_source_flag": "live_cmems"
            }
            
        except Exception as e:
            logger.error(f"Live CMEMS download failed: {str(e)}. Falling back to cache.")
            return {
                "currents_path": cached_currents,
                "winds_path": cached_winds,
                "data_source_flag": "cached_fallback"
            }

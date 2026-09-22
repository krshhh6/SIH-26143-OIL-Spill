"""
SpillSense (SIH-26143) — SAR Preprocessing Engine v3
====================================================
Handles verified Sentinel-1 SAR dual-polarization (VV/VH) TIFF ingestion,
mask loading, calibrated dB normalization, and patch extraction using
real ground-truth masks from the Zenodo dataset.

Band Mapping (Verified):
    Band 0 = VH (cross-pol, median ≈ -33 dB)
    Band 1 = VV (co-pol, median ≈ -20 dB)
"""

from pathlib import Path
from typing import Tuple, Optional
import numpy as np
import tifffile

from ml.config import CONFIG, SpillSenseConfig


def load_sentinel1_scene(tiff_path: Path) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Ingests an authentic dual-polarization Sentinel-1 GeoTIFF scene.
    
    Returns:
        vv: 2D numpy array (float32) in Sigma0 dB (Co-polarization, Band 1)
        vh: 2D numpy array (float32) in Sigma0 dB (Cross-polarization, Band 0)
        valid_mask: 2D boolean mask indicating valid marine backscatter pixels
    """
    tiff_path = Path(tiff_path)
    try:
        data = tifffile.imread(str(tiff_path))
    except Exception as e:
        raise IOError(f"Failed to read GeoTIFF {tiff_path}: {e}")

    # Handle shape conventions: (H, W, 2) or (2, H, W)
    if data.ndim == 3:
        if data.shape[-1] == 2:
            # Verified: Index 1 = VV (co-pol), Index 0 = VH (cross-pol)
            vv = data[:, :, 1].astype(np.float32)
            vh = data[:, :, 0].astype(np.float32)
        elif data.shape[0] == 2:
            vv = data[1, :, :].astype(np.float32)
            vh = data[0, :, :].astype(np.float32)
        else:
            raise ValueError(f"Unexpected 3D GeoTIFF shape {data.shape} in {tiff_path}")
    elif data.ndim == 2:
        # Fallback single band (treat as VV, synthesize VH with physical offset)
        vv = data.astype(np.float32)
        vh = vv - 10.5
    else:
        raise ValueError(f"Unsupported GeoTIFF dimension {data.ndim} in {tiff_path}")

    # Handle NaN, Inf, and invalid pixels
    finite_mask = np.isfinite(vv) & np.isfinite(vh)

    # Valid marine microwave backscatter range: [-60 dB, +20 dB]
    valid_mask = finite_mask & (vv > -60.0) & (vv < 20.0) & (vh > -70.0) & (vh < 15.0)

    # Sanitize invalid pixels with realistic radar noise floors
    vv = np.where(valid_mask, vv, -45.0)
    vh = np.where(valid_mask, vh, -55.0)

    return vv, vh, valid_mask


def load_mask(mask_path: Path) -> Optional[np.ndarray]:
    """
    Loads a ground-truth binary mask from the Zenodo dataset.
    
    Returns:
        mask: 2D numpy array (uint8) with values 0 (background) and 1 (foreground/oil)
              Returns None if mask file doesn't exist.
    """
    mask_path = Path(mask_path)
    if not mask_path.exists():
        return None

    try:
        mask = tifffile.imread(str(mask_path))
    except Exception as e:
        print(f"[PREPROCESS WARN] Failed to read mask {mask_path}: {e}")
        return None

    # Handle potential multi-band mask
    if mask.ndim == 3:
        mask = mask[:, :, 0]

    # Ensure binary
    mask = (mask > 0).astype(np.uint8)
    return mask


def normalize_sar_dualpol(
    vv: np.ndarray,
    vh: np.ndarray,
    config: SpillSenseConfig = CONFIG
) -> np.ndarray:
    """
    Normalizes VV and VH Sigma0 dB backscatter independently to [0.0, 1.0].
    Preserves physical SAR contrast and morphological gradient information.
    
    Returns:
        stacked: 3D float32 array with shape (2, H, W) where:
                 Channel 0 = Normalized VV [0.0, 1.0]
                 Channel 1 = Normalized VH [0.0, 1.0]
    """
    vv_clipped = np.clip(vv, config.vv_min_db, config.vv_max_db)
    vv_norm = (vv_clipped - config.vv_min_db) / (config.vv_max_db - config.vv_min_db)

    vh_clipped = np.clip(vh, config.vh_min_db, config.vh_max_db)
    vh_norm = (vh_clipped - config.vh_min_db) / (config.vh_max_db - config.vh_min_db)

    stacked = np.stack([vv_norm, vh_norm], axis=0).astype(np.float32)
    return stacked


def verify_scene(tiff_path: Path, verbose: bool = False) -> dict:
    """
    Verify a single scene's band structure and value range.
    Returns a dict with verification results.
    """
    data = tifffile.imread(str(tiff_path))
    result = {
        "path": str(tiff_path),
        "shape": data.shape,
        "dtype": str(data.dtype),
    }

    if data.ndim == 3 and data.shape[-1] == 2:
        b0 = data[:, :, 0].astype(np.float32)
        b1 = data[:, :, 1].astype(np.float32)

        b0_med = float(np.nanmedian(b0))
        b1_med = float(np.nanmedian(b1))

        result["band0_median_db"] = b0_med
        result["band1_median_db"] = b1_med
        result["band0_is_vh"] = b0_med < b1_med  # VH is weaker
        result["band1_is_vv"] = b0_med < b1_med
        result["is_sigma0_db"] = b0_med < 0 and b1_med < 0  # dB values are negative
        result["valid"] = result["band0_is_vh"] and result["is_sigma0_db"]

        if verbose:
            vh_str = "VH" if result["band0_is_vh"] else "VV"
            vv_str = "VV" if result["band1_is_vv"] else "VH"
            print(f"  {tiff_path.name}: Band0={vh_str}({b0_med:.1f}dB) Band1={vv_str}({b1_med:.1f}dB) Sigma0dB={'OK' if result['is_sigma0_db'] else 'FAIL'}")
    else:
        result["valid"] = False

    return result

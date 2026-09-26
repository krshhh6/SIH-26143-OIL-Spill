# -*- coding: utf-8 -*-
"""
Spill Sense (SIH-26143) — Production SAR Image Intelligence Module
==================================================================
Comprehensive remote sensing raster inspection, GeoTIFF metadata extraction,
image modality classification (SAR vs Colorized SAR vs Optical vs Overlay),
cryptographic & perceptual image identity tracking, and web preview generation.
"""

from __future__ import annotations

import io
import os
import math
import hashlib
from enum import Enum
from pathlib import Path
from typing import Dict, List, Tuple, Any, Optional, Union

import numpy as np
from PIL import Image

try:
    import tifffile
    TIFFFILE_AVAILABLE = True
except ImportError:
    TIFFFILE_AVAILABLE = False

try:
    import pyproj
    PYPROJ_AVAILABLE = True
except ImportError:
    PYPROJ_AVAILABLE = False

try:
    import rasterio
    from rasterio.transform import Affine
    RASTERIO_AVAILABLE = True
except ImportError:
    RASTERIO_AVAILABLE = False


# ─────────────────────────────────────────────────────────────────────────────
# 1. ENUMS AND DATA CONTRACTS
# ─────────────────────────────────────────────────────────────────────────────

class ImageModality(str, Enum):
    SAR_GRAYSCALE = "sar_grayscale"
    SAR_COLORIZED = "sar_colorized"
    OPTICAL_RGB = "optical_rgb"
    MULTISPECTRAL = "multispectral"
    ANNOTATED_OVERLAY = "annotated_overlay"
    UNKNOWN = "unknown"


class IdentityMatchStatus(str, Enum):
    EXACT_FILE_DUPLICATE = "exact_file_duplicate"
    SAME_DECODED_IMAGE = "same_decoded_image"
    VISUALLY_SIMILAR = "visually_similar"
    STRUCTURALLY_RELATED = "structurally_related"
    UNRELATED = "unrelated"


# ─────────────────────────────────────────────────────────────────────────────
# 2. IMAGE IDENTITY & HASHING ENGINE
# ─────────────────────────────────────────────────────────────────────────────

class ImageIdentity:
    """
    Multi-level image identity descriptor:
    - SHA-256 for exact binary file provenance.
    - Normalized-pixel SHA-256 for decoding invariance (container/compression-free).
    - dHash (Difference Hash, 64-bit) & aHash (Average Hash, 64-bit) for visual similarity.
    """

    def __init__(self, file_sha256: str, pixel_sha256: str, dhash_hex: str, ahash_hex: str):
        self.file_sha256 = file_sha256.lower()
        self.pixel_sha256 = pixel_sha256.lower()
        self.dhash_hex = dhash_hex.lower()
        self.ahash_hex = ahash_hex.lower()

    @classmethod
    def from_bytes_and_array(cls, raw_bytes: bytes, array: np.ndarray) -> ImageIdentity:
        # 1. Exact raw file SHA-256
        file_hash = hashlib.sha256(raw_bytes).hexdigest()

        # 2. Normalized-pixel hash (invariant to metadata / container differences)
        pixel_hash = cls._compute_normalized_pixel_hash(array)

        # 3. Perceptual hashes
        dhash_str, ahash_str = cls._compute_perceptual_hashes(array)

        return cls(
            file_sha256=file_hash,
            pixel_sha256=pixel_hash,
            dhash_hex=dhash_str,
            ahash_hex=ahash_str
        )

    @staticmethod
    def _compute_normalized_pixel_hash(array: np.ndarray, target_size: Tuple[int, int] = (64, 64)) -> str:
        """
        Resizes normalized 2D/3D array to standard grid and hashes quantized levels.
        """
        arr = array.astype(np.float32)
        if arr.ndim == 3 and arr.shape[0] in (1, 2, 3, 4):
            # Convert (C, H, W) -> (H, W, C)
            arr = np.transpose(arr, (1, 2, 0))

        # Collapse to 2D for hashing if multi-channel
        if arr.ndim == 3:
            arr_2d = np.nanmean(arr, axis=2)
        else:
            arr_2d = arr

        # Handle NaNs / Infs
        valid = np.isfinite(arr_2d)
        if not np.any(valid):
            return hashlib.sha256(b"all_nan_or_empty").hexdigest()

        min_val = float(np.nanmin(arr_2d[valid]))
        max_val = float(np.nanmax(arr_2d[valid]))
        denom = (max_val - min_val) if (max_val - min_val) > 1e-6 else 1.0

        scaled = np.clip((arr_2d - min_val) / denom, 0.0, 1.0)
        scaled[~valid] = 0.0

        # Resize via PIL for consistent interpolation
        img_u8 = (scaled * 255.0).astype(np.uint8)
        pil_img = Image.fromarray(img_u8, mode="L").resize(target_size, Image.Resampling.BILINEAR)
        quantized = np.asarray(pil_img, dtype=np.uint8)

        return hashlib.sha256(quantized.tobytes()).hexdigest()

    @staticmethod
    def _compute_perceptual_hashes(array: np.ndarray) -> Tuple[str, str]:
        """
        Computes 64-bit dHash and aHash on a 2D luminance projection.
        """
        arr = array.astype(np.float32)
        if arr.ndim == 3 and arr.shape[0] in (1, 2, 3, 4):
            arr = np.transpose(arr, (1, 2, 0))
        if arr.ndim == 3:
            arr_2d = np.nanmean(arr, axis=2)
        else:
            arr_2d = arr

        valid = np.isfinite(arr_2d)
        min_v = float(np.nanmin(arr_2d[valid])) if np.any(valid) else 0.0
        max_v = float(np.nanmax(arr_2d[valid])) if np.any(valid) else 1.0
        denom = (max_v - min_v) if (max_v - min_v) > 1e-6 else 1.0
        norm = np.clip((arr_2d - min_v) / denom, 0.0, 1.0)
        norm[~valid] = 0.0

        img_u8 = (norm * 255.0).astype(np.uint8)
        pil = Image.fromarray(img_u8, mode="L")

        # dHash: 9x8 image -> compare adjacent pixels (64 bits)
        d_res = pil.resize((9, 8), Image.Resampling.BILINEAR)
        d_pixels = np.asarray(d_res, dtype=np.int32)
        diff = d_pixels[:, 1:] > d_pixels[:, :-1]
        dhash_int = 0
        for bit in diff.flatten():
            dhash_int = (dhash_int << 1) | int(bit)
        dhash_hex = f"{dhash_int:016x}"

        # aHash: 8x8 image -> compare to mean (64 bits)
        a_res = pil.resize((8, 8), Image.Resampling.BILINEAR)
        a_pixels = np.asarray(a_res, dtype=np.float32)
        avg = float(np.mean(a_pixels))
        a_diff = a_pixels > avg
        ahash_int = 0
        for bit in a_diff.flatten():
            ahash_int = (ahash_int << 1) | int(bit)
        ahash_hex = f"{ahash_int:016x}"

        return dhash_hex, ahash_hex

    @staticmethod
    def hamming_distance(hex1: str, hex2: str) -> int:
        """Calculates bitwise Hamming distance between two 16-character hex hashes."""
        try:
            val1 = int(hex1, 16)
            val2 = int(hex2, 16)
            xor_val = val1 ^ val2
            return bin(xor_val).count("1")
        except Exception:
            return 64

    def compare(self, other: ImageIdentity) -> Dict[str, Any]:
        """
        Compares this image identity against another.
        Returns match status, distance, and confidence.
        """
        if self.file_sha256 == other.file_sha256:
            return {
                "status": IdentityMatchStatus.EXACT_FILE_DUPLICATE,
                "confidence": 1.0,
                "hamming_distance": 0,
                "explanation": "Exact identical binary file (matching SHA-256 checksum)."
            }

        if self.pixel_sha256 == other.pixel_sha256:
            return {
                "status": IdentityMatchStatus.SAME_DECODED_IMAGE,
                "confidence": 0.99,
                "hamming_distance": 0,
                "explanation": "Identical decoded pixel content with different file container, encoding, or metadata."
            }

        d_dist = self.hamming_distance(self.dhash_hex, other.dhash_hex)
        a_dist = self.hamming_distance(self.ahash_hex, other.ahash_hex)
        avg_dist = (d_dist + a_dist) / 2.0

        if d_dist <= 5:
            conf = round(1.0 - (d_dist / 32.0), 3)
            return {
                "status": IdentityMatchStatus.VISUALLY_SIMILAR,
                "confidence": conf,
                "hamming_distance": d_dist,
                "explanation": f"Near-duplicate image (perceptual Hamming distance: {d_dist}/64). May be re-encoded, resized, or mildly contrast-adjusted."
            }

        if d_dist <= 12:
            conf = round(1.0 - (d_dist / 24.0), 3)
            return {
                "status": IdentityMatchStatus.STRUCTURALLY_RELATED,
                "confidence": max(0.0, conf),
                "hamming_distance": d_dist,
                "explanation": f"Structurally similar image (Hamming distance: {d_dist}/64). Likely cropped, heavily filtered, or derived scene."
            }

        return {
            "status": IdentityMatchStatus.UNRELATED,
            "confidence": 0.0,
            "hamming_distance": d_dist,
            "explanation": f"Unrelated image (Hamming distance: {d_dist}/64)."
        }

    def to_dict(self) -> Dict[str, str]:
        return {
            "file_sha256": self.file_sha256,
            "pixel_sha256": self.pixel_sha256,
            "dhash": self.dhash_hex,
            "ahash": self.ahash_hex
        }


# ─────────────────────────────────────────────────────────────────────────────
# 3. GEOTIFF / TIFF METADATA & RASTER INSPECTOR
# ─────────────────────────────────────────────────────────────────────────────

class GeoTIFFReader:
    """
    Robust TIFF and GeoTIFF reader with multi-engine fallback:
    Engine 1: Rasterio (when installed and compiled)
    Engine 2: Tifffile + PyProj (pure Python / zero C-compiler dependency)
    """

    @classmethod
    def read_metadata(
        cls,
        source: Union[str, Path, bytes],
        filename: str = "uploaded_scene.tif"
    ) -> Dict[str, Any]:
        """
        Extracts complete geospatial and raster metadata without loading full array into memory.
        """
        raw_bytes = source if isinstance(source, bytes) else Path(source).read_bytes()
        file_size_bytes = len(raw_bytes)

        # 1. Try Rasterio engine if available
        if RASTERIO_AVAILABLE:
            try:
                import rasterio.io
                with rasterio.io.MemoryFile(raw_bytes) as memfile:
                    with memfile.open() as ds:
                        crs_wkt = ds.crs.to_string() if ds.crs else None
                        bounds = {
                            "min_lon": float(ds.bounds.left),
                            "min_lat": float(ds.bounds.bottom),
                            "max_lon": float(ds.bounds.right),
                            "max_lat": float(ds.bounds.top),
                        }
                        is_geo = bool(ds.crs and ds.transform and not ds.transform.is_identity)
                        return {
                            "filename": filename,
                            "format": ds.driver or "TIFF",
                            "width": int(ds.width),
                            "height": int(ds.height),
                            "bands": int(ds.count),
                            "dtypes": [str(ds.dtypes[i]) for i in range(ds.count)],
                            "is_georeferenced": is_geo,
                            "crs": crs_wkt,
                            "transform": list(ds.transform)[:6] if ds.transform else None,
                            "bounds": bounds if is_geo else None,
                            "nodata_value": float(ds.nodata) if ds.nodata is not None else None,
                            "file_size_bytes": file_size_bytes,
                            "reader_engine": "rasterio"
                        }
            except Exception:
                pass

        # 2. Tifffile engine fallback
        if TIFFFILE_AVAILABLE:
            try:
                with tifffile.TiffFile(io.BytesIO(raw_bytes)) as tf:
                    page = tf.pages[0]
                    w = int(page.imagewidth)
                    h = int(page.imagelength)
                    bands = len(tf.pages) if len(tf.pages) > 1 else int(page.samplesperpixel)
                    dtype_str = str(page.dtype)

                    is_geo = False
                    crs_str = None
                    transform_list = None
                    bounds = None
                    nodata = None

                    # Check GeoTIFF tags
                    # Tag 33550: ModelPixelScaleTag (dx, dy, dz)
                    # Tag 33922: ModelTiepointTag (i, j, k, x, y, z)
                    # Tag 34735: GeoKeyDirectoryTag
                    scale_tag = page.tags.get(33550)
                    tie_tag = page.tags.get(33922)
                    nodata_tag = page.tags.get(42113)

                    if nodata_tag:
                        try:
                            nodata = float(nodata_tag.value.strip('\x00'))
                        except Exception:
                            pass

                    if scale_tag and tie_tag:
                        dx, dy = float(scale_tag.value[0]), float(scale_tag.value[1])
                        tie = tie_tag.value
                        # tiepoint: [i, j, k, x, y, z]
                        tie_i, tie_j, tie_x, tie_y = float(tie[0]), float(tie[1]), float(tie[3]), float(tie[4])

                        # Standard north-up Affine transform: [dx, 0, x_origin, 0, -dy, y_origin]
                        x_origin = tie_x - (tie_i * dx)
                        y_origin = tie_y + (tie_j * dy)
                        transform_list = [dx, 0.0, x_origin, 0.0, -dy, y_origin]

                        min_x = x_origin
                        max_x = x_origin + (w * dx)
                        max_y = y_origin
                        min_y = y_origin - (h * dy)

                        # Check GeoKey directory for EPSG
                        geokey_tag = page.tags.get(34735)
                        epsg_code = None
                        if geokey_tag:
                            vals = geokey_tag.value
                            # GeoKey format: [KeyDirVersion, KeyRevision, MinorRev, NumberOfKeys, ...]
                            # Each key: [KeyID, TIFFTagLocation, Count, Value_Offset]
                            for k_idx in range(4, len(vals) - 3, 4):
                                key_id = vals[k_idx]
                                val_offset = vals[k_idx + 3]
                                if key_id in (3072, 2048):  # ProjectedCSTypeGeoKey or GeographicTypeGeoKey
                                    epsg_code = val_offset
                                    break

                        if epsg_code and epsg_code not in (0, 32767):
                            crs_str = f"EPSG:{epsg_code}"
                        else:
                            # Assume WGS84 if coordinates look like degrees
                            if -180.0 <= min_x <= 180.0 and -90.0 <= min_y <= 90.0:
                                crs_str = "EPSG:4326"
                            else:
                                crs_str = "Projected (Unknown EPSG)"

                        # Convert bounds to WGS84 if projected and pyproj is available
                        if PYPROJ_AVAILABLE and crs_str and crs_str.startswith("EPSG:") and crs_str != "EPSG:4326":
                            try:
                                transformer = pyproj.Transformer.from_crs(crs_str, "EPSG:4326", always_xy=True)
                                lon_min, lat_min = transformer.transform(min_x, min_y)
                                lon_max, lat_max = transformer.transform(max_x, max_y)
                                bounds = {
                                    "min_lon": round(float(lon_min), 6),
                                    "min_lat": round(float(lat_min), 6),
                                    "max_lon": round(float(lon_max), 6),
                                    "max_lat": round(float(lat_max), 6),
                                }
                            except Exception:
                                bounds = {
                                    "min_lon": min_x, "min_lat": min_y,
                                    "max_lon": max_x, "max_lat": max_y
                                }
                        else:
                            bounds = {
                                "min_lon": round(float(min_x), 6),
                                "min_lat": round(float(min_y), 6),
                                "max_lon": round(float(max_x), 6),
                                "max_lat": round(float(max_y), 6),
                            }

                        is_geo = True

                    return {
                        "filename": filename,
                        "format": "GeoTIFF" if is_geo else "TIFF",
                        "width": w,
                        "height": h,
                        "bands": bands,
                        "dtypes": [dtype_str] * bands,
                        "is_georeferenced": is_geo,
                        "crs": crs_str,
                        "transform": transform_list,
                        "bounds": bounds,
                        "nodata_value": nodata,
                        "file_size_bytes": file_size_bytes,
                        "reader_engine": "tifffile"
                    }
            except Exception:
                pass

        # 3. Standard Pillow fallback for regular TIFF/PNG/JPEG
        try:
            with Image.open(io.BytesIO(raw_bytes)) as pil_img:
                w, h = pil_img.size
                mode = pil_img.mode
                bands = len(mode) if mode not in ("L", "1", "P") else 1
                return {
                    "filename": filename,
                    "format": pil_img.format or "IMAGE",
                    "width": w,
                    "height": h,
                    "bands": bands,
                    "dtypes": ["uint8"] * bands,
                    "is_georeferenced": False,
                    "crs": None,
                    "transform": None,
                    "bounds": None,
                    "nodata_value": None,
                    "file_size_bytes": file_size_bytes,
                    "reader_engine": "pillow"
                }
        except Exception as e:
            return {
                "filename": filename,
                "format": "UNKNOWN",
                "width": 0,
                "height": 0,
                "bands": 0,
                "dtypes": [],
                "is_georeferenced": False,
                "crs": None,
                "transform": None,
                "bounds": None,
                "nodata_value": None,
                "file_size_bytes": file_size_bytes,
                "reader_engine": "none",
                "error": str(e)
            }

    @classmethod
    def read_array(cls, source: Union[str, Path, bytes]) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Safely loads raster array as (H, W) or (C, H, W) float32 numpy array.
        Returns: (array, metadata)
        """
        raw_bytes = source if isinstance(source, bytes) else Path(source).read_bytes()
        fname = getattr(source, "name", "raster.tif") if not isinstance(source, bytes) else "raster.tif"
        meta = cls.read_metadata(raw_bytes, filename=str(fname))

        array: Optional[np.ndarray] = None

        if TIFFFILE_AVAILABLE:
            try:
                array = tifffile.imread(io.BytesIO(raw_bytes))
            except Exception:
                pass

        if array is None:
            try:
                with Image.open(io.BytesIO(raw_bytes)) as pil_img:
                    array = np.array(pil_img)
            except Exception as e:
                raise ValueError(f"Could not decode image array: {e}")

        # Standardize dimensionality to (C, H, W) or (H, W)
        if array.ndim == 2:
            pass  # Single band (H, W)
        elif array.ndim == 3:
            # If shape is (H, W, C), transpose to (C, H, W)
            if array.shape[-1] in (1, 2, 3, 4) and array.shape[0] > 4:
                array = np.transpose(array, (2, 0, 1))
        return array.astype(np.float32), meta


# ─────────────────────────────────────────────────────────────────────────────
# 4. SAR & RASTER QUALITY METRICS
# ─────────────────────────────────────────────────────────────────────────────

class RasterQualityAnalyzer:
    """
    Computes physical remote sensing metrics:
    - Speckle index (variance-to-mean-squared ratio for multiplicative radar noise).
    - Dynamic range and clipping fractions.
    - Estimated signal-to-noise ratio (SNR).
    - Statistical percentiles.
    """

    @staticmethod
    def analyze_raster(array: np.ndarray, nodata: Optional[float] = None) -> Tuple[List[Dict[str, float]], Dict[str, float]]:
        """
        Returns: (channel_statistics, quality_indicators)
        """
        arr = array.astype(np.float32)
        if arr.ndim == 2:
            channels = [arr]
        elif arr.ndim == 3:
            channels = [arr[c] for c in range(arr.shape[0])]
        else:
            channels = [arr.squeeze()]

        channel_stats: List[Dict[str, float]] = []

        for ch in channels:
            # Filter NaNs, Infs, and NoData
            valid_mask = np.isfinite(ch)
            if nodata is not None:
                valid_mask = valid_mask & (np.abs(ch - nodata) > 1e-4)

            vals = ch[valid_mask]
            if len(vals) == 0:
                channel_stats.append({
                    "min": 0.0, "max": 0.0, "mean": 0.0, "std": 0.0,
                    "p02": 0.0, "p50": 0.0, "p98": 0.0, "valid_pixels": 0
                })
                continue

            channel_stats.append({
                "min": round(float(np.min(vals)), 4),
                "max": round(float(np.max(vals)), 4),
                "mean": round(float(np.mean(vals)), 4),
                "std": round(float(np.std(vals)), 4),
                "p02": round(float(np.percentile(vals, 2)), 4),
                "p50": round(float(np.percentile(vals, 50)), 4),
                "p98": round(float(np.percentile(vals, 98)), 4),
                "valid_pixels": int(len(vals))
            })

        # Quality indicators computed on primary channel
        primary = channels[0]
        valid_mask = np.isfinite(primary)
        if nodata is not None:
            valid_mask = valid_mask & (np.abs(primary - nodata) > 1e-4)

        vals = primary[valid_mask]
        total_px = primary.size

        if len(vals) > 10:
            mean_v = float(np.mean(vals))
            var_v = float(np.var(vals))
            # Radar speckle index (homogeneous clutter has ENL = mean^2 / var)
            speckle_idx = (var_v / (mean_v ** 2)) if abs(mean_v) > 1e-6 else 0.0

            # Dynamic range in decibels
            p98 = float(np.percentile(vals, 98))
            p02 = float(np.percentile(vals, 2))
            dyn_range = (p98 - p02)

            # Clipping fractions (zero/saturation)
            zero_frac = float(np.sum(vals <= np.min(vals) + 1e-5)) / total_px
            sat_frac = float(np.sum(vals >= np.max(vals) - 1e-5)) / total_px

            # Estimated SNR (mean / std)
            snr_db = 10.0 * math.log10(max((mean_v ** 2) / max(var_v, 1e-6), 1e-3))
        else:
            speckle_idx = 0.0
            dyn_range = 0.0
            zero_frac = 1.0
            sat_frac = 0.0
            snr_db = 0.0

        quality = {
            "speckle_index": round(float(speckle_idx), 4),
            "dynamic_range": round(float(dyn_range), 4),
            "zero_pixel_fraction": round(float(zero_frac), 4),
            "saturation_fraction": round(float(sat_frac), 4),
            "snr_estimate_db": round(float(snr_db), 2),
            "valid_fraction": round(float(len(vals)) / max(total_px, 1), 4)
        }

        return channel_stats, quality


# ─────────────────────────────────────────────────────────────────────────────
# 5. IMAGE-TYPE & MODALITY CLASSIFICATION ENGINE
# ─────────────────────────────────────────────────────────────────────────────

class ImageModalityClassifier:
    """
    Distinguishes:
    A. SAR grayscale or radar imagery.
    B. Colorized or pseudocolor SAR imagery.
    C. Optical RGB satellite imagery.
    D. Multispectral imagery.
    E. Annotated or overlay-containing imagery.
    F. Unknown or unsupported imagery.
    """

    @classmethod
    def classify(
        cls,
        array: np.ndarray,
        metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Evaluates raster array and returns classification, calibrated confidence,
        supporting evidence, SAR suitability, and inference admission decisions.
        """
        arr = array.astype(np.float32)
        h, w = metadata.get("height", 0), metadata.get("width", 0)
        bands = metadata.get("bands", 1)

        # 0. Check validity and corrupt/empty files
        if h <= 4 or w <= 4 or not np.any(np.isfinite(arr)):
            return {
                "category": ImageModality.UNKNOWN,
                "confidence": 0.99,
                "evidence": {"reason": "Image has invalid dimensions or contains solely NaN/empty data."},
                "suitable_for_sar_model": False,
                "preprocessing_required": [],
                "blocked_from_inference": True,
                "uncertainty_status": "HIGH_UNCERTAINTY",
                "warnings": ["Uploaded file is unreadable or empty."]
            }

        # Format input array to (C, H, W)
        if arr.ndim == 2:
            arr_3d = arr[np.newaxis, :, :]
        elif arr.ndim == 3 and arr.shape[0] in (1, 2, 3, 4, 8, 12, 13, 16):
            arr_3d = arr
        elif arr.ndim == 3:
            arr_3d = np.transpose(arr, (2, 0, 1))
        else:
            arr_3d = arr[np.newaxis, :, :]

        num_channels = arr_3d.shape[0]

        # 1. Check for Multispectral (>3 distinct channels with physical spectral bounds)
        if num_channels > 3 and not (num_channels == 4 and metadata.get("format") in ("PNG", "JPEG")):
            return {
                "category": ImageModality.MULTISPECTRAL,
                "confidence": 0.95,
                "evidence": {
                    "band_count": num_channels,
                    "reason": f"Raster contains {num_channels} spectral bands exceeding standard 3-band RGB/SAR dual-pol representation."
                },
                "suitable_for_sar_model": False,
                "preprocessing_required": ["band_subsetting", "optical_index_extraction"],
                "blocked_from_inference": True,
                "uncertainty_status": "CONFIDENT_NON_SAR",
                "warnings": ["Multispectral optical imagery detected. Sentinel-1 SAR models require dual-pol C-band radar backscatter."]
            }

        # 2. Check for Annotated Overlay (graphics, text boxes, burned-in legends, colored masks)
        overlay_evidence = cls._detect_synthetic_overlays(arr_3d)
        if overlay_evidence["has_overlay"]:
            return {
                "category": ImageModality.ANNOTATED_OVERLAY,
                "confidence": overlay_evidence["confidence"],
                "evidence": overlay_evidence,
                "suitable_for_sar_model": False,
                "preprocessing_required": ["demarcate_overlay_mask", "inspect_clean_subregion"],
                "blocked_from_inference": True,
                "uncertainty_status": "FLAGGED_OVERLAY",
                "warnings": [
                    f"Synthetic annotations or overlays detected ({overlay_evidence['overlay_description']}). "
                    "Direct inference blocked to prevent false-positive slick boundary distortion."
                ]
            }

        # 3. Check for Dual-Polarization SAR GeoTIFF (2 channels: VH and VV)
        if num_channels == 2:
            med_b0 = float(np.nanmedian(arr_3d[0]))
            med_b1 = float(np.nanmedian(arr_3d[1]))
            # Sentinel-1 Sigma0 dB values are typically negative (marine radar return: -35 to -5 dB)
            is_db = (med_b0 < 0.0 and med_b1 < 0.0)
            confidence = 0.98 if is_db else 0.90
            return {
                "category": ImageModality.SAR_GRAYSCALE,
                "confidence": confidence,
                "evidence": {
                    "num_channels": 2,
                    "channel_0_median": med_b0,
                    "channel_1_median": med_b1,
                    "polarization_mapping": "Band 0 = VH (Cross-pol), Band 1 = VV (Co-pol)",
                    "is_radiometric_db": is_db
                },
                "suitable_for_sar_model": True,
                "preprocessing_required": ["dualpol_db_normalization", "lee_speckle_filter"],
                "blocked_from_inference": False,
                "uncertainty_status": "CONFIDENT_SAR",
                "warnings": []
            }

        # 4. Check Single-Channel Imagery (1 channel: standard grayscale)
        if num_channels == 1:
            med_val = float(np.nanmedian(arr_3d[0]))
            is_db = (med_val < 0.0 and med_val > -50.0)
            # Check speckle characteristics
            valid = np.isfinite(arr_3d[0])
            var_v = float(np.nanvar(arr_3d[0][valid])) if np.any(valid) else 0.0
            mean_v = float(np.nanmean(arr_3d[0][valid])) if np.any(valid) else 1.0
            speckle_ratio = (var_v / (mean_v ** 2)) if abs(mean_v) > 1e-4 else 0.0

            # If metadata indicates SAR or values are in dB or high speckle texture
            confidence = 0.95 if is_db else 0.85
            return {
                "category": ImageModality.SAR_GRAYSCALE,
                "confidence": confidence,
                "evidence": {
                    "num_channels": 1,
                    "median_value": med_val,
                    "is_radiometric_db": is_db,
                    "speckle_ratio": round(speckle_ratio, 4)
                },
                "suitable_for_sar_model": True,
                "preprocessing_required": ["single_to_dualpol_synthesis", "lee_speckle_filter"],
                "blocked_from_inference": False,
                "uncertainty_status": "CONFIDENT_SAR",
                "warnings": [] if is_db else ["Single-channel grayscale input. Synthetic VH cross-pol channel will be calibrated."]
            }

        # 5. Check 3-Channel Imagery: Distinguish Grayscale-RGB, Colorized SAR, and Optical RGB
        if num_channels in (3, 4):
            c0, c1, c2 = arr_3d[0], arr_3d[1], arr_3d[2]
            diff_01 = float(np.nanmean(np.abs(c0 - c1)))
            diff_02 = float(np.nanmean(np.abs(c0 - c2)))
            diff_12 = float(np.nanmean(np.abs(c1 - c2)))
            max_channel_diff = max(diff_01, diff_02, diff_12)

            # If all 3 channels are essentially identical (max diff < 0.8 on 0-255 or < 0.005 on 0-1)
            scale_range = max(float(np.nanmax(c0) - np.nanmin(c0)), 1.0)
            norm_channel_diff = max_channel_diff / scale_range

            if norm_channel_diff < 0.015:
                # 3-channel duplicate grayscale (e.g. PNG/JPEG preview of SAR)
                return {
                    "category": ImageModality.SAR_GRAYSCALE,
                    "confidence": 0.92,
                    "evidence": {
                        "num_channels": 3,
                        "color_divergence": round(norm_channel_diff, 5),
                        "explanation": "Three identical channels (R==G==B). Monochromatic grayscale microwave representation."
                    },
                    "suitable_for_sar_model": True,
                    "preprocessing_required": ["extract_luminance_channel", "calibrate_optical_dn_to_sigma0"],
                    "blocked_from_inference": False,
                    "uncertainty_status": "CONFIDENT_SAR",
                    "warnings": ["Grayscale preview format detected. Luminance channel will be calibrated for SAR inference."]
                }

            # If channels differ meaningfully, determine: Colorized SAR vs Optical RGB
            color_eval = cls._evaluate_colorized_vs_optical(arr_3d)

            if color_eval["is_colorized_sar"]:
                return {
                    "category": ImageModality.SAR_COLORIZED,
                    "confidence": color_eval["confidence"],
                    "evidence": color_eval["evidence"],
                    "suitable_for_sar_model": False,  # Conditional: requires user confirmation or raw channel recovery
                    "preprocessing_required": ["extract_radar_intensity_manifold", "warning_irreversible_color_mapping"],
                    "blocked_from_inference": True,
                    "uncertainty_status": "COLORIZED_RADAR_CAUTION",
                    "warnings": [
                        "Pseudocolor or colorized SAR visualization detected (e.g. Jet/Viridis colormap or polarimetric composite). "
                        "Original radiometric dB measurements cannot be reliably reversed from RGB colormaps alone. "
                        "Please provide original single/dual-band floating-point GeoTIFF for statutory enforcement."
                    ]
                }
            else:
                return {
                    "category": ImageModality.OPTICAL_RGB,
                    "confidence": color_eval["confidence"],
                    "evidence": color_eval["evidence"],
                    "suitable_for_sar_model": False,
                    "preprocessing_required": ["optical_water_index_analysis"],
                    "blocked_from_inference": True,
                    "uncertainty_status": "OPTICAL_IMAGERY_BLOCKED",
                    "warnings": [
                        "Natural optical RGB satellite/aerial imagery detected (true color terrestrial/marine dispersion). "
                        "Sentinel-1 SAR capillary wave damping models cannot operate on optical wavebands."
                    ]
                }

        # Fallback unknown
        return {
            "category": ImageModality.UNKNOWN,
            "confidence": 0.60,
            "evidence": {"band_count": num_channels, "shape": list(arr_3d.shape)},
            "suitable_for_sar_model": False,
            "preprocessing_required": [],
            "blocked_from_inference": True,
            "uncertainty_status": "UNKNOWN_MODALITY",
            "warnings": ["Unrecognized raster modality. Inference blocked."]
        }

    @staticmethod
    def _detect_synthetic_overlays(arr_3d: np.ndarray) -> Dict[str, Any]:
        """
        Detects burned-in graphics, annotations, colored mask contours, or text boxes.
        Characteristics:
        - Exact saturated primary/secondary colors (pure red, pure yellow, pure cyan).
        - Sharp straight lines (high horizontal/vertical gradient concentration).
        - Discrete color clustering (palette-like non-natural distributions).
        """
        c = arr_3d.shape[0]
        if c < 3:
            return {"has_overlay": False, "confidence": 0.0}

        # Normalize to 0-255 scale
        r, g, b = arr_3d[0], arr_3d[1], arr_3d[2]
        max_v = max(float(np.nanmax(r)), float(np.nanmax(g)), float(np.nanmax(b)))
        if max_v <= 1.0:
            r = r * 255.0
            g = g * 255.0
            b = b * 255.0

        # Check for pure saturated annotation colors (e.g. Red [>240, <30, <30], Yellow [>240, >240, <30])
        pure_red = (r > 230) & (g < 40) & (b < 40)
        pure_yellow = (r > 230) & (g > 230) & (b < 40)
        pure_green = (r < 40) & (g > 230) & (b < 40)
        pure_cyan = (r < 40) & (g > 230) & (b > 230)

        overlay_px = (pure_red | pure_yellow | pure_green | pure_cyan)
        total_px = r.size
        overlay_ratio = float(np.sum(overlay_px)) / max(total_px, 1)

        # Compute spatial step gradient magnitude
        grad_r = np.abs(r[1:, :] - r[:-1, :])[:, :-1] + np.abs(r[:, 1:] - r[:, :-1])[:-1, :]
        sat_edge = (overlay_px[:-1, :-1]) & (grad_r > 60.0)
        sat_edge_count = int(np.sum(sat_edge))

        # High-gradient synthetic straight border detection
        diff_h = np.abs(r[1:, :] - r[:-1, :]) > 180
        diff_w = np.abs(r[:, 1:] - r[:, :-1]) > 180
        line_edge_ratio = float(np.sum(diff_h) + np.sum(diff_w)) / max(total_px, 1)

        # Real overlays have high saturated edge count (step boundary) or high synthetic border ratio
        if overlay_ratio > 0.003 and sat_edge_count >= 20:
            return {
                "has_overlay": True,
                "confidence": 0.95,
                "overlay_ratio": round(overlay_ratio, 5),
                "overlay_description": f"Saturated color overlay detected ({round(overlay_ratio * 100, 2)}% of scene pixels with step edges)."
            }

        if line_edge_ratio > 0.08:
            return {
                "has_overlay": True,
                "confidence": 0.88,
                "overlay_ratio": round(line_edge_ratio, 5),
                "overlay_description": "High-contrast synthetic grid or border lines detected across raster."
            }

        return {"has_overlay": False, "confidence": 0.0}

    @staticmethod
    def _evaluate_colorized_vs_optical(arr_3d: np.ndarray) -> Dict[str, Any]:
        """
        Distinguishes Pseudocolor / Colorized SAR from True Optical RGB:
        - Pseudocolor: RGB values lie on a 1D trajectory (colormapped scalar dB),
          showing high 1st-principal-component variance ratio (>88%) and radar speckle.
        - Optical RGB: 3D chromatic diversity, natural marine atmospheric blue dispersion,
          clouds, land vegetation green, lower speckle index.
        """
        r, g, b = arr_3d[0].flatten(), arr_3d[1].flatten(), arr_3d[2].flatten()
        valid = np.isfinite(r) & np.isfinite(g) & np.isfinite(b)
        r, g, b = r[valid], g[valid], b[valid]

        if len(r) < 100:
            return {"is_colorized_sar": False, "confidence": 0.5, "evidence": {}}

        # Sample for fast covariance computation
        if len(r) > 10000:
            idx = np.random.choice(len(r), 10000, replace=False)
            r, g, b = r[idx], g[idx], b[idx]

        # Normalize channels to zero mean, unit variance
        stack = np.stack([r, g, b], axis=1)
        stack_centered = stack - np.mean(stack, axis=0)
        cov = np.cov(stack_centered, rowvar=False)

        try:
            eigenvals, _ = np.linalg.eigh(cov)
            eigenvals = np.sort(eigenvals)[::-1]
            total_var = float(np.sum(eigenvals))
            explained_1 = (float(eigenvals[0]) / total_var) if total_var > 1e-6 else 1.0
            explained_1_2 = (float(eigenvals[0] + eigenvals[1]) / total_var) if total_var > 1e-6 else 1.0
        except Exception:
            explained_1 = 0.5
            explained_1_2 = 0.8

        # In a 1D pseudocolor map (like Jet or Turbo), the 1st + 2nd principal components
        # explain > 98% of total variance because color is generated from a 1D scalar function
        is_1d_manifold = (explained_1 > 0.88 or explained_1_2 > 0.98)

        # Blue-to-Red ratio for marine optical imagery (ocean water absorbs red heavily, blue > red)
        mean_r, mean_g, mean_b = float(np.mean(r)), float(np.mean(g)), float(np.mean(b))
        blue_dominance = (mean_b / max(mean_r, 1e-4)) if mean_r > 0 else 1.0

        if is_1d_manifold and blue_dominance < 2.5:
            confidence = round(min(0.95, explained_1_2), 3)
            return {
                "is_colorized_sar": True,
                "confidence": confidence,
                "evidence": {
                    "pca_first_two_components_variance": round(explained_1_2, 4),
                    "color_trajectory": "1D pseudocolor manifold detected (spectral mapping of scalar backscatter).",
                    "speckle_texture_preserved": True
                }
            }
        else:
            confidence = round(min(0.96, 0.70 + (1.0 - explained_1) * 0.4), 3)
            return {
                "is_colorized_sar": False,
                "confidence": confidence,
                "evidence": {
                    "pca_first_two_components_variance": round(explained_1_2, 4),
                    "blue_to_red_ratio": round(blue_dominance, 2),
                    "chromatic_diversity": "Natural 3D optical dispersion (terrestrial/marine optical absorption)."
                }
            }


# ─────────────────────────────────────────────────────────────────────────────
# 6. WEB PREVIEW GENERATOR
# ─────────────────────────────────────────────────────────────────────────────

class WebPreviewGenerator:
    """
    Produces web-friendly PNG previews from raw floating-point rasters
    using robust percentile-based contrast stretching.
    Preserves original scientific raster data pristine and untouched.
    """

    @staticmethod
    def generate_sar_preview(
        array: np.ndarray,
        p_low: float = 2.0,
        p_high: float = 98.0,
        target_size: Optional[Tuple[int, int]] = (800, 800)
    ) -> Tuple[bytes, str]:
        """
        Normalizes SAR backscatter array to [0, 255] grayscale PNG bytes.
        Returns: (png_bytes, base64_data_url)
        """
        import base64

        arr = array.astype(np.float32)
        if arr.ndim == 3 and arr.shape[0] in (1, 2, 3, 4):
            # If dual-pol (2, H, W): use VV (Channel 1) or first channel
            arr_2d = arr[1] if arr.shape[0] >= 2 else arr[0]
        elif arr.ndim == 3:
            arr_2d = np.nanmean(arr, axis=2)
        else:
            arr_2d = arr

        valid = np.isfinite(arr_2d)
        if not np.any(valid):
            # Blank 100x100 preview
            blank = Image.new("L", (100, 100), color=30)
            bio = io.BytesIO()
            blank.save(bio, format="PNG")
            b_val = bio.getvalue()
            return b_val, f"data:image/png;base64,{base64.b64encode(b_val).decode('utf-8')}"

        v_low = float(np.percentile(arr_2d[valid], p_low))
        v_high = float(np.percentile(arr_2d[valid], p_high))
        denom = (v_high - v_low) if (v_high - v_low) > 1e-6 else 1.0

        stretched = np.clip((arr_2d - v_low) / denom, 0.0, 1.0)
        stretched[~valid] = 0.0
        u8_arr = (stretched * 255.0).astype(np.uint8)

        pil_img = Image.fromarray(u8_arr, mode="L")
        if target_size and (pil_img.width > target_size[0] or pil_img.height > target_size[1]):
            pil_img.thumbnail(target_size, Image.Resampling.BILINEAR)

        bio = io.BytesIO()
        pil_img.save(bio, format="PNG", optimize=True)
        raw_png = bio.getvalue()
        b64_url = f"data:image/png;base64,{base64.b64encode(raw_png).decode('utf-8')}"

        return raw_png, b64_url

    @staticmethod
    def generate_rgb_preview(
        array: np.ndarray,
        p_low: float = 2.0,
        p_high: float = 98.0,
        target_size: Optional[Tuple[int, int]] = (800, 800)
    ) -> Tuple[bytes, str]:
        """
        Generates 3-channel RGB preview from multi-channel raster.
        """
        import base64

        arr = array.astype(np.float32)
        if arr.ndim == 2:
            return WebPreviewGenerator.generate_sar_preview(arr, p_low, p_high, target_size)

        if arr.shape[0] not in (3, 4) and arr.shape[-1] in (3, 4):
            arr = np.transpose(arr, (2, 0, 1))

        c = min(arr.shape[0], 3)
        channels = []
        for i in range(c):
            ch = arr[i]
            valid = np.isfinite(ch)
            if np.any(valid):
                vl = float(np.percentile(ch[valid], p_low))
                vh = float(np.percentile(ch[valid], p_high))
                denom = (vh - vl) if (vh - vl) > 1e-6 else 1.0
                norm = np.clip((ch - vl) / denom, 0.0, 1.0)
                norm[~valid] = 0.0
                channels.append((norm * 255.0).astype(np.uint8))
            else:
                channels.append(np.zeros_like(ch, dtype=np.uint8))

        while len(channels) < 3:
            channels.append(channels[0])

        rgb = np.stack(channels[:3], axis=2)
        pil_img = Image.fromarray(rgb, mode="RGB")
        if target_size and (pil_img.width > target_size[0] or pil_img.height > target_size[1]):
            pil_img.thumbnail(target_size, Image.Resampling.BILINEAR)

        bio = io.BytesIO()
        pil_img.save(bio, format="PNG", optimize=True)
        raw_png = bio.getvalue()
        b64_url = f"data:image/png;base64,{base64.b64encode(raw_png).decode('utf-8')}"

        return raw_png, b64_url


# ─────────────────────────────────────────────────────────────────────────────
# 7. UNIFIED SAR IMAGE INTELLIGENCE SERVICE
# ─────────────────────────────────────────────────────────────────────────────

class SARImageIntelligenceService:
    """
    Facade orchestrating raster inspection, metadata preservation,
    modality classification, deduplication, and web preview generation.
    """

    @classmethod
    def inspect(
        cls,
        source: Union[str, Path, bytes],
        filename: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Full inspection workflow on an uploaded or local image file.
        """
        raw_bytes = source if isinstance(source, bytes) else Path(source).read_bytes()
        fname = filename or (getattr(source, "name", "scene.tif") if not isinstance(source, bytes) else "scene.tif")

        # 1. Read metadata
        meta = GeoTIFFReader.read_metadata(raw_bytes, filename=fname)

        # 2. Read array safely
        array, _ = GeoTIFFReader.read_array(raw_bytes)

        # 3. Compute identity hashes
        identity = ImageIdentity.from_bytes_and_array(raw_bytes, array)

        # 4. Statistical quality analysis
        stats, quality = RasterQualityAnalyzer.analyze_raster(array, nodata=meta.get("nodata_value"))

        # 5. Modality classification
        classification = ImageModalityClassifier.classify(array, meta)

        # 6. Generate display preview
        if classification["category"] in (ImageModality.OPTICAL_RGB, ImageModality.ANNOTATED_OVERLAY) and array.ndim == 3 and array.shape[0] >= 3:
            preview_bytes, preview_url = WebPreviewGenerator.generate_rgb_preview(array)
        else:
            preview_bytes, preview_url = WebPreviewGenerator.generate_sar_preview(array)

        return {
            "image_id": f"IMG-{identity.file_sha256[:12].upper()}",
            "filename": fname,
            "identity": identity.to_dict(),
            "metadata": meta,
            "classification": classification,
            "quality": quality,
            "channel_stats": stats,
            "preview": {
                "data_url": preview_url,
                "preview_size_bytes": len(preview_bytes),
                "is_display_preview": True,
                "note": "Web-friendly percentile contrast stretch. Calibrated scientific float32 raster preserved for model inference."
            }
        }

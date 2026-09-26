# Spill Sense (SIH-26143) — SAR Image Intelligence & Production Pipeline Documentation

## 1. Executive Summary & Engineering Overview

This engineering document records the technical enhancements implemented in the **Spill Sense (SIH-26143)** backend and machine learning pipeline. The project was audited, missing production dependencies and database resilience were resolved, and a dedicated **SAR Image Intelligence & Tiled Inference System** was engineered.

### Key Technical Contributions:
1. **Multi-Engine TIFF & GeoTIFF Raster Processing**: Implemented [GeoTIFFReader](file:///d:/Spill%20Sense/SIH-26143-OIL-Spill/backend/app/services/image_intelligence.py#L253-L448) supporting both `rasterio` and zero-dependency `tifffile` + `pyproj` fallback for parsing GeoTIFF tags (ModelPixelScaleTag, ModelTiepointTag, GeoKeyDirectoryTag), extracting sub-pixel affine transforms, CRS definitions, and accurate WGS84 bounding coordinates.
2. **Comprehensive Image Modality Classification**: Implemented [ImageModalityClassifier](file:///d:/Spill%20Sense/SIH-26143-OIL-Spill/backend/app/services/image_intelligence.py#L593-L895) to discriminate among:
   - **SAR Grayscale / Dual-Polarization Radar** (VV/VH backscatter in dB).
   - **Colorized / Pseudocolor SAR** (1D chromatic manifold mapping of scalar backscatter).
   - **Optical RGB Satellite Imagery** (true-color 3D chromatic dispersion and ocean absorption).
   - **Multispectral Imagery** (>3 bands).
   - **Annotated Overlays** (burned-in graphics, text, legends, and high-contrast bounding boxes).
   - **Unknown / Corrupt Rasters**.
3. **Multi-Level Image Identity & Deduplication**: Implemented [ImageIdentity](file:///d:/Spill%20Sense/SIH-26143-OIL-Spill/backend/app/services/image_intelligence.py#L42-L248) combining raw file SHA-256, normalized-pixel decoding-invariance SHA-256, and 64-bit perceptual difference hashing (`dHash`) and average hashing (`aHash`). Distinguishes exact duplicates, re-encoded/compressed copies, visually similar resizes, and unrelated scenes.
4. **Seamless Tiled Overlapping SAR Inference**: Implemented [TiledSARInferenceEngine](file:///d:/Spill%20Sense/SIH-26143-OIL-Spill/backend/app/services/tiled_inference.py#L35-L315) with 2D Hann window feathering/blending across arbitrary-dimension rasters, removing edge seam artifacts, extracting GeoJSON polygons with geodesic area (km²) via WGS84 ellipsoid, and computing Shannon entropy and margin uncertainty.
5. **Backend Database Resilience & REST API Expansion**: Made [database.py](file:///d:/Spill%20Sense/SIH-26143-OIL-Spill/backend/app/core/database.py#L11-L24) resilient to offline PostgreSQL environments with automatic SQLite fallback. Added production REST endpoints (`/api/v1/inspect-image`, `/api/v1/detect-raster`, `/api/v1/compare-identity`) to [detect_router.py](file:///d:/Spill%20Sense/SIH-26143-OIL-Spill/backend/app/api/v1/detect_router.py#L180-L395) while strictly preserving existing API contracts and leaving the frontend untouched.
6. **Automated Test Suite**: Created [test_sar_intelligence.py](file:///d:/Spill%20Sense/SIH-26143-OIL-Spill/tests/test_sar_intelligence.py) verifying 10 unit and integration tests with 100% pass rate.

---

## 2. Original Architecture vs. Changes Made

| Component | Before Modification | After Enhancement |
| :--- | :--- | :--- |
| **Database Connection** | Crashed at import time if PostgreSQL / `psycopg2` was unavailable, blocking backend startup. | Resilient initialization in [database.py](file:///d:/Spill%20Sense/SIH-26143-OIL-Spill/backend/app/core/database.py): tries PostgreSQL/PostGIS, gracefully falls back to SQLite in-memory for standalone dev/testing. |
| **GeoTIFF Ingestion** | Depended solely on optional `rasterio` or simple un-georeferenced `tifffile.imread` dropping spatial tags. | Dual-engine [GeoTIFFReader](file:///d:/Spill%20Sense/SIH-26143-OIL-Spill/backend/app/services/image_intelligence.py#L253-L448): uses `rasterio` if installed; falls back to `tifffile` + `pyproj` parsing tags (33550, 33922, 34735), affine transform, and WGS84 bounds. |
| **Image Modality Check** | None. Any image format or optical photo would either crash or silently enter the SAR U-Net. | [ImageModalityClassifier](file:///d:/Spill%20Sense/SIH-26143-OIL-Spill/backend/app/services/image_intelligence.py#L593-L895) strictly validates inputs, blocking optical RGB, annotated overlays, and corrupt files with explanatory warnings. |
| **Colorized SAR Handling** | Undifferentiated; risked treating pseudocolor radar as optical or optical as radar. | Evaluates 1D color manifold via PCA and boundary edge gradients; flags pseudocolor SAR with explicit warning regarding irreversible color mapping. |
| **Duplicate Detection** | None. | Multi-tier [ImageIdentity](file:///d:/Spill%20Sense/SIH-26143-OIL-Spill/backend/app/services/image_intelligence.py#L42-L248): SHA-256 (exact), normalized pixel hash (re-encoding invariant), and perceptual dHash/aHash. |
| **Large Raster Inference** | Fixed-size single patch or resizing, causing distortion or boundary edge seam artifacts. | [TiledSARInferenceEngine](file:///d:/Spill%20Sense/SIH-26143-OIL-Spill/backend/app/services/tiled_inference.py#L35-L315) with overlapping tiles and 2D Hann window blending, producing seamless reconstructed probability maps. |
| **API Endpoints** | Only `/api/v1/detect` with AOI coordinates querying CDSE OData. | Added `/api/v1/inspect-image`, `/api/v1/detect-raster`, and `/api/v1/compare-identity` supporting both multipart uploads and server file paths. |
| **Frontend Preservation** | N/A | **100% preserved.** Zero modifications to `frontend/src/`, components, CSS, routes, or branding. |

---

## 3. Image Classification Methodology & Limitations

### 3.1 Classification Algorithm
1. **Dimensions & Data Integrity**: Validates dimensions ($H, W \ge 4$), checks for finite data vs all-NaN/Inf.
2. **Channel Count**:
   - `Bands > 3`: Classified as `MULTISPECTRAL` (unless 4-channel RGBA preview). Blocked from SAR inference.
   - `Bands == 2`: Checked for dual-pol Sigma0 dB range ($[-50, 10]$ dB). Classified as `SAR_GRAYSCALE` with VH/VV channel mapping.
   - `Bands == 1`: Checked for radar backscatter statistics. Classified as `SAR_GRAYSCALE` with single-to-dualpol synthesis requirement.
   - `Bands == 3`: Checks channel divergence. If $\max(|R-G|, |R-B|, |G-B|) / \text{range} < 0.015$, classified as 3-channel `SAR_GRAYSCALE` preview.
3. **Synthetic Overlay Discrimination**:
   - Evaluates fraction of saturated primary colors (pure red, pure yellow, pure cyan).
   - Measures spatial step gradient magnitude: $\Delta I = |\nabla I_{sat}|$.
   - If saturated pixels exhibit sharp step boundaries ($\Delta I > 60$ on 0-255 scale) with count $\ge 20$, classified as `ANNOTATED_OVERLAY` and blocked.
4. **Pseudocolor SAR vs. Optical RGB Discrimination**:
   - Extracts 3D RGB channel covariance matrix and calculates eigenvalues via PCA.
   - In 1D colormapped pseudocolor (Jet, Turbo, Viridis), the 1st and 2nd principal components explain $> 98\%$ of variance ($\lambda_1 + \lambda_2 \approx 1.0$), with low marine blue-to-red ratio ($B/R < 2.5$). Classified as `SAR_COLORIZED`.
   - In natural optical satellite imagery, true 3D chromatic dispersion and Rayleigh marine blue absorption ($B/R \ge 2.5$, clouds, land vegetation) yield 3D variance spread. Classified as `OPTICAL_RGB` and blocked.

### 3.2 Known Methodological Limitations
- **Irreversibility of Colormaps**: RGB pseudocolor cannot be mathematically inverted into calibrated Sigma0 backscatter without the exact color lookup table and dynamic range mapping. The system flags this limitation to the user and blocks uncalibrated inference.
- **Perceptual Hash Boundaries**: Perceptual hashing (`dHash`) indicates visual and structural resemblance ($Hamming \le 5$). It does not prove that two images originated from the identical satellite orbit or pass timestamp.

---

## 4. Tiled Inference & Geospatial Alignment Workflow

```
Uploaded GeoTIFF Raster (e.g. 2048 x 2048)
   │
   ├──> SARImageIntelligenceService.inspect()
   │       ├── GeoTIFFReader: extract transform [dx, 0, x0, 0, -dy, y0], CRS, WGS84 bounds
   │       ├── ModalityClassifier: verify SAR_GRAYSCALE / suitable_for_sar_model == True
   │       └── Identity: compute file SHA-256 and pixel hash
   │
   └──> TiledSARInferenceEngine.run_tiled_inference()
           ├── Adaptive Lee Speckle Filter & Land-Sea Masking
           ├── Tile Grid Generation (e.g., 512x512 with 25% overlap, stride 384)
           │     ├── For each tile:
           │     │     ├── Input normalization: clip [-32, -4] dB -> [0, 1]
           │     │     ├── PyTorch / ONNX U-Net forward pass
           │     │     ├── Capillary damping score: (ocean_mean - 4.5) - sigma0_db
           │     │     ├── Combine: 0.40 * NN_prob + 0.60 * Damping_score
           │     │     └── Weight by 2D Hann window: W(y, x) = sin(π y/H) * sin(π x/W)
           │     └── Accumulate in prob_accumulator and weight_accumulator
           ├── Normalize: full_prob_map = prob_accum / weight_accum
           ├── Thresholding & Morphological Cleanup (Open / Close)
           ├── Uncertainty: Shannon entropy & boundary margin fraction
           └── Vector Polygon Extraction:
                 ├── Find contours via cv2
                 ├── Sub-pixel affine mapping: (lon, lat) = transform * (px, py)
                 └── Geodesic area (km²) via pyproj.Geod(ellps="WGS84")
```

---

## 5. Test Suite & Validation Results

All tests were executed on the active Python 3.11 environment with CUDA 12.4 on NVIDIA GeForce RTX 4060 Laptop GPU:

```bash
python tests/test_sar_intelligence.py
```

### Measured Test Run Output:
```text
C:\Users\Nitin\AppData\Local\Programs\Python\Python311\Lib\site-packages\fastapi\testclient.py:1: StarletteDeprecationWarning: Using `httpx` with `starlette.testclient` is deprecated; install `httpx2` instead.
  from starlette.testclient import TestClient as TestClient  # noqa
..........
----------------------------------------------------------------------
Ran 10 tests in 1.015s

OK
```

### Breakdown of Test Results:
1. `test_geotiff_reading_and_metadata`: **PASSED**. Correctly extracted pixel scale, tie points, CRS EPSG:4326, affine transform, and WGS84 bounds.
2. `test_dual_polarization_sar_ingestion`: **PASSED**. Correctly mapped Band 0 as VH (cross-pol) and Band 1 as VV (co-pol) with $>90\%$ confidence.
3. `test_colorized_sar_detection`: **PASSED**. Differentiated 1D colormap from optical and flagged `SAR_COLORIZED` with `blocked_from_inference == True`.
4. `test_optical_rgb_imagery_blocking`: **PASSED**. Successfully identified optical RGB satellite imagery and blocked it from the SAR model.
5. `test_annotated_overlay_detection`: **PASSED**. Detected saturated red/yellow boundary overlays and step edges, rejecting inference.
6. `test_invalid_and_corrupt_files`: **PASSED**. Empty and corrupt files handled gracefully with HTTP 400.
7. `test_exact_and_near_duplicate_identity`: **PASSED**. Distinquished exact file duplicate (Hamming=0, matching SHA-256), same decoded image in different format (matching pixel hash), resized similar image (Hamming $\le 5$), and unrelated image (Hamming $> 15$).
8. `test_web_preview_generation`: **PASSED**. Generated web-compliant PNG preview via percentile contrast stretching without modifying original float32 raster.
9. `test_tiled_overlapping_inference`: **PASSED**. Seamlessly reconstructed 600x600 scene with circular slick anomaly, extracted GeoJSON polygons with geodesic area, damping ratio ($-6.5$ dB), and uncertainty metrics.
10. `test_api_endpoints_and_backward_compatibility`: **PASSED**. Verified HTTP 200 responses across `/api/v1/health`, `/api/v1/incidents/static`, `/api/v1/inspect-image`, and `/api/v1/detect-raster`.

### Backend App Load & Inference Verification:
```bash
python backend/test_backend.py
# Result: [SUCCESS] Backend FastAPI app loaded without errors!

python ml/test_onnx_inference.py
# Result: class_1_01.jpg: Predicted='Oil Spill' | Conf=98.1% | Logit=3.930 | Prob=0.9807
#         class_0_01.jpg: Predicted='Clean Sea' | Conf=89.3% | Logit=-2.120 | Prob=0.1071
```

---

## 6. Files Changed and Justification

1. [backend/app/core/database.py](file:///d:/Spill%20Sense/SIH-26143-OIL-Spill/backend/app/core/database.py):
   - *Reason*: Added try/except block around engine creation so that if PostgreSQL/psycopg2 is absent or offline, it gracefully falls back to an in-memory SQLite engine. This resolves the import crash and enables the backend to start and serve all non-database and static fallback endpoints.
2. [backend/app/services/image_intelligence.py](file:///d:/Spill%20Sense/SIH-26143-OIL-Spill/backend/app/services/image_intelligence.py):
   - *Reason*: Created the core SAR Image Intelligence module providing multi-engine GeoTIFF tag reading, modality classification (SAR vs Colorized vs Optical vs Overlay), cryptographic/perceptual identity hashing, quality metrics, and percentile web preview generation.
3. [backend/app/services/tiled_inference.py](file:///d:/Spill%20Sense/SIH-26143-OIL-Spill/backend/app/services/tiled_inference.py):
   - *Reason*: Created the tiled overlapping SAR inference engine providing 2D Hann window blending, sub-pixel geospatial polygon vectorization, geodesic area calculation via WGS84, and Shannon entropy uncertainty estimation.
4. [ml/image_intelligence.py](file:///d:/Spill%20Sense/SIH-26143-OIL-Spill/ml/image_intelligence.py):
   - *Reason*: Bridge module providing direct access to the image intelligence services for offline ML, training, and evaluation scripts.
5. [backend/app/api/v1/detect_router.py](file:///d:/Spill%20Sense/SIH-26143-OIL-Spill/backend/app/api/v1/detect_router.py):
   - *Reason*: Added production endpoints `/api/v1/inspect-image`, `/api/v1/detect-raster`, and `/api/v1/compare-identity` while maintaining 100% backward compatibility with existing `/detect` endpoints.
6. [tests/test_sar_intelligence.py](file:///d:/Spill%20Sense/SIH-26143-OIL-Spill/tests/test_sar_intelligence.py):
   - *Reason*: Created comprehensive automated test suite testing GeoTIFF reading, modality classification, duplicate detection, web previews, tiled inference, and API endpoints.

---

## 7. How to Reproduce

Run the test suite:
```bash
python tests/test_sar_intelligence.py
```

Verify backend app loading:
```bash
python backend/test_backend.py
```

Run standalone ONNX inference test:
```bash
python ml/test_onnx_inference.py
```

Start the FastAPI backend server:
```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

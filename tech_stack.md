# Spill Sense — Technology Stack & Architecture

**Project:** Spill Sense · **Team:** BUG STALKERS · **SIH26143** · Disaster Management · Software
**Companion documents:** `prd.md`, `AppFlow.md`, `design.md`, `schema.md`, `implementationPlan.md`, `Tracker.md`, `rules.md`

> This document converts the presentation's candidate technology universe into a realistic, implementation-ready architecture. Every technology below is classified P0–P3. **Nothing is implemented merely because it sounds impressive** (PRD §4, `rules.md`).

## Priority Legend

| Tag | Meaning |
|---|---|
| **P0** | MVP Critical — required for a successful end-to-end demo |
| **P1** | Important — strengthens the project's technical demonstration |
| **P2** | Optional Enhancement — nice to have if time remains |
| **P3** | Production/Future — explicitly out of SIH scope |

---

## 0. Architectural Philosophy

**Modular monolith** for the SIH MVP — one FastAPI service with clearly separated domain modules, one PostgreSQL/PostGIS database, one job queue. This is chosen over microservices because:

- A small student team cannot operate distributed infrastructure reliably inside a hackathon timeline.
- Domain boundaries (Satellite, SAR Processing, Oil Detection, Environmental, Drift, AIS, Attribution, Dark Vessel, Evidence, Notifications) are still enforced as **internal Python packages/modules**, so the codebase can be split into services later without a rewrite.

```
Frontend (Next.js)
   ↓ REST/JSON (+ WebSocket for job progress)
FastAPI API Layer
   ↓
Application / Service Layer
   ↓
Domain Modules
   ├── satellite/           (scene ingestion, metadata)
   ├── sar_processing/       (calibration, speckle handling, normalization)
   ├── oil_detection/        (segmentation inference, vectorization)
   ├── environmental/        (wind/current retrieval, look-alike scoring)
   ├── drift/                (OpenDrift orchestration, Monte Carlo)
   ├── ais/                  (ingestion, validation, trajectories, gaps)
   ├── attribution/          (multi-factor scoring, ranking)
   ├── dark_vessel/          (AIS-gap + SAR-vessel correlation)
   ├── evidence/              (PDF generation, hashing, provenance)
   └── notifications/         (job status, in-app alerts)
   ↓
Data Layer
   ├── PostgreSQL + PostGIS   (operational spatial store)
   ├── MinIO / S3-compatible  (raster/PDF object storage)
   ├── Redis                 (cache + Celery broker)
   └── DuckDB Spatial         (P1/P2 — batch analytical queries)
```

**Decision:** Modular monolith over microservices.
**Reason:** Minimizes deployment/orchestration overhead during SIH while keeping domain boundaries clean for later extraction.
**Alternative considered:** Independently deployed microservices per domain module.
**Rejected because:** Kubernetes-grade orchestration is unnecessary operational risk for a hackathon demo (see PRD §16 Risks, `rules.md`).

---

## 1. Frontend

| Technology | Role | Priority | Alternatives | Notes |
|---|---|---|---|---|
| **Next.js (React) + TypeScript** | Application framework, routing, SSR for dashboard shell | P0 | Plain React + Vite | Next.js chosen for file-based routing across the 6 core screens and easy Vercel-style deployment |
| **Tailwind CSS** | Styling system | P0 | CSS Modules | Speed of iteration under hackathon time pressure; supports the dark operational theme in `design.md` |
| **Mapbox GL JS** | Primary tactical map — vector tiles, custom layers | P0 | MapLibre GL JS (open-source fork) | **Risk:** Mapbox requires an API token and has usage-based pricing beyond a free tier. **Mitigation:** MapLibre GL JS is API-compatible and fully open-source — documented as the fallback if token/quota becomes a blocker during the hackathon. Final selection to be confirmed in Phase 1 of `implementationPlan.md`. |
| **D3.js / Chart.js** | Attribution score breakdowns, confidence charts, analytics | P1 | Recharts | Chart.js sufficient for MVP charts (bar/line); D3 reserved for any custom probability-contour visualization if time allows |
| **Socket.io (or native WebSocket)** | Live job-progress updates (processing status) | P1 | Simple polling | Polling is an acceptable P0 fallback if Socket.io integration risks demo stability; documented in `AppFlow.md` §Notifications |
| **CesiumJS** | 3D globe visualization | **P3** | — | Not required for a 2D tactical-map investigative workflow; classified production/future only |
| **Deck.gl** | High-performance large-trajectory rendering | **P2** | Mapbox GL native layers | Promote to P1 only if AIS trajectory volume in the demo dataset causes visible frame-rate issues |

---

## 2. Backend

| Technology | Role | Priority | Alternatives | Notes |
|---|---|---|---|---|
| **FastAPI (Python)** | REST API framework | P0 | Flask, Django REST | Async-native, automatic OpenAPI docs, strong Pydantic integration — ideal for a geospatial/ML-heavy service |
| **Pydantic** | Request/response validation, settings management | P0 | Marshmallow | Bundled with FastAPI; enforces the strict typed contracts `rules.md` requires |
| **SQLAlchemy (async) + Alembic** | ORM + migrations | P0 | Raw SQL / Tortoise ORM | Alembic migrations are mandatory per `rules.md` §Database — no unmanaged schema drift |
| **Celery + Redis** | Asynchronous job queue (SAR preprocessing, ML inference, drift simulation, PDF generation) | P0 | RQ (Redis Queue), FastAPI `BackgroundTasks` | `BackgroundTasks` alone is insufficient for multi-minute drift simulations; Celery gives retry/monitoring. RQ is the lighter-weight fallback if Celery setup risk becomes a blocker under time pressure. |
| **Redis** | Cache + Celery broker + job-status store | P0 | — | Single Redis instance sufficient for MVP scale |

---

## 3. Database

| Technology | Role | Priority | Alternatives | Notes |
|---|---|---|---|---|
| **PostgreSQL + PostGIS** | Primary operational spatial database | P0 | MongoDB + geo-indexes | PostGIS provides mature spatial indexing (GiST), geodesic distance/area functions, and transactional integrity that a document database cannot match for this domain |
| **DuckDB Spatial** | Analytical/batch engine for large AIS scans and offline analytics | P1 | Direct PostGIS queries at scale | Role: large-scale, read-heavy AIS correlation queries and analytics rollups that would be expensive to run repeatedly against the transactional PostgreSQL instance |
| **MinIO (self-hosted) / Amazon S3** | Object storage for SAR rasters, generated PDFs, model artifacts | P0 (MinIO for local/offline demo) / P3 (S3 for production) | Local filesystem | MinIO chosen for MVP because it is S3-API-compatible but runs fully offline — critical for Demo Mode reliability (PRD §17) |

**Decision:** PostgreSQL/PostGIS as primary operational spatial database.
**Reason:** Strong spatial operations, indexing, transactional integrity, mature ecosystem, native GeoJSON interoperability.
**Alternative:** DuckDB Spatial.
**Role:** Large analytical/batch processing only — never the transactional source of truth.

---

## 4. Geospatial / SAR Processing

| Technology | Role | Priority | Alternatives | Notes |
|---|---|---|---|---|
| **Rasterio** | Raster I/O, reprojection, windowed reads of SAR GeoTIFF products | P0 | GDAL CLI scripting directly | Pythonic interface over GDAL; standard for this workload |
| **GDAL** | Underlying geospatial data abstraction (via Rasterio/Shapely bindings) | P0 | — | Foundational dependency, not called directly in most application code |
| **OpenCV** | Speckle filtering, morphological post-processing of segmentation masks | P0 | scikit-image | OpenCV chosen for speed and wide SAR-preprocessing community usage |
| **Shapely + GeoAlchemy2** | Vector geometry construction (slick polygons), ORM-to-PostGIS geometry bridge | P0 | — | Required for FR-D3/FR-G1 (PRD) |
| **ESA SNAP / snappy** | Full radiometric calibration, terrain correction of raw Sentinel-1 SLC/GRD products | **P2** | Use Copernicus-provided pre-calibrated GRD products directly | **Verified constraint:** SNAP's Python bridge (`snappy`) has a well-documented history of brittle installation and version coupling. For MVP, we consume **Copernicus-provided GRD (Ground Range Detected) products**, which are already radiometrically calibrated and largely reduce the need for full SNAP-based preprocessing. Full SNAP integration is classified P2/P3 for cases requiring custom calibration. |
| **Aresys SCT (SAR Calibration Toolbox)** | SAR product radiometric quality analysis (NESZ, elevation/scalloping profiles) | **P3** | — | **Verified (2026):** Open-source, MIT-licensed, actively maintained by Aresys S.r.l. It is a *quality/calibration* toolbox, not an oil-detection or ship-detection model — it does not directly serve the DETECT or dark-vessel pipeline. Retained only as a future production-hardening reference for SAR product QA, not MVP-relevant. |
| **Google Earth Engine** | Large-scale cloud satellite processing/access | **P2** | Direct Copernicus/Bhoonidhi download | Useful for rapid historical-scene discovery during model development; not required for the runtime MVP pipeline |

---

## 5. AI / ML

| Technology | Role | Priority | Alternatives | Notes |
|---|---|---|---|---|
| **PyTorch** | Deep learning framework | P0 | TensorFlow | Presentation-specified; strong ecosystem for U-Net/ResNet segmentation |
| **U-Net with ResNet-50 encoder** | Primary oil-slick segmentation architecture | P0 | Plain U-Net, DeepLabv3+, OilSpillNet, SAM 2 | **Decision:** U-Net + ResNet-50 encoder selected as baseline, per presentation. **Reason:** Well-established for SAR binary/multi-class segmentation, transferable pretrained encoder weights aid a data-scarce hackathon timeline. **Alternative:** DeepLabv3+ — comparable accuracy, higher implementation complexity; classified P2, revisit only if U-Net underperforms on the curated demo scene. **Alternative:** SAM 2 — classified **P2/P3**: general-purpose segmentation foundation model, not trained for SAR-specific dark-patch characteristics; would need prompt engineering or fine-tuning to be reliable for oil, and adds inference cost without a demonstrated MVP benefit. Not used merely because it is a recognizable name (PRD §12 "AI OIL-SPILL DETECTION"). |
| **ONNX Runtime** | Optimized/portable inference for the trained segmentation model | P1 | Native PyTorch inference | Speeds up and simplifies deployment for the demo environment; PyTorch-only inference is an acceptable P0 fallback |
| **Scikit-learn** | Classical ML utilities for attribution-score normalization / evaluation metrics | P1 | Hand-rolled normalization | Used for score scaling (e.g., min-max/standardization) in the attribution engine, not for the core segmentation task |
| **OilSpillNet (GitHub: AnavKatwal/OilSpillNet)** | Reference oil-spill segmentation implementation | **P2 (reference only)** | — | Evaluated as a conceptual/code reference for SAR oil-spill segmentation approaches. **Verification note:** treat as an individual community repository — confirm current license, maintenance status, and dataset compatibility before any reuse; do not integrate without review per `rules.md` §Dependencies. Concepts may inform the U-Net training pipeline; direct code reuse is not assumed. |
| **Multi-Factor Attribution Engine (GitHub: Adrik-Aburto/Multi-Factor-Attribution-Engine)** | Reference implementation for multi-factor scoring patterns | **P2 (reference only)** | — | Same verification caveat as above — evaluate license/maintenance before reuse; the attribution scoring formula in `AppFlow.md` is designed independently and documented explicitly rather than assumed to match this repository. |

---

## 6. Physics / Drift Modeling

| Technology | Role | Priority | Alternatives | Notes |
|---|---|---|---|---|
| **OpenDrift (`opendrift.models.openoil`)** | Backward Lagrangian particle drift + Monte Carlo dispersion | P0 | NOAA PyGNOME | **Verified (2026):** Open-source (GPLv2), Python-based, actively maintained by the Norwegian Meteorological Institute, with a purpose-built **OpenOil** module for oil trajectory/weathering simulation and a native backtracking mechanism (sign reversal of displacement + negative timestep). This directly matches the PRD's Trace Back requirements (FR-T1–FR-T6) without custom physics code. |
| **NOAA PyGNOME** | Alternative oil-spill physical model | **P2 (fallback candidate)** | — | Considered but not primary: OpenOil's built-in backward-tracking support and simpler Python packaging make it the stronger MVP fit; PyGNOME remains a documented fallback if OpenDrift/OpenOil integration proves unstable during Phase 6 |

---

## 7. Environmental / Oceanographic Data

| Source | Role | Priority | Verified access notes |
|---|---|---|---|
| **Copernicus Marine Service (CMEMS)** | Ocean current forcing for drift model | P0 | Requires free registration; historical reanalysis + near-real-time analysis products available; suitable for cached Demo Mode forcing files |
| **INCOIS** | Indian regional oceanographic data (currents, sea-state) | P1 | Prioritized for Indian coastal-water relevance per PRD framing; **must be verified for current API/portal availability during Phase 0** — if unreliable, CMEMS serves as the documented fallback (per PRD §35 Failure Resilience) |
| **ERA5 (Copernicus Climate Data Store)** | Historical wind reanalysis | P0 | Well-established, freely accessible with registration; standard forcing source for OpenDrift wind fields |
| **Open-Meteo Marine** | Lightweight wind/marine API alternative | P1 | No-registration, simple REST API — useful as a fast fallback/testing data source during development, classified P1 alongside ERA5 |

---

## 8. AIS Data

| Source | Role | Priority | Verified access notes |
|---|---|---|---|
| **MarineCadastre AIS (AccessAIS / bulk downloads)** | Historical AIS dataset — CSV/GeoParquet, U.S. Coast Guard Nationwide AIS network | P1 (cached demo dataset) | **Verified (2026):** Free, no-cost bulk and custom "clip and ship" downloads via AccessAIS; recent years available in analysis-ready GeoParquet. **Critical limitation verified:** coverage is **U.S. coastal waters and territories only** — it is *not* an Indian-coastal-waters data source. It is documented here purely as a reliable, well-structured, freely licensed AIS dataset **shape/format reference and demo-data substitute**, not as a claim of Indian-waters coverage. This limitation must be stated explicitly in the demo narrative (`AppFlow.md` §Demo Mode) and in the evidence dossier provenance metadata. |
| **Global Fishing Watch (GFW) APIs** | AIS vessel tracks, SAR vessel detections (Sentinel-1/2 derived), AIS "off"/gap events | P1 | **Verified (2026):** Free API-token access; Events API includes AIS-disabling ("AIS off"/gap) events directly relevant to FR-V1; a Datasets/4Wings API provides SAR-derived vessel detections relevant to FR-V2. **Licensing constraint verified:** GFW APIs are stated to be **available for non-commercial purposes only** — acceptable for a hackathon/research prototype but must be flagged as a constraint for any future commercial/government deployment path (`prd.md` §15 Future Scope). |
| **pyAIS / libais** | Raw NMEA AIS message decoding | **P2** | Only needed if raw AIS feeds (rather than pre-parsed MarineCadastre/GFW records) must be decoded; not required if MVP consumes already-structured AIS datasets |
| **MovingPandas** | Vessel trajectory analytics (interpolation, speed/heading derivation) | P1 | Simplifies FR-A2's trajectory-alignment scoring; strong pandas/GeoPandas integration |
| **Tracktable** | Large-scale trajectory processing / anomaly analysis | **P3** | Production-scale capability; unnecessary for MVP dataset sizes |

---

## 9. Satellite Imagery Sources

| Source | Role | Priority | Verified access notes |
|---|---|---|---|
| **Copernicus Data Space Ecosystem** | Primary Sentinel-1 SAR scene source | P0 | **Verified (2026):** Free registration, OAuth token-based authentication, full Sentinel-1 GRD/SLC archive plus near-real-time acquisitions via OData/STAC/Sentinel Hub APIs. This is the primary and most reliable open SAR source for the MVP. |
| **ISRO Bhoonidhi** | RISAT-1A / EOS-04 SAR imagery (Indian regional context) | **P1 (open resolution) / P2 (fine resolution)** | **Verified (2026) — important licensing distinction:** EOS-04 data **coarser than 5m spatial resolution (ScanSAR mode) is Open Data for all users**. EOS-04 **finer-than-5m data (Stripmap mode)** is **Open only for Indian Government Entities** and **priced for Non-Government Entities** under the Indian Space Policy 2023 dissemination rules. As a student/non-government team, Spill Sense treats **ScanSAR (open, coarser resolution) EOS-04 imagery as P1** (usable, demonstrates the "Indian data source" differentiator) and **Stripmap (fine-resolution, priced) imagery as P2/P3** unless institutional/government access is arranged. Sentinel-1 remains the P0 primary source specifically because it has no such resolution-tiered licensing barrier. |

---

## 10. Queues, Real-Time, Object Storage

| Technology | Role | Priority |
|---|---|---|
| **Celery (task queue)** | Async processing orchestration | P0 |
| **Redis (broker/cache)** | Queue backend + job status cache | P0 |
| **MinIO** | S3-compatible object storage, offline-capable | P0 |
| **WebSocket / Socket.io** | Job progress push | P1 |

---

## 11. Security

| Technology / Practice | Role | Priority |
|---|---|---|
| **Environment-variable secret management (.env + secret store)** | No credentials in source code (`rules.md`) | P0 |
| **JWT-based auth (FastAPI security utilities)** | Basic authentication for investigator accounts | P1 |
| **CORS policy configuration** | Restrict frontend-origin access | P0 |
| **Rate limiting (e.g., `slowapi`)** | Prevent API abuse | P1 |
| **Input validation (Pydantic) + file-type/size validation on scene upload** | Prevent malformed/malicious uploads | P0 |
| **SHA-256 (Python `hashlib`)** | Evidence artifact integrity hashing | P0 |

---

## 12. Testing

| Technology | Role | Priority |
|---|---|---|
| **Pytest** | Unit + integration testing | P0 |
| **pytest-asyncio, httpx** | Async FastAPI endpoint testing | P0 |
| **Testcontainers / Dockerized Postgres+PostGIS for CI** | Integration testing against real spatial database | P1 |
| **Great Expectations (or lightweight custom validators)** | AIS/environmental data validation checks | **P2** |

---

## 13. Monitoring, DevOps, Deployment

| Technology | Role | Priority |
|---|---|---|
| **Docker + Docker Compose** | Local/demo environment reproducibility | P0 |
| **GitHub Actions** | CI (lint, test) on push/PR | P1 |
| **Kubernetes** | Production orchestration | **P3** |
| **Grafana + Prometheus** | Production monitoring/observability | **P3** |
| **Structured logging (Python `logging` + JSON formatter)** | Debuggability during hackathon build/demo | P0 |

---

## 14. Notification / Communication Services

| Technology | Role | Priority |
|---|---|---|
| **In-app job/incident status updates** | Core notification mechanism for MVP | P0 |
| **Twilio (SMS)** | External alerting | **P3** |
| **SendGrid (email)** | External alerting | **P3** |

---

## 15. Research Verification Summary (per PRD §5 / Master Prompt §5)

| Resource | Verified? | Key finding |
|---|---|---|
| Copernicus Data Space Ecosystem | ✅ | Free, OAuth-token access, full Sentinel-1 archive, multiple API protocols (OData/STAC/Sentinel Hub) |
| ISRO Bhoonidhi | ✅ | EOS-04 ScanSAR (coarser than 5m) open to all; Stripmap (finer than 5m) restricted/priced for non-government entities |
| MarineCadastre AIS | ✅ | Free, well-structured (CSV/GeoParquet), but **U.S.-waters-only coverage** — usable as demo-data shape reference, not Indian-waters ground truth |
| Global Fishing Watch APIs | ✅ | Free with API token; includes AIS-gap ("AIS off") events and SAR-derived vessel detections directly relevant to dark-vessel analysis; **non-commercial use only** |
| OpenDrift / OpenOil | ✅ | Open-source (GPLv2), Python, purpose-built oil-drift module with native backward-tracking — primary drift engine confirmed suitable |
| Kaggle Sentinel-1 Oil Spill Dataset | ⚠️ Partially verified | Usable for model development; class balance/label quality/regional transferability must be empirically assessed during Phase 4 — do not assume Kaggle benchmark accuracy transfers to Indian coastal waters (PRD §16 Assumptions) |
| Aresys SCT (GitHub) | ✅ | Real, MIT-licensed, actively maintained — but a SAR *calibration/QA* toolbox, not a detection model; classified P3 reference only |
| OilSpillNet, Multi-Factor-Attribution-Engine (GitHub) | ⚠️ Unverified individually | Treat as community reference repositories; license/maintenance status must be independently confirmed before any code reuse — never blindly copy (`rules.md` §Dependencies) |
| INCOIS portal | ⚠️ To verify in Phase 0 | Prioritized for Indian relevance; CMEMS is the documented fallback if the INCOIS API/portal proves unreliable during the build window |

**Standing instruction to the coding agent:** Before Phase 3 (Satellite/SAR ingestion) begins, re-verify current rate limits and authentication flow for Copernicus Data Space Ecosystem and Bhoonidhi, since these change over time; if either is degraded or unreachable, fall back immediately to the cached Demo Mode scene per `AppFlow.md` §Failure Resilience.

---

## 16. Business / Viability Context (non-technical, for framing only)

Potential future adoption pathways — **documented as pathways, not current customers**:

- NTRO, Indian Coast Guard, DG Shipping, Port Authorities (government/regulatory adoption).
- SaaS model for ports/fleets; forensic-audit services; insurance-related analytics (commercial pathway — would require revisiting the GFW non-commercial-use constraint above).

Impact framing (maintained consistently with `prd.md` §17 Success Metrics):

```
Early Detection → Faster Investigation → Faster Containment
→ Reduced Spill Spread → Reduced Marine Ecosystem Damage
→ Reduced Fisheries / Tourism / Economic Loss
```

---

## 17. Technologies Explicitly Downgraded from the Presentation's Candidate List

| Technology | Presentation status | Spill Sense classification | Reason |
|---|---|---|---|
| CesiumJS | Listed | P3 | 3D globe not required for a 2D investigative tactical map |
| Kubernetes | Listed | P3 | Operational overhead inappropriate for hackathon deployment |
| Grafana / Prometheus | Listed | P3 | Production observability, not demo-critical |
| SAM 2 | Listed | P2/P3 | General-purpose foundation model, no demonstrated MVP advantage over U-Net for SAR-specific segmentation without fine-tuning |
| DeepLabv3+ | Listed as alternative | P2 | Comparable-or-lower expected value than U-Net+ResNet-50 for the available time budget; revisit only on demonstrated underperformance |
| ESA SNAP / snappy | Listed | P2 | Copernicus pre-calibrated GRD products reduce the need for full SNAP-based radiometric calibration in MVP |
| Aresys SCT | Listed | P3 | Calibration/QA toolbox, not a detection capability |
| Twilio / SendGrid | Listed | P3 | External notification channels are non-essential to the DETECT→PROVE demo chain |
| Deck.gl | Listed | P2 | Promote only if AIS trajectory rendering volume demands it |
| Tracktable | Listed | P3 | Large-scale trajectory analytics beyond MVP dataset size |

# Spill Sense — Implementation Plan

**Project:** Spill Sense · **Team:** BUG STALKERS · **SIH26143**
**Companion documents:** `prd.md`, `tech_stack.md`, `AppFlow.md`, `design.md`, `schema.md`, `Tracker.md`, `rules.md`

This plan sequences the build so a **working P0 end-to-end demo exists before P2/P3 infrastructure is touched** (PRD §14, master directive §62). Each phase lists objective, prerequisites, tasks, files/modules, dependencies, deliverables, validation, and definition of done (DoD). `Tracker.md` mirrors these phases for live status tracking.

---

## Phase 0 — Research & Architecture Validation

**Objective:** Confirm the assumptions `tech_stack.md` documents are still true at build time, before committing engineering hours.

**Prerequisites:** None.

**Tasks:**
- Re-verify Copernicus Data Space Ecosystem authentication flow and current rate limits.
- Re-verify ISRO Bhoonidhi access tier (open ScanSAR vs priced Stripmap) for the team's registration category.
- Confirm INCOIS portal/API availability; if unreliable, formally adopt CMEMS as primary (not just fallback).
- Confirm Global Fishing Watch API token acquisition process and non-commercial-use terms.
- Download and inspect a sample of the Kaggle Sentinel-1 oil-spill dataset: label quality, class balance, resolution.
- Select and download one curated demo SAR scene + matching environmental + AIS window for Demo Mode.

**Files/modules:** `/research/` notes directory (not shipped code), `/data/demo/` staging folder.

**Dependencies:** None — this phase can start immediately and in parallel with Phase 1.

**Deliverables:** A short written confirmation (in `Tracker.md` §Research) of each resource's actual current status; the demo scenario's raw inputs staged locally.

**Validation:** Every "Research Verification" row in `tech_stack.md` §15 is either confirmed or has an updated status.

**Definition of Done:** Demo scenario inputs are present on disk and loadable; no unresolved "unknown" access questions remain for P0-classified data sources.

---

## Phase 1 — Project Foundation

**Objective:** Establish the repository skeleton, tooling, and environment configuration.

**Prerequisites:** None (parallel with Phase 0).

**Tasks:**
- Initialize monorepo structure: `/backend` (FastAPI), `/frontend` (Next.js), `/infra` (Docker Compose).
- Configure `.env`/secret handling per `rules.md` §Security — no credentials committed.
- Set up Docker Compose: PostgreSQL+PostGIS, Redis, MinIO, backend, frontend.
- Set up linting/formatting (backend: ruff/black; frontend: eslint/prettier).
- Set up GitHub Actions skeleton (lint + test on PR).
- Confirm Mapbox GL JS vs MapLibre GL JS decision (per `tech_stack.md` §1) and wire the chosen library into a blank Next.js page.

**Files/modules:** `docker-compose.yml`, `backend/app/main.py`, `backend/app/core/config.py`, `frontend/` scaffold.

**Dependencies:** None.

**Deliverables:** `docker compose up` brings up all services; a blank map renders in the frontend; CI runs on push.

**Validation:** CI green on an empty test suite; all containers healthy.

**Definition of Done:** A new developer can clone, `docker compose up`, and see a running (empty) app end-to-end.

---

## Phase 2 — Database & Data Layer

**Objective:** Implement the schema in `schema.md` with migrations.

**Prerequisites:** Phase 1 (Docker/PostGIS running).

**Tasks:**
- Implement SQLAlchemy models for all 17 tables in `schema.md`.
- Write initial Alembic migration; enable PostGIS extension in migration.
- Implement all indexes specified in `schema.md` (GiST, composite, B-tree).
- Implement enum types / check constraints.
- Write a seed script for the Demo Mode scenario's reference data (model_versions row, incident shell).

**Files/modules:** `backend/app/models/`, `backend/alembic/versions/`, `backend/app/db/seed.py`.

**Dependencies:** Phase 1.

**Deliverables:** `alembic upgrade head` produces the full schema; seed script populates one demo incident shell.

**Validation:** Unit tests confirming geometry columns accept/reject invalid input; `\d` inspection in psql matches `schema.md`.

**Definition of Done:** Schema matches `schema.md` exactly (or documented, justified deviations recorded per `rules.md` §Database — migrations only, no manual schema edits).

---

## Phase 3 — Satellite / SAR Ingestion

**Objective:** Implement the Satellite Ingestion module (`AppFlow.md` §4).

**Prerequisites:** Phase 2. Requires Phase 0's confirmed Copernicus/Bhoonidhi access details.

**Tasks:**
- Implement `satellite/` domain module: scene metadata validation, Copernicus Data Space OAuth client, Bhoonidhi client (P1), cached/demo loader.
- Implement `raster_assets` registration with file hashing on ingest.
- Implement the async job wrapper (`POST /api/v1/incidents` → Celery task → `processing_jobs` row).
- Implement the Live/Demo mode switch (`AppFlow.md` §18–19) at the ingestion adapter boundary.

**Files/modules:** `backend/app/domains/satellite/`, `backend/app/tasks/ingestion.py`, `backend/app/api/v1/incidents.py`.

**Dependencies:** Phase 2 (database), Phase 0 (verified access + staged demo scene).

**Deliverables:** Creating an incident with the demo scene reference produces a `satellite_scenes` + `raster_assets` row with correct hash and metadata, without any live network call in Demo Mode.

**Validation:** Integration test: ingest demo scene end-to-end; unit test: metadata validation rejects malformed input.

**Definition of Done:** Demo scene ingestion is 100% reliable offline; live ingestion path is implemented and manually verified at least once against Copernicus.

---

## Phase 4 — AI Oil Detection

**Objective:** Implement segmentation inference and vectorization (`AppFlow.md` §6).

**Prerequisites:** Phase 3 (normalized rasters available). Can develop the model itself in parallel with Phase 3 using the Kaggle dataset.

**Tasks:**
- Train/fine-tune the U-Net (ResNet-50 encoder) baseline on the Kaggle Sentinel-1 oil-spill dataset (`tech_stack.md` §5); document train/val/test split and class balance.
- Export the trained model (PyTorch, optionally ONNX per `tech_stack.md`).
- Implement `oil_detection/` module: tiling, inference, mask assembly, thresholding, morphological post-processing.
- Implement vectorization (Shapely) and geodesic area/centroid/perimeter calculation (`schema.md` §1).
- Register model version in `model_versions`.
- Validate the trained model specifically against the curated demo scene to guarantee a known-good demo result.

**Files/modules:** `backend/app/domains/oil_detection/`, `ml/training/` (training scripts, not shipped to production image), `backend/app/tasks/inference.py`.

**Dependencies:** Phase 3, Phase 2.

**Deliverables:** Running inference on the demo scene produces a `oil_spills` record with polygon, area, centroid, and `segmentation_confidence`.

**Validation:** Unit tests for geometry calculations (known-input/known-output cases); AI validation tests for model loading, preprocessing shape correctness, output geometry validity.

**Definition of Done:** Demo scene reliably produces the expected slick polygon within a documented tolerance; model version is recorded and reproducible.

---

## Phase 5 — Look-alike Filtering

**Objective:** Implement environmental-compatibility and look-alike-risk scoring (`AppFlow.md` §7).

**Prerequisites:** Phase 4 (raw detections exist), environmental data access confirmed in Phase 0.

**Tasks:**
- Implement `environmental/` module: wind-speed retrieval (ERA5/Open-Meteo/cached) at detection time/location.
- Implement the documented `environmental_compatibility` and `look_alike_risk` functions as configuration-driven, not hardcoded.
- Combine into `final_confidence`; persist on `oil_spills`.
- Document the formula and its parameters in module docstrings/README (`rules.md` §AI — never fabricate confidence).

**Files/modules:** `backend/app/domains/environmental/`, `backend/app/domains/oil_detection/lookalike.py`.

**Dependencies:** Phase 4, Phase 0 (environmental data source decisions).

**Deliverables:** Every `oil_spills` record has populated `environmental_compatibility`, `look_alike_risk`, `final_confidence`.

**Validation:** Unit tests for the scoring functions with known synthetic inputs.

**Definition of Done:** Final confidence is never equal to raw segmentation confidence (i.e., the adjustment is genuinely applied) and is documented and reproducible.

---

## Phase 6 — Drift Modeling

**Objective:** Implement the backward Lagrangian + Monte Carlo pipeline (`AppFlow.md` §9–10).

**Prerequisites:** Phase 5 (finalized slick geometry), Phase 0 (current/wind data source confirmed).

**Tasks:**
- Integrate OpenDrift/OpenOil (`tech_stack.md` §6); implement `drift/` module wrapping simulation configuration and execution.
- Implement particle initialization from slick polygon, backward timestep configuration, windage coefficient, Monte Carlo perturbation.
- Persist `drift_runs` and `drift_particles`.
- Implement origin-envelope derivation (density surface → probability contours) and persist `origin_envelopes` with high/medium/low bands.
- Implement the cached-forcing fallback path (`AppFlow.md` §17).

**Files/modules:** `backend/app/domains/drift/`, `backend/app/tasks/drift_simulation.py`.

**Dependencies:** Phase 5, Phase 2, Phase 0.

**Deliverables:** Running drift on the demo incident produces a `drift_runs` record with full parameter provenance and a 3-band `origin_envelopes` set.

**Validation:** Unit tests for simulation configuration validation; GIS tests for output geometry validity; a manual review confirming the envelope is not a single-point degenerate case.

**Definition of Done:** Demo incident produces a stable, reproducible origin envelope within the phase's time budget (drift simulation completes within the async job timeout used for the demo).

---

## Phase 7 — AIS Processing

**Objective:** Implement AIS ingestion, validation, and trajectory construction (`AppFlow.md` §11).

**Prerequisites:** Phase 2. Can be developed in parallel with Phases 4–6 since it does not depend on drift/detection output.

**Tasks:**
- Implement `ais/` module: raw AIS ingestion (MarineCadastre bulk/GFW API/cached demo file), validation, deduplication, UTC timestamp normalization.
- Implement trajectory construction per vessel (MMSI-keyed) with spatial + temporal indexing.
- Stage the demo AIS dataset covering the demo scenario's spatio-temporal window (from Phase 0).
- Document explicitly in the demo narrative that MarineCadastre coverage is U.S.-waters-only and is used as a structural/demo substitute (`tech_stack.md` §8).

**Files/modules:** `backend/app/domains/ais/`, `backend/app/tasks/ais_ingestion.py`.

**Dependencies:** Phase 2.

**Deliverables:** `vessels` and `ais_positions` populated for the demo scenario; queries against `(vessel_id, timestamp)` and spatial position are indexed and performant.

**Validation:** Unit tests for coordinate/timestamp validation and gap-adjacent edge cases; load test confirming indexed query performance at demo-dataset scale.

**Definition of Done:** AIS trajectories for the demo scenario are queryable by spatial and temporal filters with acceptable latency for the live demo.

---

## Phase 8 — Attribution Engine

**Objective:** Implement candidate extraction and multi-factor scoring (`AppFlow.md` §12–13).

**Prerequisites:** Phase 6 (origin envelope exists), Phase 7 (AIS trajectories exist).

**Tasks:**
- Implement `attribution/` module: spatial/temporal intersection query against `origin_envelopes`.
- Implement the five scoring factors (spatial, temporal, trajectory alignment, behavior, AIS continuity) as independently testable functions.
- Implement configurable weighting and overall-score normalization; persist `attribution_scores` with `scoring_config_version`.
- Implement ranking and persistence of `vessel_candidates`.

**Files/modules:** `backend/app/domains/attribution/`, `backend/app/tasks/attribution.py`.

**Dependencies:** Phase 6, Phase 7.

**Deliverables:** Running attribution on the demo incident produces a ranked candidate list with full per-factor breakdowns.

**Validation:** Unit tests per scoring factor with synthetic vessel tracks (including edge cases: vessel entirely outside envelope, vessel with full temporal overlap but no spatial overlap, etc.).

**Definition of Done:** The demo incident reliably surfaces at least one ranked candidate vessel with an explainable score breakdown.

---

## Phase 9 — Dark Vessel Analysis

**Objective:** Implement AIS-gap classification and SAR-vessel correlation (`AppFlow.md` §14).

**Prerequisites:** Phase 7 (AIS trajectories), Phase 4 (SAR scene already processed — vessel-target extraction reuses the same scene).

**Tasks:**
- Implement `dark_vessel/` module, AIS-gap sub-module: gap detection + `normal`/`uncertain`/`suspicious` classification logic (documented criteria, not arbitrary thresholds).
- Implement SAR-vessel-detection sub-module (CFAR or a documented simpler MVP-appropriate target-extraction approach per `tech_stack.md`); compare against known AIS positions.
- Persist `ais_gaps`; surface dark-vessel signals inside the attribution breakdown UI/API payload (never standalone).
- If reliable SAR-vessel detection cannot be completed to a demo-safe standard within the time budget, ship a clearly documented prototype/limited version rather than a fabricated result (PRD §19, master directive §64).

**Files/modules:** `backend/app/domains/dark_vessel/`.

**Dependencies:** Phase 7, Phase 4.

**Deliverables:** Demo incident shows at least the AIS-gap analysis signal; SAR-vessel correlation ships if reliability threshold is met, otherwise documented as a limited prototype in `Tracker.md`.

**Validation:** Unit tests for gap classification logic against synthetic gap scenarios.

**Definition of Done:** No AIS gap or SAR-vessel mismatch is ever presented as an automatic accusation; classification logic is documented.

---

## Phase 10 — Frontend / Tactical Dashboard

**Objective:** Implement the six core screens and reusable components from `design.md`.

**Prerequisites:** Phases 3–9 provide the API payloads the frontend consumes. Component scaffolding (map wrapper, layout shell) can start in parallel with Phase 1–2.

**Tasks:**
- Implement `TacticalMap` + `MapLayerControl` and all map-layer components (`SpillPolygon`, `OriginProbabilityLayer`, `DriftTrajectoryLayer`, `VesselTrack`).
- Implement Command Dashboard, Incident Investigation View, Drift Analysis, Vessel Attribution, Evidence Center, Analytics screens.
- Implement `ConfidencePanel`, `AttributionBreakdown`, `VesselCandidateTable`, `InvestigationTimeline`, `ProcessingStatus`, `JobProgress`.
- Wire job-status polling/WebSocket for live processing updates.
- Implement the dark theme, color semantics, and accessibility requirements from `design.md`.

**Files/modules:** `frontend/app/`, `frontend/components/`.

**Dependencies:** Backend API contracts stabilized from Phases 3–9 (can develop against mocked payloads earlier and integrate incrementally).

**Deliverables:** A fully navigable UI reflecting real backend data for the demo incident.

**Validation:** Manual UX walkthrough against `design.md` §9 screen list; accessibility spot-check (contrast, keyboard nav on map controls).

**Definition of Done:** An investigator can go from Command Dashboard to a fully populated Evidence Center for the demo incident using only the UI.

---

## Phase 11 — Evidence Dossier

**Objective:** Implement PDF generation and hashing (`AppFlow.md` §15).

**Prerequisites:** Phases 4–9 (all incident artifacts exist to assemble).

**Tasks:**
- Implement `evidence/` module: payload assembly from all relevant tables.
- Implement PDF rendering (e.g., WeasyPrint or ReportLab) including maps, tables, and provenance metadata per PRD §11.6 content list.
- Implement SHA-256 hashing of the PDF and key underlying artifacts; persist `evidence_artifacts`, `reports`.
- Implement the explicit integrity-vs-legal-admissibility disclosure text in the dossier itself.

**Files/modules:** `backend/app/domains/evidence/`, `backend/app/tasks/evidence_generation.py`.

**Dependencies:** Phases 4–9.

**Deliverables:** A downloadable PDF dossier for the demo incident with a verifiable SHA-256 hash.

**Validation:** Unit tests for hashing correctness (hash changes iff content changes); manual review of dossier content against the PRD §11.6 checklist.

**Definition of Done:** Demo incident's dossier generation completes reliably within the job time budget and passes the language-honesty review (`rules.md`).

---

## Phase 12 — Integration

**Objective:** Connect all phases into one seamless end-to-end run for the demo scenario.

**Prerequisites:** Phases 3–11 individually functional.

**Tasks:**
- Wire the full job chain: ingestion → detection → look-alike → drift → AIS correlation → attribution → dark vessel → evidence, either as chained Celery tasks or an orchestrating task.
- Verify all `data_source_flag`/`mode` markers propagate correctly end-to-end.
- Run the full demo scenario multiple times for consistency.

**Files/modules:** `backend/app/tasks/pipeline.py` (orchestration).

**Dependencies:** Phases 3–11.

**Deliverables:** A single incident creation triggers the full pipeline to a completed evidence dossier without manual intervention.

**Validation:** End-to-end integration test covering SAR → AI → Drift → AIS → Attribution → Evidence.

**Definition of Done:** The full chain in PRD §17 Demo Scenario completes successfully at least 5 consecutive times in Demo Mode.

---

## Phase 13 — Testing

**Objective:** Fill remaining test coverage gaps per `rules.md` §Testing and PRD §"Testing" categories.

**Prerequisites:** Phase 12 (system is integrated enough to test holistically).

**Tasks:**
- Complete unit test coverage for geometry calculations, attribution scoring, validators, environmental processing.
- Complete API/integration tests for all `/api/v1/*` endpoints.
- Complete AI tests (model loading, preprocessing, output validation).
- Complete GIS tests (CRS handling, geometry validity, spatial intersection correctness).
- Complete Drift tests (configuration validation, output generation).
- Complete AIS tests (coordinate validation, timestamp normalization, gap detection).
- Complete Evidence tests (PDF generation, hashing, provenance).

**Files/modules:** `backend/tests/`.

**Dependencies:** Phase 12.

**Deliverables:** CI test suite covering all categories above.

**Definition of Done:** CI passes on `main`; no P0 module lacks test coverage for its core logic.

---

## Phase 14 — Deployment

**Objective:** Package the system for reliable demo-day operation.

**Prerequisites:** Phase 13.

**Tasks:**
- Finalize Docker Compose for a single-command demo-day startup.
- Confirm MinIO/local storage contains all demo-mode assets pre-baked into the deployment (no first-run download).
- Document a one-page "how to run the demo" runbook.

**Files/modules:** `infra/`, `README.md`.

**Dependencies:** Phase 13.

**Deliverables:** A machine (or venue laptop) can run `docker compose up` and have the full demo ready within a few minutes, offline.

**Definition of Done:** A clean-machine test (no prior local state) successfully runs the full Demo Mode scenario.

---

## Phase 15 — Demo Hardening

**Objective:** Eliminate any remaining risk to the judged 3–5 minute demonstration.

**Prerequisites:** Phase 14.

**Tasks:**
- Rehearse the exact judging flow from PRD §17: Incident selection → SAR imagery → detected slick → area/centroid → look-alike validation → backward drift → origin envelope → AIS tracks → ranked candidates → explainable attribution → dark-vessel signal → evidence dossier → hash verification.
- Time the full walkthrough; pre-trigger any long-running job so the live demo shows a completed or near-completed state where appropriate.
- Verify no UI/API/PDF text uses prohibited phrasing (`rules.md` §Language Rules) — final honesty audit.
- Prepare a fallback recorded walkthrough only as a last-resort contingency (not a replacement for the live system).

**Files/modules:** N/A (process/rehearsal phase).

**Dependencies:** Phase 14.

**Deliverables:** A rehearsed, timed, judge-ready demonstration.

**Definition of Done:** The team can execute the full demo flow live, offline, within the time budget, at least 3 times without failure.

---

## Parallelizable Work Summary

| Can run in parallel | With |
|---|---|
| Phase 0 (Research) | Phase 1 (Foundation) |
| Phase 1 (Foundation) | Phase 0 |
| Phase 4 model training | Phase 3 (ingestion pipeline plumbing) |
| Phase 7 (AIS processing) | Phases 4–6 (Detection/Look-alike/Drift) — no shared dependency until Phase 8 |
| Phase 10 (Frontend scaffolding/components) | Phases 3–9, once mocked API contracts are agreed |
| Phase 13 (Testing) additions | Can begin incrementally alongside each earlier phase rather than only at the end — the phase ordering above reflects when a category becomes *complete*, not when writing tests may *begin* |

---

## Hackathon Priority Enforcement

The team must reach a working Phase 12 (Integration) checkpoint — the full P0 chain — **before** allocating further time to P2/P3 items listed in `tech_stack.md` (e.g., Deck.gl, DuckDB Spatial analytics, ONNX optimization, SNAP-based full calibration). See `Tracker.md` for live status against this rule.

# Spill Sense — Project Tracker

**Project:** Spill Sense · **Team:** BUG STALKERS · **SIH26143**
**Companion documents:** `prd.md`, `tech_stack.md`, `AppFlow.md`, `design.md`, `schema.md`, `implementationPlan.md`, `rules.md`

> This is a living document. The coding agent and team members update it continuously as work proceeds — it is not a one-time snapshot. Status legend: `[ ]` Not started · `[~]` In progress · `[x]` Completed.

---

## Overall Progress

**Current Milestone:** Phase 0 — Research & Architecture Validation (not yet started)
**Overall completion:** 0% (documentation/specification stage complete; implementation not yet begun)
**Target:** Working P0 end-to-end demo (Phase 12 checkpoint) before any P2/P3 work

---

## Phase Checklist (mirrors `implementationPlan.md`)

- [ ] Phase 0 — Research & Architecture Validation
- [ ] Phase 1 — Project Foundation
- [ ] Phase 2 — Database & Data Layer
- [ ] Phase 3 — Satellite / SAR Ingestion
- [ ] Phase 4 — AI Oil Detection
- [ ] Phase 5 — Look-alike Filtering
- [ ] Phase 6 — Drift Modeling
- [ ] Phase 7 — AIS Processing
- [ ] Phase 8 — Attribution Engine
- [ ] Phase 9 — Dark Vessel Analysis
- [ ] Phase 10 — Frontend / Tactical Dashboard
- [ ] Phase 11 — Evidence Dossier
- [ ] Phase 12 — Integration
- [ ] Phase 13 — Testing
- [ ] Phase 14 — Deployment
- [ ] Phase 15 — Demo Hardening

---

## Backend
- [ ] Project skeleton (FastAPI app, config, routing)
- [ ] Domain modules scaffolded (satellite, sar_processing, oil_detection, environmental, drift, ais, attribution, dark_vessel, evidence, notifications)
- [ ] Celery/Redis job infrastructure

## Frontend
- [ ] Next.js + TypeScript + Tailwind scaffold
- [ ] Map library decision finalized (Mapbox GL JS vs MapLibre GL JS)
- [ ] Command Dashboard
- [ ] Incident Investigation View
- [ ] Drift Analysis screen
- [ ] Vessel Attribution screen
- [ ] Evidence Center
- [ ] Analytics screen

## Database
- [ ] PostgreSQL + PostGIS provisioned (Docker Compose)
- [ ] Alembic migrations for all 17 tables in `schema.md`
- [ ] Indexes verified (GiST/B-tree/composite)
- [ ] Demo seed data loaded

## AI/ML
- [ ] Kaggle Sentinel-1 dataset inspected (labels, balance, resolution)
- [ ] U-Net (ResNet-50 encoder) baseline trained
- [ ] Model exported + versioned in `model_versions`
- [ ] Validated against curated demo scene

## SAR
- [ ] Copernicus Data Space Ecosystem client implemented
- [ ] Bhoonidhi client implemented (P1)
- [ ] SAR preprocessing (speckle handling, normalization) implemented
- [ ] Demo scene staged locally (offline-capable)

## GIS
- [ ] CRS standard implemented consistently (storage 4326, geodesic calculation method)
- [ ] Vectorization + geodesic area/centroid/perimeter implemented
- [ ] Spatial indexes verified functional

## Drift
- [ ] OpenDrift/OpenOil integrated
- [ ] Backward particle initialization + Monte Carlo perturbation implemented
- [ ] Origin probability envelope (3-band) generation implemented
- [ ] Cached-forcing fallback implemented and tested

## AIS
- [ ] MarineCadastre/GFW ingestion implemented
- [ ] Validation, dedup, UTC normalization implemented
- [ ] Trajectory construction + spatial/temporal indexing implemented
- [ ] Demo AIS dataset staged

## Attribution
- [ ] Candidate extraction (spatial/temporal intersection) implemented
- [ ] Five-factor scoring functions implemented + unit tested
- [ ] Ranking + persistence implemented

## Dark Vessel
- [ ] AIS-gap classification (normal/uncertain/suspicious) implemented
- [ ] SAR-vessel detection prototype implemented or explicitly documented as limited
- [ ] Signals surfaced inside attribution breakdown (never standalone)

## Evidence
- [ ] PDF dossier generation implemented (full PRD §11.6 content checklist)
- [ ] SHA-256 hashing implemented and unit tested
- [ ] Integrity-vs-legal-admissibility disclosure text present in dossier

## Testing
- [ ] Unit test coverage: geometry, scoring, validators
- [ ] API/integration tests: all `/api/v1/*` endpoints
- [ ] AI tests: model loading, preprocessing, output validation
- [ ] GIS tests: CRS handling, geometry validity
- [ ] Drift tests: configuration validation, output generation
- [ ] AIS tests: coordinate/timestamp validation, gap detection
- [ ] Evidence tests: PDF generation, hashing, provenance
- [ ] End-to-end test: SAR → AI → Drift → AIS → Attribution → Evidence

## DevOps
- [ ] Docker Compose (Postgres+PostGIS, Redis, MinIO, backend, frontend)
- [ ] GitHub Actions CI (lint + test)
- [ ] Clean-machine deployment verified (Phase 14 DoD)

## Research
- [ ] Copernicus Data Space Ecosystem access re-verified at build time
- [ ] Bhoonidhi access tier re-verified (open ScanSAR vs priced Stripmap)
- [ ] INCOIS availability confirmed or formally deprioritized in favor of CMEMS
- [ ] Global Fishing Watch API token acquired; non-commercial terms acknowledged
- [ ] Kaggle dataset suitability assessed (documented, not assumed)

## Demo
- [ ] Demo scenario inputs staged (SAR scene, environmental data, AIS window)
- [ ] Full pipeline rehearsed end-to-end offline
- [ ] Judging flow timed against 3–5 minute budget
- [ ] Final language-honesty audit passed (no prohibited phrasing anywhere)

---

## Blockers

*(none logged yet — update as they arise)*

## Risk Register

| Risk | Probability | Impact | Mitigation | Fallback |
|---|---|---|---|---|
| SAR look-alikes causing false positives | Medium | Medium | Look-alike validation stage (Phase 5), documented formula | Manual review flag in UI for borderline confidence |
| Insufficient/imbalanced labeled training data | Medium | High | Assess Kaggle dataset early (Phase 0/4); augmentation if needed | Lower confidence threshold + explicit "limited training data" disclosure |
| Copernicus/Bhoonidhi API unavailable at demo time | Low (mitigated) | High | Demo Mode uses cached scene | Fully offline Demo Mode (Phase 14/15) |
| INCOIS unavailable | Medium | Medium | Verify in Phase 0 | CMEMS as primary current source |
| AIS coverage gaps unrelated to incident | Medium | Medium | Use curated demo AIS window known to have coverage | Document coverage limitation explicitly in dossier |
| MarineCadastre is U.S.-only, not Indian waters | Confirmed (not a risk — a known constraint) | Medium | Use only as demo-data structural substitute; disclose explicitly | GFW as the more India-relevant AIS-adjacent source where available |
| Drift model uncertainty compounding over long backward windows | Medium | Medium | Document simulation duration limits; Monte Carlo band visualization | Present wider "low probability" band rather than false precision |
| Attribution false positives/negatives | Medium | Medium | Multi-factor scoring, explainable breakdown | Always present as "candidate," never "responsible vessel" |
| Large AIS dataset performance | Medium | Medium | Indexing per `schema.md` §4.10, DuckDB Spatial for batch analytics (P1) | Reduce demo AIS window size if needed |
| Celery/Redis integration complexity under time pressure | Low | Medium | Documented RQ fallback in `tech_stack.md` | Fall back to FastAPI `BackgroundTasks` for less critical async jobs only |
| Mapbox token/quota issues | Low | Low | MapLibre GL JS fallback identified | Switch library (API-compatible) |
| SAR-vessel dark detection unreliable in time available | Medium | Low | Scope as prototype with documented limitations if needed (Phase 9) | AIS-gap analysis alone still satisfies dual dark-vessel differentiator partially |

## Decisions

| Decision | Reason | Alternative considered | Recorded in |
|---|---|---|---|
| Modular monolith over microservices | Hackathon operational simplicity | Independent microservices | `tech_stack.md` §0 |
| PostgreSQL/PostGIS as primary DB | Spatial maturity, transactional integrity | DuckDB Spatial as primary | `tech_stack.md` §3 |
| U-Net + ResNet-50 as baseline segmentation | Established, transferable pretrained weights | DeepLabv3+, SAM 2 | `tech_stack.md` §5 |
| OpenDrift/OpenOil as drift engine | Verified open-source, purpose-built, native backtracking | NOAA PyGNOME | `tech_stack.md` §6 |
| Sentinel-1 (Copernicus) as primary SAR source | No resolution-tiered licensing barrier | ISRO Bhoonidhi as primary | `tech_stack.md` §9 |

## Technical Debt

*(none yet — log here as shortcuts are taken during implementation, with the plan to resolve them)*

## Research Questions (open)

- What is the actual achievable segmentation accuracy on the curated demo scene after training on the Kaggle dataset?
- Is INCOIS's current API/portal reliable enough to be a primary (not just aspirational) data source, or should CMEMS be adopted as primary outright?
- Is a CFAR-based SAR vessel detector realistically implementable to a demo-safe reliability standard within the time budget (Phase 9 decision point)?
- Do OilSpillNet / Multi-Factor-Attribution-Engine GitHub repositories offer any directly reusable, appropriately licensed components, or are they reference-only?

## Known Bugs

*(none yet — implementation has not started)*

## Integration Issues

*(none yet — implementation has not started)*

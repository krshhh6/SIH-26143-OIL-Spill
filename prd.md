# Spill Sense — Product Requirements Document (PRD)

**Project:** Spill Sense
**Team:** BUG STALKERS
**Event:** Smart India Hackathon 2026
**Problem Statement ID:** SIH26143
**Problem Statement Title:** "Leveraging satellite imagery to determine Oil spills at sea along with AIS data correlations to identify vessel responsible for the spill."
**Theme:** Disaster Management
**Category:** Software
**Document status:** Source of truth — v1.0
**Companion documents:** `tech_stack.md`, `AppFlow.md`, `design.md`, `schema.md`, `implementationPlan.md`, `Tracker.md`, `rules.md`

> This PRD is one of eight constitutional documents for Spill Sense. It defines **what** must be built and **why**. It intentionally avoids re-deriving implementation detail already owned by the other files — see the "Reference Map" at the end of this document.

---

## 1. Product Overview

Spill Sense is an AI-powered maritime oil-spill intelligence and attribution platform. It converts disconnected, hard-to-interpret sources — SAR satellite imagery, ocean/wind reanalysis data, and AIS vessel tracks — into a single automated investigative workflow that helps a human investigator go from *"there is a dark patch on a SAR scene"* to *"here is a ranked, explainable, evidence-backed list of candidate vessels, packaged as a tamper-evident dossier."*

Spill Sense is **not** a general-purpose satellite dashboard, a vessel-tracking product, or an automatic guilt-determination system. It is a decision-support tool built around one conceptual pipeline, which must remain intact across every document and every implementation decision:

```
DETECT  →  TRACE BACK  →  ATTRIBUTE  →  PROVE
```

- **DETECT** — Sentinel-1 / RISAT SAR imagery + AI segmentation → oil slick geometry.
- **TRACE BACK** — Backward Lagrangian drift modeling (currents + wind) + Monte Carlo dispersion → probable origin envelope in space and time.
- **ATTRIBUTE** — AIS trajectory correlation with the origin envelope + multi-factor probabilistic scoring → ranked candidate vessels.
- **PROVE** — Automatically generated, SHA-256-hashed forensic PDF dossier → tamper-evident, traceable evidence package.

---

## 2. Problem Statement

Oil spills at sea are frequently detected too late, traced imprecisely, and rarely attributed to a responsible vessel with defensible evidence. The core operational gaps SIH26143 asks us to close:

1. Satellite SAR imagery can reveal dark patches consistent with oil, but manual interpretation is slow and prone to false positives from look-alikes (low wind zones, algal blooms, ship wakes, rain cells, natural films).
2. Ocean currents and wind displace a slick between the moment of release and the moment of detection, so the detected location is **not** the release location — yet investigations often treat it as if it were.
3. AIS data exists in large volumes but is rarely correlated systematically with a slick's probable origin, and a responsible vessel may go "dark" (AIS gap) during or after a discharge event.
4. Investigators lack a single, reproducible, cryptographically verifiable package that ties detection → drift reconstruction → vessel correlation → supporting evidence together.

Spill Sense addresses all four gaps as one connected system rather than four disconnected tools.

---

## 3. SIH Context

- **Hackathon:** Smart India Hackathon 2026, Software category, Disaster Management theme.
- **Team:** BUG STALKERS.
- **Constraint reality:** The system must be demonstrable end-to-end in a 3–5 minute judged demo, must not depend on live external services being available at demo time, and must be buildable by a small student team within the SIH timeline. See `implementationPlan.md` Phase 15 (Demo Hardening) and PRD §17 (Demo Scenario).
- **Documentation purpose:** This PRD and its seven companion documents are supplied to an Antigravity/Gemini coding agent as the specification of record. The agent must be able to implement the system from these documents without re-inventing product scope.

---

## 4. Product Vision

Spill Sense should become the reference decision-support layer that any coastal monitoring authority, Coast Guard cell, or port authority can point at a SAR scene and receive, within one investigative session:

- a scientifically defensible slick detection with an explicit confidence breakdown,
- a probable origin region expressed as an uncertainty envelope, not a false-precision point,
- a ranked, explainable list of candidate vessels correlated against that origin envelope,
- a single reproducible, hash-verified evidence package suitable for handing to an investigator.

The vision is bounded by honesty: Spill Sense supports investigations, it does not replace investigators, maritime authorities, or legal procedures (see PRD §12, Non-Goals, and `rules.md` §"AI"/"Drift").

---

## 5. Goals

| # | Goal | Success signal |
|---|------|-----------------|
| G1 | Detect oil-slick candidates from SAR imagery with an explainable confidence score | Segmentation + look-alike-adjusted confidence produced for every processed scene |
| G2 | Reconstruct a probable spill origin using physics-informed backward drift, not proximity heuristics | Origin output is a Monte Carlo probability envelope, never a single deterministic point |
| G3 | Correlate AIS vessel tracks against the origin envelope and rank candidates with a transparent multi-factor score | Every ranked vessel has a visible factor-by-factor score breakdown |
| G4 | Surface dark-vessel signals via AIS-gap analysis and SAR-based vessel detection | Gap classification (normal/uncertain/suspicious) and SAR-vs-AIS comparison both present in MVP |
| G5 | Produce a tamper-evident forensic dossier for every incident | Every generated dossier carries SHA-256 hashes and a provenance record |
| G6 | Run reliably in front of judges regardless of external API availability | A fully functional Demo Mode using cached/local data exists (PRD §17) |
| G7 | Keep the system scientifically and legally honest in every surface (UI, API, DB, docs) | No prohibited phrasing (PRD §12) appears anywhere in shipped copy |

---

## 6. Non-Goals

Spill Sense explicitly will **not**, in this project:

- Claim to determine the exact release point (x₀, y₀, t₀) with certainty — it produces a probable origin envelope.
- Claim to identify "the responsible vessel" — it produces a ranked, scored **candidate** list.
- Treat a probability score as a legal accusation or automatic proof of guilt.
- Treat SHA-256 hashing as a substitute for legal admissibility procedures — it establishes integrity and provenance only.
- Become a generic satellite/AIS visualization dashboard with no attribution workflow.
- Attempt full real-time (sub-minute latency) operation — satellite revisit and processing latency make this scientifically inappropriate to claim; the system uses **near-real-time / latest-available / historical / batch** terminology accurately (see `rules.md`).
- Perform vessel identification for purposes unrelated to spill investigation (e.g., general fisheries surveillance, immigration enforcement).
- Implement every technology listed in the presentation's candidate stack — only what the P0–P3 classification in `tech_stack.md` calls for.

---

## 7. Target Users

1. **Maritime pollution investigators** (Coast Guard, DG Shipping, port authority environmental cells) — primary operational users who run incident investigations.
2. **Disaster management / environmental response coordinators** — need fast situational awareness (where is the slick, how severe, what's the response priority).
3. **SIH judges / technical evaluators** — assess technical depth, feasibility, and demo clarity.
4. **Future secondary users** (out of MVP scope, documented for context): insurance/forensic auditors, marine environmental researchers.

---

## 8. Stakeholders

| Stakeholder | Interest |
|---|---|
| Team BUG STALKERS | Build and present a technically credible, demo-reliable solution for SIH26143 |
| SIH evaluation panel | Judge innovation, technical depth, feasibility, and real-world impact |
| Potential adopting authorities (NTRO, Indian Coast Guard, DG Shipping, Port Authorities) | Long-term potential users/customers — documented as future adoption pathways only, not current customers (see `tech_stack.md` §Business Context) |
| Open data providers (Copernicus, ISRO Bhoonidhi, MarineCadastre, Global Fishing Watch, INCOIS, ERA5/CMEMS) | Upstream data dependencies; licensing and availability must be respected |

---

## 9. User Personas

**Persona 1 — Cmdr. Investigator (Primary)**
Coast Guard pollution-response investigator. Needs to quickly triage whether a SAR alert is a genuine oil slick, understand where it likely originated, and get a short, ranked list of vessels worth investigating first — with reasons, not a black box.

**Persona 2 — Response Coordinator**
Disaster-management duty officer monitoring multiple incidents at once. Needs a dashboard-level view: active incidents, severity, and status, without needing to interpret raw SAR or AIS data personally.

**Persona 3 — Technical Evaluator / Judge**
Needs to see, within minutes, that the system performs genuine science (not a static demo), understand the confidence/uncertainty at each stage, and see the full Detect → Trace Back → Attribute → Prove chain executed on a real scenario.

---

## 10. User Stories

- As an investigator, I want to select an incident and see the SAR scene with the detected slick polygon overlaid, so that I can visually confirm the detection.
- As an investigator, I want to see why the system believes a detection is oil rather than a look-alike, so that I can trust or challenge the result.
- As an investigator, I want to see a probability envelope for where the slick likely originated, with a time window, so that I can focus my search rather than treating one point as ground truth.
- As an investigator, I want to see AIS tracks of vessels that passed through the origin envelope during the relevant time window, ranked by a transparent score, so that I know who to investigate first.
- As an investigator, I want to know if a candidate vessel had a suspicious AIS gap near the origin region, so that I can factor that into my assessment without it being presented as proof.
- As an investigator, I want to generate a single evidence package with a SHA-256 hash, so that I can hand off a reproducible, tamper-evident record.
- As a response coordinator, I want a dashboard of all active incidents with severity indicators, so that I can prioritize response.
- As a judge, I want to watch one incident flow from raw SAR scene to a finished evidence dossier in under 5 minutes, so that I can evaluate the full pipeline.
- As a system operator, I want the demo to keep working if Copernicus/AIS/environmental APIs are unreachable, so that a live-demo failure never blocks the presentation.

---

## 11. Functional Requirements

Requirements are grouped by pipeline stage. Each is written to be testable (see `implementationPlan.md` Phase testing gates and `rules.md` "Testing").

### 11.1 Detect Requirements

- FR-D1: The system shall ingest a Sentinel-1 (or RISAT/EOS-04 where available) SAR scene, either via live API or from a local cached scene.
- FR-D2: The system shall run AI-based segmentation (baseline: U-Net with ResNet-50 encoder, see `tech_stack.md`) to produce a binary/probability oil-candidate mask.
- FR-D3: The system shall vectorize the segmentation output into a GeoJSON-compatible polygon and compute area, centroid, bounding box, and perimeter using correct geodesic (not planar-degree) calculations.
- FR-D4: The system shall attach a segmentation confidence score to every detected slick.
- FR-D5: The system shall record scene metadata (scene ID, acquisition time, source, spatial footprint) against every detection for provenance.

### 11.2 Look-alike / Environmental Validation Requirements

- FR-L1: The system shall compute an environmental-compatibility signal using wind speed (and, where available, sea-state context) at the detection time and location.
- FR-L2: The system shall compute a documented, reproducible "look-alike risk" adjustment and combine it with segmentation confidence into a **final confidence** score, per the formula documented in `AppFlow.md`.
- FR-L3: The system shall never present a raw, un-adjusted segmentation score as the final confidence shown to the investigator.

### 11.3 Trace Back / Drift Modeling Requirements

- FR-T1: The system shall initialize backward Lagrangian particle trajectories inside the detected slick polygon at the observed detection time.
- FR-T2: The system shall force the drift simulation with historical/reanalysis ocean current and wind vectors (INCOIS/CMEMS currents; ERA5 winds), applying a documented windage coefficient.
- FR-T3: The system shall apply Monte Carlo perturbation to represent uncertainty and shall output a **particle distribution**, not a single deterministic backtrace.
- FR-T4: The system shall derive an **origin probability envelope** (contour/polygon or raster representation, see `schema.md`) from the particle distribution, with explicit high/medium/low probability bands.
- FR-T5: The system shall record all simulation parameters (duration, timestep, particle count, forcing dataset versions, windage coefficient) against every drift run for reproducibility.
- FR-T6: The system shall never output or label a single point as "the exact origin."

### 11.4 Attribute Requirements

- FR-A1: The system shall query AIS vessel trajectories intersecting the origin probability envelope within the relevant time window.
- FR-A2: The system shall score each candidate vessel using a documented, configurable multi-factor formula (spatial overlap, temporal overlap, trajectory alignment, heading/course/speed behavior, AIS continuity — see `AppFlow.md`).
- FR-A3: The system shall rank candidate vessels by overall normalized score and shall display the per-factor breakdown for every ranked vessel.
- FR-A4: The system shall label output as "candidate vessel(s)," never "the responsible vessel" or "confirmed vessel."

### 11.5 Dark Vessel / AIS-Gap Requirements

- FR-V1: The system shall detect AIS transmission gaps for vessels near the origin envelope and classify each gap as **normal / uncertain / suspicious** using documented criteria (never an automatic accusation).
- FR-V2: The system shall provide a SAR-based vessel target extraction capability (P0/P1 per `tech_stack.md`) and compare detected SAR targets against known AIS positions to flag potential AIS-silent ("dark") vessels.
- FR-V3: Any dark-vessel signal shall be presented as a supporting signal within the attribution breakdown, not as a standalone accusation.

### 11.6 Prove / Evidence Requirements

- FR-E1: The system shall generate a PDF evidence dossier per incident containing: incident metadata, SAR scene reference, slick geometry and confidence, environmental context, drift simulation summary and parameters, origin envelope, candidate vessel list with attribution scores, AIS/SAR dark-vessel evidence where applicable, supporting maps, and processing/version metadata.
- FR-E2: The system shall compute a SHA-256 hash for the dossier and its key underlying artifacts and store the hash alongside the artifact for later integrity verification.
- FR-E3: The dossier and its accompanying UI/API surfaces shall explicitly state that hashing establishes **integrity**, not **legal admissibility**.

### 11.7 GIS Requirements

- FR-G1: All geometry shall be stored and exposed as GeoJSON-compatible structures with an explicit, documented CRS (see `schema.md` §CRS).
- FR-G2: All area, distance, and perimeter calculations shall use geodesic methods appropriate to the stored CRS; the system shall never assume a constant degree-to-distance conversion.
- FR-G3: The system shall maintain spatial indexes on all frequently queried geometry columns (slick polygons, origin envelopes, AIS positions).

### 11.8 AI/ML Requirements

- FR-M1: Every inference result shall be traceable to a model version identifier.
- FR-M2: The system shall never fabricate or hardcode a confidence value that does not originate from the model/validation pipeline.
- FR-M3: The segmentation pipeline shall define input, processing (normalization/tiling), and output (mask, polygon, confidence) stages explicitly, per `AppFlow.md`.

### 11.9 AIS Requirements

- FR-I1: The system shall validate, deduplicate, and timestamp-normalize (to UTC) raw AIS records before use.
- FR-I2: The system shall construct per-vessel trajectories from validated AIS positions with spatial and temporal indexing suitable for large datasets (no unindexed table scans).
- FR-I3: The system shall support both a cached/historical AIS dataset (Demo Mode) and a live/lawful AIS source (Live/Research Mode), per PRD §17–18.

### 11.10 Drift Modeling Requirements

(See 11.3 Trace Back Requirements — this is the same pipeline stage; cross-referenced per PRD §49 template.)

### 11.11 Evidence Requirements

(See 11.6 Prove / Evidence Requirements — cross-referenced per PRD §49 template.)

### 11.12 Notification Requirements

- FR-N1: The system shall support a job-status notification mechanism (in-app, minimum P0) so a user can see when long-running processing (SAR ingestion, drift simulation, dossier generation) completes.
- FR-N2 (P2/P3, optional enhancement): The system may support external notification (e.g., email via SendGrid) for incident status changes — classified as non-MVP unless time permits; see `tech_stack.md`.

---

## 12. Non-Functional Requirements

### 12.1 Security Requirements
- NFR-S1: No credentials or API keys shall be present in source code; all secrets shall be supplied via environment configuration (see `rules.md`).
- NFR-S2: All file uploads (e.g., SAR scene ingestion) shall be validated before processing.
- NFR-S3: API endpoints shall implement CORS policy and basic rate limiting appropriate for a hackathon deployment.
- NFR-S4: Evidence artifacts (dossiers, hashes) shall have access control appropriate to their sensitivity.

### 12.2 Performance Requirements
- NFR-P1: Heavy processing (SAR preprocessing, ML inference, drift simulation, large AIS analysis, PDF generation) shall run as asynchronous jobs and shall not block API request/response cycles.
- NFR-P2: The demo scenario (PRD §17) shall complete end-to-end within a time budget compatible with a 3–5 minute judged demonstration, using precomputed/cached artifacts where live computation would exceed that budget.
- NFR-P3: Map rendering of AIS trajectories shall use a rendering strategy appropriate to trajectory volume (see `design.md`/`tech_stack.md` for the specific approach selected).

### 12.3 Reliability Requirements
- NFR-R1: The system shall provide a Demo Mode that functions fully without any live external API connectivity (PRD §17).
- NFR-R2: Every external data dependency shall have a documented fallback (PRD §18/`AppFlow.md` §Error Handling).
- NFR-R3: The system shall never silently substitute cached data for live data without indicating this in the UI/API response.

---

## 13. Acceptance Criteria (MVP-level, representative)

- AC1: Given a curated demo SAR scene, the system detects a slick polygon with a displayed confidence score and environmental-compatibility adjustment.
- AC2: Given the detected slick, the system produces a Monte Carlo origin probability envelope with visible high/medium/low probability bands and documented simulation parameters.
- AC3: Given the origin envelope and a cached AIS dataset, the system returns at least one ranked candidate vessel with a visible per-factor score breakdown.
- AC4: Given a completed incident, the system generates a PDF dossier with a computed SHA-256 hash displayed in the UI/API.
- AC5: The entire AC1→AC4 chain completes using Demo Mode without any live internet dependency.
- AC6: No UI, API response, or generated document uses any of the prohibited phrasings listed in PRD §12 language rules / `rules.md`.

---

## 14. MVP Scope

The MVP must demonstrate the complete Detect → Trace Back → Attribute → Prove pipeline on **reliable/cached data**:

1. Load a curated SAR scene.
2. Detect the oil slick and compute geometry + confidence.
3. Apply look-alike/environmental validation to produce final confidence.
4. Run the backward drift model against cached environmental forcing.
5. Generate the Monte Carlo origin probability envelope.
6. Query a cached/local AIS dataset for the relevant window.
7. Identify and rank candidate vessels with explainable scoring.
8. Surface AIS-gap classification and, where feasible, SAR-vessel-vs-AIS comparison.
9. Present all of the above on the map-first tactical dashboard.
10. Generate the PDF evidence dossier with SHA-256 hash.

Full technology classification (P0/P1/P2/P3) is defined in `tech_stack.md`; the phased build order is defined in `implementationPlan.md`.

---

## 15. Future Scope (Production, out of SIH MVP)

- Continuous/automated satellite ingestion pipelines.
- Larger-scale AIS ingestion and streaming processing.
- Cloud-native object storage and Kubernetes-based deployment.
- Distributed model serving and horizontal scaling of inference.
- Real-time alerting to response authorities.
- Advanced SAR-based vessel detection models beyond the MVP baseline.
- Large-scale historical analytics across incidents and regions.
- Formal integration pathways with NTRO / Indian Coast Guard / DG Shipping / Port Authorities (adoption pathway, not current customer relationship).
- SaaS-style multi-tenant deployment for ports/fleets; forensic-audit and insurance-analytics service models.

---

## 16. Risks, Assumptions, Constraints

**Risks** (full register in `implementationPlan.md`/`Tracker.md`):
- SAR look-alikes causing false positives.
- Limited/imbalanced labeled training data for segmentation.
- External API unavailability or rate limits during build/demo.
- AIS coverage gaps unrelated to the incident under study.
- Drift model uncertainty compounding over longer backward simulation windows.
- Attribution false positives/negatives from incomplete AIS coverage.

**Assumptions:**
- Demo Mode uses a small number of curated, pre-validated scenarios rather than arbitrary live incidents.
- Open/public datasets (Copernicus, ISRO Bhoonidhi, MarineCadastre, Global Fishing Watch, INCOIS, ERA5/CMEMS) are accessible for research/hackathon use under their respective terms; this must be verified per resource (see `tech_stack.md` §Research Verification).
- The Kaggle Sentinel-1 oil-spill dataset is usable for model development/evaluation but does not by itself validate performance on real Indian coastal waters without further validation.

**Constraints:**
- SIH build timeline (weeks, not months).
- Small student team; must prioritize a working P0 pipeline over broad P2/P3 infrastructure (see `implementationPlan.md` §Hackathon Priority System).
- Judged demo environment may have unreliable internet connectivity.

---

## 17. Demo Scenario

One controlled, reproducible demonstration scenario, matching `AppFlow.md`:

```
Input SAR Scene
  → Detected Slick
  → Slick Polygon
  → Environmental Conditions
  → Backward Drift
  → Origin Envelope
  → AIS Correlation
  → Candidate Vessel
  → Attribution Score
  → Evidence Package
```

Judging narrative (target 3–5 minutes): **Detection → Scientific tracing → Vessel attribution → Evidence.** The demo must run entirely in Demo Mode (cached SAR scene, cached environmental data, prepared AIS data, preloaded model artifacts) so it is immune to live external service failures, while visually and functionally behaving identically to Live/Research Mode (see PRD §18, `AppFlow.md` §Demo Mode / Live Mode).

---

## 18. Success Metrics

| Metric | Target for SIH |
|---|---|
| End-to-end demo completion | Full DETECT→TRACE BACK→ATTRIBUTE→PROVE chain runs without manual intervention in Demo Mode |
| Explainability coverage | 100% of confidence/score outputs shown to the user have a visible factor breakdown |
| Language honesty compliance | 0 instances of prohibited phrasing (PRD §12) across UI/API/docs at final review |
| Demo reliability | 0 dependency on live external connectivity during judged demo |
| Evidence integrity | 100% of generated dossiers carry a verifiable SHA-256 hash and provenance record |

---

## Reference Map (avoid duplicating detail across documents)

- Exact technology choices, P0–P3 classification, alternatives → `tech_stack.md`
- Full system/user flow, Mermaid diagrams, error handling, Demo vs Live mode mechanics → `AppFlow.md`
- UI/UX specification, screens, components, design tokens → `design.md`
- Entity/table definitions, ER diagram, indexes, CRS details → `schema.md`
- Phased build plan, tasks, dependencies, definition of done → `implementationPlan.md`
- Live status, blockers, decisions, technical debt → `Tracker.md`
- Coding-agent operating rules (git policy, dependency policy, language rules) → `rules.md`

# Spill Sense — UI/UX Design Specification

**Project:** Spill Sense · **Team:** BUG STALKERS · **SIH26143**
**Companion documents:** `prd.md`, `tech_stack.md`, `AppFlow.md`, `schema.md`, `implementationPlan.md`, `Tracker.md`, `rules.md`

---

## 1. Design Philosophy

Spill Sense's interface must feel like a **Maritime Intelligence / Incident Command Center**, not a generic SaaS analytics dashboard. Every screen exists to help an investigator make a decision faster, with visible reasoning behind every number.

Core principles:
- **Map-first.** The tactical map is the anchor of the product; other panels orbit around it.
- **Explainable, never mysterious.** No score, confidence value, or ranking appears without a way to see why.
- **Honest about uncertainty.** Probability envelopes, confidence bands, and candidate rankings are visually distinct from confirmed facts (PRD §12, §31).
- **High information density, low decoration.** Avoid gradients, unnecessary animation, or "impressive" visuals that do not aid investigation (PRD §29).
- **Operational, not playful.** Dark theme by default; calm, authoritative color use reserved for real severity signaling.

---

## 2. Visual Hierarchy

1. **Primary:** The tactical map and the currently selected incident's core finding (slick, envelope, top candidate).
2. **Secondary:** Score breakdowns, timelines, and processing status — supporting detail one click away from the primary view.
3. **Tertiary:** Analytics, historical trends, settings — accessed via dedicated screens, never competing for space with an active investigation.

---

## 3. Typography

| Role | Typeface guidance | Notes |
|---|---|---|
| Headings / incident IDs / scores | A geometric sans-serif (e.g., Inter, IBM Plex Sans) at medium/semibold weight | High legibility at small sizes for dense data panels |
| Body / labels | Same family, regular weight | Consistency over variety |
| Monospaced data (coordinates, hashes, MMSI, timestamps) | A monospace family (e.g., JetBrains Mono, IBM Plex Mono) | Distinguishes raw/precise machine values from narrative text — critical for hash verification and coordinate display |

Scale: a restrained type scale (e.g., 12/14/16/20/28px) is sufficient; avoid large display type outside the dashboard's top-level incident counts.

---

## 4. Spacing

- Base unit: 4px grid.
- Panel padding: 16px standard, 12px for dense data tables.
- Map overlays use floating panels with a consistent 16px inset from map edges, semi-opaque backgrounds so map content remains visible beneath.

---

## 5. Color Semantics

Dark operational theme is the default and only theme for the SIH MVP (a light theme is explicitly P3/future).

| Purpose | Color intent | Usage rule |
|---|---|---|
| Base background | Near-black / deep slate | Reduces eye strain during extended investigation sessions, maximizes map contrast |
| Panel surfaces | Dark gray, subtly lighter than base | Establishes layering without heavy borders |
| Primary accent | A single confident blue/cyan | Interactive elements, active selections, links |
| Severity — high confidence / high probability | Warm red-orange | Reserved strictly for genuinely high-severity/high-probability signals — never decorative |
| Severity — medium | Amber/yellow | Medium-probability bands, "uncertain" AIS gap classification |
| Severity — low / normal | Muted green or neutral gray | Low-probability bands, "normal" AIS gap classification |
| Candidate ranking | Sequential intensity of the primary accent (rank 1 strongest) | Never uses color alone — rank number always shown |
| Confidence / probability | A continuous, colorblind-safe scale (e.g., a single-hue sequential ramp) | Never a simple "traffic light" implying certainty where none exists |

**Rule:** color intensity communicates *probability/confidence*, never *guilt*. A candidate vessel's card is never colored to suggest determination of responsibility.

---

## 6. Dark Mode

Dark mode is the sole theme for MVP — described fully in §5. Ensuring sufficient contrast (WCAG AA minimum) between text and panel surfaces is required even though this is a specialist operational tool, since extended review sessions increase fatigue risk.

---

## 7. Responsive Behavior

- **Primary target: desktop/large-tablet landscape** — this is an investigator workstation tool, not a mobile-first product.
- Below a defined breakpoint (e.g., <1024px), the map remains primary and side panels collapse into a tabbed drawer rather than disappearing.
- No dedicated phone-portrait layout is required for MVP (documented as P3/future if operational need arises).

---

## 8. Accessibility

- Minimum WCAG AA contrast for all text against its background.
- Color is never the sole signal for severity/confidence/rank — always paired with a label, icon, or numeric value.
- All interactive map controls (layer toggles, timeline scrubber) are keyboard-operable.
- Loading and error states use both visual and textual indicators (not spinner-only).

---

## 9. Core Screens

### 9.1 Command Dashboard
Purpose: situational overview across all incidents.
- Active incident list/grid with severity indicator, status, and detection time.
- Quick statistics (active incidents, incidents this week, average time-to-attribution).
- Entry point into any incident's Investigation View.

### 9.2 Incident Investigation View
Purpose: primary workspace for a single incident.
- Large tactical map (dominant screen real estate).
- Incident metadata panel (ID, scene reference, acquisition time, status).
- Slick detail panel (geometry summary, confidence breakdown).
- Processing status / job progress indicator.
- Investigation timeline (chronological record of processing stages completed).

### 9.3 Drift Analysis
Purpose: inspect the Trace Back stage in detail.
- Backward trajectory visualization (particle paths or aggregated density).
- Origin probability envelope with high/medium/low band legend.
- Environmental inputs panel (current/wind sources used, with live vs cached indicator).
- Simulation controls (view-only for MVP: duration, particle count, forcing datasets used).
- Confidence/uncertainty summary.

### 9.4 Vessel Attribution
Purpose: inspect the Attribute stage in detail.
- Ranked candidate vessel table/list.
- Per-vessel score breakdown (spatial, temporal, trajectory, behavior, AIS continuity — matching `AppFlow.md` §13).
- Vessel trajectory overlay on the map.
- AIS coverage indicator and any flagged suspicious gaps.
- Dark-vessel/behavioral indicator badges (clearly labeled as signals, not conclusions).

### 9.5 Evidence Center
Purpose: manage the Prove stage.
- List of evidence artifacts for the incident (dossier, supporting maps, raw data references).
- Provenance detail (data sources, versions, timestamps) per artifact.
- Generated report preview + download.
- SHA-256 hash display with a "verify integrity" affordance and an explicit note distinguishing integrity from legal admissibility.

### 9.6 Analytics
Purpose: cross-incident trends (secondary/tertiary priority).
- Incident statistics over time.
- Vessel statistics (most frequently flagged candidates, if recurring).
- Environmental summary trends.
- Model performance summary (aggregate confidence distributions, not per-incident detail).

---

## 10. Alerts, Loading, Errors, Empty States

- **Alerts:** appear as a non-blocking notification region tied to job-status changes (new detection, processing complete, processing failed). Never modal-interrupts an active investigation.
- **Loading states:** every async panel (map layer, score table, dossier generation) shows a labeled loading indicator naming the operation ("Running drift simulation…", not a bare spinner).
- **Errors:** every error state names what failed and, where applicable, whether a cached fallback was used instead (per `AppFlow.md` §17).
- **Empty states:** the Command Dashboard's "no active incidents," the Evidence Center's "no dossier generated yet," etc., each include a clear next action (e.g., "Create Incident").

---

## 11. Major Reusable Components

| Component | Purpose |
|---|---|
| `IncidentCard` | Compact summary of one incident for dashboard grid/list |
| `IncidentHeader` | Incident ID, status, severity, timestamp — used atop the Investigation View |
| `TacticalMap` | Core Mapbox GL (or MapLibre) map wrapper with the project's layer system |
| `MapLayerControl` | Toggle visibility of slick polygon, origin envelope, drift particles, AIS tracks, SAR vessels |
| `SpillPolygon` | Renders the detected slick geometry with a confidence-linked style |
| `OriginProbabilityLayer` | Renders the Monte Carlo origin envelope with high/medium/low bands |
| `DriftTrajectoryLayer` | Renders backward particle trajectories |
| `VesselTrack` | Renders a single vessel's AIS trajectory |
| `VesselCandidateTable` | Ranked candidate list with overall score and rank |
| `AttributionBreakdown` | Per-factor score visualization for a selected candidate |
| `ConfidencePanel` | Displays segmentation/environmental/final confidence values with explanation |
| `InvestigationTimeline` | Chronological record of pipeline stages for the incident |
| `EvidencePanel` | Lists artifacts, provenance, and hash-verification affordance |
| `ProcessingStatus` | Compact status chip (queued/running/completed/failed) |
| `JobProgress` | Progress bar/percentage tied to an async job |

Each component receives its data pre-shaped from the corresponding API endpoint (`schema.md`/API contracts) — no component independently re-derives scores or geometry client-side; this keeps explainability consistent between the UI, API, and PDF dossier (PRD §31, §67).

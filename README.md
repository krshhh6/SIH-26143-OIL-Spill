# 🛢️ Spill Sense — Maritime Intelligence C2 Platform

<div align="center">

**AI-Powered Oil Spill Detection • Backward Lagrangian Drift Reconstruction • AIS Vessel Attribution • Cryptographic Forensic Evidence**

**Smart India Hackathon 2026** &nbsp;|&nbsp; **Problem Statement:** SIH26143 &nbsp;|&nbsp; **Theme:** Disaster Management / Maritime Domain Awareness
**Team:** BUG STALKERS

[Live Demo](https://sih-26143-oil-spill.vercel.app) • [Problem Statement](#1-problem-statement) • [How It Works](#3-how-it-works--the-4-stage-pipeline) • [Quick Start](#7-quick-start)

</div>

---

## 📌 Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Our Solution — In One Line](#2-our-solution--in-one-line)
3. [How It Works — The 4-Stage Pipeline](#3-how-it-works--the-4-stage-pipeline)
4. [Tactical C2 Dashboard — Features](#4-tactical-c2-dashboard--features)
5. [Tech Stack](#5-tech-stack)
6. [System Architecture](#6-system-architecture)
7. [Quick Start](#7-quick-start)
8. [Repository Structure](#8-repository-structure)
9. [Regulatory & Legal Alignment](#9-regulatory--legal-alignment)
10. [Impact & Use Case](#10-impact--use-case)
11. [Honest Limitations](#11-honest-limitations)
12. [Roadmap](#12-roadmap)
13. [Team](#13-team)
14. [FAQ — Anticipated Judge Questions](#14-faq--anticipated-judge-questions)
15. [License](#15-license)

---

## 1. Problem Statement

Maritime oil spills pose catastrophic threats to marine ecology and coastal economies. When a slick is detected in Indian waters, authorities face **four critical operational bottlenecks**:

| # | Bottleneck | Why it matters |
|---|---|---|
| 1 | **Satellite Look-Alike False Alarms** | Manual SAR interpretation cannot reliably distinguish real mineral oil slicks from calm-wind zones, biogenic algal blooms, or internal waves — wasting response time on false positives. |
| 2 | **The "Static Location" Fallacy** | Ocean currents and wind constantly transport surface films. **The point of satellite detection is never the point of discharge** — so responders are often looking in the wrong place. |
| 3 | **The "Dark Vessel" Evasion** | Offending vessels intentionally disable their AIS transponders during illegal bilge dumping or tank washing, making them invisible to standard tracking. |
| 4 | **Admissibility & Chain of Custody** | There is no immutable, cryptographically verifiable evidence dossier that stands up in maritime courts and regulatory enforcement proceedings. |

**Spill Sense solves all four challenges as a single, end-to-end operational Decision-Support Platform.**

---

## 2. Our Solution — In One Line

> Point a satellite at the ocean → Spill Sense tells you **what it is, where it really came from, who probably did it, and hands you court-ready proof** — all inside one tactical command dashboard.

---

## 3. How It Works — The 4-Stage Pipeline

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   1. DETECT     │  ───> │  2. TRACE BACK  │  ───> │  3. ATTRIBUTE   │  ───> │    4. PROVE     │
│  Sentinel-1 SAR │       │  OpenDrift RK4  │       │ Spatiotemporal  │       │ SHA-256 Dossier │
│  U-Net Masking  │       │  Lagrangian MC  │       │ AIS Correlation │       │ Court Evidence  │
└─────────────────┘       └─────────────────┘       └─────────────────┘       └─────────────────┘
```

### 🔍 Stage 1 — DETECT
- Ingests **Copernicus Sentinel-1 IW GRD** radar scenes (works through cloud cover and at night, unlike optical satellites).
- Applies radiometric calibration and **Lee 5×5 speckle filtering** to clean radar noise.
- Runs a **U-Net (ResNet-50 backbone)** deep learning segmentation model to mask suspected oil slicks pixel-by-pixel.
- Cross-validates against **ERA5 wind speed** (3–12 m/s exclusion band) and **MODIS Chlorophyll-a** data to rule out biogenic look-alikes (algal blooms, calm-water patches).

### 🌊 Stage 2 — TRACE BACK
- Runs **backward Lagrangian trajectory modeling** using OpenDrift/OpenOil with **4th-order Runge-Kutta integration** (1,000 simulated particles, 72-hour reverse window).
- Driven by **CMEMS ocean current vectors** and **ERA5 windage** (3.5% Stokes drift factor).
- Outputs standard **GeoJSON polygons** representing **50%, 75%, and 90% origin-probability envelopes** — i.e., "there's a 90% chance the spill originated somewhere inside this zone."

### 🚢 Stage 3 — ATTRIBUTE
- Queries historical **AIS vessel tracks** within the spatiotemporal search window defined by Stage 2.
- Scores every candidate vessel with a multi-factor attribution formula:

  **S = w_dist·S_dist + w_time·S_time + w_gap·S_gap + w_type·S_type**

  (distance from origin zone, timing alignment, AIS transponder gaps, and vessel-type relevance are each weighted and combined into one explainable score.)
- Includes an **AIS Gap Diagnostic** that flags deliberate transponder blackouts and suspicious speed drops inside the probability envelope — the classic signature of intentional dumping.

### 📁 Stage 4 — PROVE
- Automatically compiles a **tamper-evident, SHA-256-hashed forensic evidence dossier**.
- Formatted for direct compliance with **Section 356 of the Indian Merchant Shipping Act, 1958** and **MARPOL 73/78 Annex I** — built to be usable by real enforcement agencies, not just a tech demo.

---

## 4. Tactical C2 Dashboard — Features

| Feature | What it lets an investigator do |
|---|---|
| 🗺️ **ECDIS & OpenSeaMap Nautical Engine** | Full nautical chart with OpenSeaMap seamarks (buoys, TSS shipping channels, lighthouses, harbor approaches), MSN aerial satellite imagery, and ECDIS Day/Night hydrographic modes. |
| ⏱️ **4D Spatiotemporal Time Scrubber** | Drag a persistent `T − 72h → T₀` timeline to animate particle back-dispersion and vessel movement together, pinpointing the exact interception moment. |
| 🛰️ **Dual-Pane SAR Split Inspector** | Interactive before/after split slider comparing raw calibrated radar backscatter (σ₀ in dB) against the AI segmentation mask and wind-exclusion zones. |
| 🧠 **D-Elicio 5-Class Segmentation** | High-precision pixel-wise classification that isolates 5 morphological slick classes (Core, Tail, Lookalike, Emulsion, Clean) directly inside the browser using ONNX WebAssembly. |
| 📊 **Live Spill Analytics Engine** | Instantly calculates real-world environmental impact metrics including physical slick area (ha), **MARPOL 73/78 Annex I** classification, and estimated **Bonn Agreement Discharged Volume**. |
| 🎛️ **Explainable What-If Sensitivity Tuner** | Live sliders to adjust attribution weights and watch the suspect-vessel ranking re-rank in real time — full transparency, no black-box scoring. |
| 📑 **Forensic PDF Generator & SHA-256 Verifier** | One-click export of a courtroom-ready evidence dossier, plus an interactive modal to verify the file's cryptographic integrity hasn't been tampered with. |

---

## 5. Tech Stack

| Layer | Technology |
|---|---|
| Satellite Data | Copernicus Sentinel-1 (SAR, IW GRD) |
| Detection Model | U-Net with ResNet-50 backbone (deep learning segmentation) |
| Ocean/Weather Data | CMEMS (currents), ERA5 (wind), MODIS (Chlorophyll-a) |
| Drift Simulation | OpenDrift / OpenOil, Runge-Kutta 4th-order particle integration |
| Vessel Tracking | AIS (Automatic Identification System) historical track data |
| Database | PostgreSQL + PostGIS (geospatial querying) |
| Backend | Python (FastAPI-style REST + WebSocket services) |
| Frontend | React-based real-time map UI, standalone HTML dashboard |
| Evidence Integrity | SHA-256 cryptographic hashing |
| Deployment | Vercel |

*(See `tech_stack.md` in this repo for the full verified data-source list and priority tiers P0–P3.)*

---

## 6. System Architecture

```
Satellite (Sentinel-1) ──▶ DETECT (U-Net) ──▶ TRACE BACK (OpenDrift) ──▶ ATTRIBUTE (AIS Scoring) ──▶ PROVE (SHA-256 Dossier)
                                    │                    │                        │
                                    ▼                    ▼                        ▼
                             PostgreSQL/PostGIS  ◀──────────────────────────  Tactical C2 Dashboard
                                                                              (React + WebSockets)
```

Full user/system flow diagrams (Mermaid) are documented in [`AppFlow.md`](./AppFlow.md).

---

## 7. Quick Start

Run the dashboard locally with zero external dependencies:

```bash
# Clone the repository
git clone https://github.com/krshhh6/SIH-26143-OIL-Spill.git
cd SIH-26143-OIL-Spill

# Start a local HTTP server
python -m http.server 8080

# Open in your browser
# Navigate to: http://localhost:8080
```

For the full-stack experience with live backend simulation, see setup instructions inside [`/backend`](./backend) and [`/frontend`](./frontend).

---

## 8. Repository Structure

```
.
├── index.html                  # Tactical C2 Maritime Dashboard (Web Entry Point)
├── spill_sense_dashboard.html  # Full Standalone Operational Dashboard
├── backend/                    # Pipeline services — DETECT / TRACE BACK / ATTRIBUTE / PROVE
├── frontend/                   # React-based real-time dashboard source
├── ml/                         # U-Net SAR segmentation model & training code
├── pipeline/                   # Orchestration chaining all 4 stages
├── infra/                      # Deployment & infrastructure configuration
├── fonts/                      # Google Material Symbols Variable Fonts
├── prd.md                      # Product Requirements Document (Goals G1–G7, Acceptance Criteria)
├── tech_stack.md               # Technology Stack & Verified Data Sources (P0–P3)
├── AppFlow.md                  # System & User Flow with Mermaid Diagrams
├── design.md                   # ECDIS UI/UX Design System Tokens & Specs
├── schema.md                   # Complete PostgreSQL/PostGIS Database Architecture
├── implementationPlan.md       # 16-Phase Engineering Execution Plan
├── Tracker.md                  # Risk Register & Living Decisions Log
├── rules.md                    # Core Operational Rules & Honest Disclaimers
└── security.md                 # Security, Cryptography & Access Control Policy
```

---

## 9. Regulatory & Legal Alignment

Spill Sense's evidence output is deliberately structured around real-world legal standards, not just technical metrics:

- **MARPOL 73/78 (Annex I)** — Regulations for the Prevention of Pollution by Oil.
- **Merchant Shipping Act, 1958 (Part XIA)** — Prevention and Containment of Pollution of the Sea by Oil.
- **UNCLOS (Part XII)** — Protection and Preservation of the Marine Environment (Articles 211, 220).
- **WGS 84 (EPSG:4326)** — Universal spatial reference system used across all geospatial layers.

---

## 10. Impact & Use Case

- **Who uses it:** Coast Guard / maritime enforcement / pollution-control boards during a spill response.
- **What it replaces:** Manual SAR interpretation, guesswork on spill origin, and unstructured AIS lookups.
- **What it adds:** A single pane of glass that takes a satellite alert from "there's something dark on the water" to "here is our top suspect vessel, here's the math behind that conclusion, and here's a tamper-proof file for the enforcement case."

---

## 11. Honest Limitations

In the spirit of transparent, defensible engineering (see `rules.md`):

- Attribution scores are **probabilistic, explainable evidence to guide investigation — not a legal verdict**. Human review is required before any enforcement action.
- Drift reconstruction accuracy depends on the quality/resolution of available current and wind data for the region and time window.
- AIS attribution can only consider vessels that broadcast (or previously broadcast) AIS data; fully covert vessels with no historical footprint may not be attributable by this method alone.

---

## 12. Roadmap

- [ ] Live Sentinel-1 / CMEMS / AIS feed integration (replacing demo/synthetic data)
- [ ] Multi-region concurrent monitoring
- [ ] Mobile-responsive field-operations view
- [ ] Model retraining pipeline with expanded labeled SAR dataset
- [ ] Integration with national maritime enforcement systems

---

## 13. Team

**Team BUG STALKERS** — Smart India Hackathon 2026, Problem Statement SIH26143

| Name | Role |
|---|---|
| _Add name_ | _Add role_ |
| _Add name_ | _Add role_ |
| _Add name_ | _Add role_ |
| _Add name_ | _Add role_ |
| _Add name_ | _Add role_ |
| _Add name_ | _Add role_ |

---

## 14. FAQ — Anticipated Judge Questions

**Q: Why not just use the satellite detection point as the spill location?**
A: Ocean currents and wind move the slick continuously after discharge — by the time it's detected, it may be tens of kilometers from the actual leak site. That's exactly why Stage 2 exists.

**Q: How is this different from a simple AIS proximity search?**
A: A simple proximity search ignores drift physics entirely and misses vessels that deliberately went dark. Our multi-factor score explicitly weighs AIS gaps as a red flag rather than ignoring missing data.

**Q: Is the attribution score a "black box"?**
A: No — the What-If Sensitivity Tuner exposes every weight in the scoring formula and lets an investigator re-rank suspects live, making the reasoning fully explainable.

**Q: Can this evidence be used in an actual court case?**
A: The dossier is SHA-256 hashed for tamper-evidence and formatted against real regulatory statutes (Merchant Shipping Act, MARPOL), but final legal admissibility depends on jurisdictional procedure — this platform is designed to support, not replace, human investigators and legal process.

**Q: What happens if the SAR detection is a false positive (e.g., algae)?**
A: Stage 1 cross-checks wind speed and Chlorophyll-a levels specifically to filter out these look-alikes before the pipeline proceeds.

---

## 15. License

This project was built for Smart India Hackathon 2026 (Problem Statement SIH26143) by Team BUG STALKERS.

---

<div align="center">

*Built with operational discipline by Team BUG STALKERS for Smart India Hackathon 2026.*

</div>

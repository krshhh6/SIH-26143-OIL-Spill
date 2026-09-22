# Spill Sense — Maritime Intelligence C2 Platform

> **AI-Powered Oil Spill Detection, Backward Lagrangian Drift Reconstruction, AIS Attribution & Cryptographic Forensic Evidence**
> 
> **Event:** Smart India Hackathon 2026 | **Problem Statement:** SIH26143  
> **Theme:** Disaster Management / Maritime Domain Awareness | **Team:** BUG STALKERS

---

## 1. Problem Statement (SIH26143)

Maritime oil spills pose catastrophic threats to marine ecology and coastal economies. When a slick is detected in Indian waters, authorities face four critical operational bottlenecks:
1. **Satellite Look-Alike False Alarms:** Manual SAR interpretation cannot reliably distinguish mineral oil slicks from low-wind calm zones, biogenic algal blooms, or internal waves.
2. **The "Static Location" Fallacy:** Because ocean currents and wind constantly transport surface films, **the point of satellite detection is NEVER the point of discharge**.
3. **The "Dark Vessel" Evasion:** Offending vessels intentionally disable their AIS transponders during illegal bilge dumping or tank washing.
4. **Admissibility & Chain of Custody:** Lack of an immutable, cryptographically verifiable evidence dossier that stands up in maritime courts and regulatory enforcement.

Spill Sense solves all four challenges as an end-to-end operational Decision-Support Platform.

---

## 2. Core 4-Stage Architectural Pipeline

```
  ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
  │   1. DETECT     │  ───> │  2. TRACE BACK  │  ───> │  3. ATTRIBUTE   │  ───> │    4. PROVE     │
  │  Sentinel-1 SAR │       │  OpenDrift RK4  │       │ Spatiotemporal  │       │ SHA-256 Dossier │
  │  U-Net Masking  │       │  Lagrangian MC  │       │ AIS Correlation │       │ Court Evidence  │
  └─────────────────┘       └─────────────────┘       └─────────────────┘       └─────────────────┘
```

1. **DETECT:** Ingests Copernicus Sentinel-1 IW GRD radar scenes. Applies radiometric calibration and Lee 5x5 speckle filtering. Runs U-Net (ResNet-50 backbone) segmentation. Evaluates ERA5 10m wind speeds ($3 \le U_{10} \le 12\text{ m/s}$) and MODIS Chlorophyll-a to exclude biogenic look-alikes.
2. **TRACE BACK:** Runs backward Lagrangian trajectory modeling via OpenDrift/OpenOil with Runge-Kutta 4th-order integration ($N=1,000$ particles, 72h window). Driven by CMEMS ocean current vectors and ERA5 windage ($3.5\%$ Stokes drift). Generates **50%, 75%, and 90% origin probability envelopes** as standard GeoJSON polygons.
3. **ATTRIBUTE:** Queries historical AIS vessel tracks within the spatiotemporal search window. Implements a multi-factor attribution scoring formula:
   $$\mathcal{S} = w_{\text{dist}} S_{\text{dist}} + w_{\text{time}} S_{\text{time}} + w_{\text{gap}} S_{\text{gap}} + w_{\text{type}} S_{\text{type}}$$
   Features an **AIS Gap Diagnostic** to flag deliberate transponder blackouts and speed drops within the probability envelope.
4. **PROVE:** Automatically compiles a tamper-evident, SHA-256-hashed forensic evidence dossier. Formatted for compliance with **Section 356 of the Indian Merchant Shipping Act 1958** and **MARPOL 73/78 Annex I**.

---

## 3. Tactical C2 Dashboard Features

- **ECDIS & OpenSeaMap Nautical Engine:** Fully integrated with OpenSeaMap nautical seamarks (buoys, TSS shipping channels, lighthouses, harbor approaches), MSN Aerial satellite imagery, and ECDIS Hydrographic Day/Night modes.
- **4D Spatiotemporal Time Scrubber:** Persistent $T - 72\text{h} \to T_0$ timeline playback animating particle back-dispersion and vessel movements to pinpoint the exact interception moment ($T \approx -22\text{h}$).
- **Dual-Pane SAR Split Inspector:** Interactive before/after split slider comparing calibrated raw radar backscatter ($\sigma_0$ in dB) against the AI segmentation mask and wind exclusion zones.
- **Explainable What-If Sensitivity Tuner:** Live parameter sliders enabling maritime investigators to adjust attribution weights and re-rank candidate vessels in real time.
- **Forensic PDF Generator & SHA-256 Verifier:** Interactive modal to verify cryptographic integrity and export official courtroom evidence dossiers.

---

## 4. Repository Structure & Specification Documents

```
.
├── index.html                  # Tactical C2 Maritime Dashboard (Web Entry Point)
├── spill_sense_dashboard.html  # Full Standalone Operational Dashboard
├── fonts/                      # Google Material Symbols Variable Fonts
├── prd.md                      # Product Requirements Document (Goals G1-G7, Acceptance Criteria)
├── tech_stack.md               # Technology Stack & Verified Data Sources (P0-P3)
├── AppFlow.md                  # System & User Flow with Mermaid Diagrams
├── design.md                   # ECDIS UI/UX Design System Tokens & Specs
├── schema.md                   # Complete PostgreSQL/PostGIS Database Architecture
├── implementationPlan.md       # 16-Phase Engineering Execution Plan
├── Tracker.md                  # Risk Register & Living Decisions Log
├── rules.md                    # Core Operational Rules & Honest Disclaimers
└── security.md                 # Security, Cryptography & Access Control Policy
```

---

## 5. Quick Start — Running the Dashboard Locally

You can run the dashboard immediately with any local web server (no external dependencies required):

```bash
# Clone the repository
git clone https://github.com/krshhh6/SIH-26143-OIL-Spill.git
cd SIH-26143-OIL-Spill

# Start Python local HTTP server
python -m http.server 8080

# Open in your browser
# Navigate to: http://localhost:8080
```

---

## 6. Regulatory & Legal Standards

- **MARPOL 73/78 (Annex I):** Regulations for the Prevention of Pollution by Oil.
- **Merchant Shipping Act, 1958 (Part XIA):** Prevention and Containment of Pollution of the Sea by Oil.
- **UNCLOS (Part XII):** Protection and Preservation of the Marine Environment (Article 211, 220).
- **WGS 84 (EPSG:4326):** Universal spatial reference coordinate system across all geospatial data layers.

---
*Built with operational discipline by Team BUG STALKERS for Smart India Hackathon 2026.*

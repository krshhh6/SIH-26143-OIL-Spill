# Spill Sense — Agent Operating Rules

**Project:** Spill Sense · **Team:** BUG STALKERS · **SIH26143**
**Companion documents:** `prd.md`, `tech_stack.md`, `AppFlow.md`, `design.md`, `schema.md`, `implementationPlan.md`, `Tracker.md`

This document is the **strict operating manual** for any coding agent (Antigravity/Gemini or otherwise) working on Spill Sense. It is binding. Where any instruction elsewhere seems to conflict with this file, this file governs implementation conduct; `prd.md` governs product scope.

---

## 1. Architecture

- Do not arbitrarily restructure the project. The modular monolith architecture defined in `tech_stack.md` §0 is the standing decision — changing it requires a documented decision record (see §12 below), not a silent refactor.
- Domain module boundaries (`satellite`, `sar_processing`, `oil_detection`, `environmental`, `drift`, `ais`, `attribution`, `dark_vessel`, `evidence`, `notifications`) must be respected — cross-module logic belongs in the application/service layer, not scattered across domain modules.

## 2. Existing Code

- **Never destroy functioning implementation.** Before changing existing code:
  1. Inspect it.
  2. Understand it.
  3. Identify its dependencies.
  4. Determine whether the change is genuinely necessary.
  5. Make the smallest safe modification.
  6. Test.
  7. Document the decision.
- Never delete, overwrite, rename, or replace existing implementation merely because a new implementation looks cleaner.
- Avoid unnecessary refactors. Make small, coherent changes.

## 3. Backend

- Follow FastAPI + Pydantic + SQLAlchemy patterns consistently across all domain modules.
- All request/response contracts are defined as explicit Pydantic models — no ad hoc dict responses for stable endpoints.
- Heavy work (SAR preprocessing, ML inference, drift simulation, large AIS analysis, PDF generation) must run as Celery async jobs, never inline in a request handler (PRD §26).

## 4. Frontend

- Use TypeScript throughout; no untyped `.js` files in new frontend code.
- Build reusable components as specified in `design.md` §11 rather than one-off, screen-specific implementations of the same visual element.
- No component independently recomputes scores, confidence, or geometry — all such values come from the API, keeping the UI, API, and PDF dossier consistent (`design.md` §11 note).

## 5. Database

- Use Alembic migrations for every schema change. No manual, undocumented schema edits.
- Any deviation from `schema.md` must be recorded as a decision (§12) and `schema.md` updated to match — the schema document and the live database must never silently diverge.
- Respect all foreign key and constraint rules in `schema.md` §6, especially `ON DELETE RESTRICT` on evidence-relevant tables.

## 6. GIS

- Always respect CRS. Storage CRS is `SRID 4326`; geodesic calculations use `geography` type or explicit projected transforms — never raw degree-based planar math (`schema.md` §1).
- Never mix coordinate systems casually across modules.
- All geometry output must be valid (no self-intersecting polygons) — validate before persisting.

## 7. AI

- Never fabricate or hardcode a confidence value that does not originate from the model/validation pipeline.
- Every inference result must be traceable to a `model_versions` entry.
- Do not add a model (e.g., SAM 2) merely because it is a recognizable name — classify per the P0–P3 system in `tech_stack.md` and justify.

## 8. Drift

- Never fabricate environmental forcing data. If live current/wind data is unavailable, use the documented cached fallback and mark `data_source_flag = cached` — never silently substitute.
- Every drift run must persist its full parameter set (duration, timestep, particle count, windage coefficient, forcing sources) for reproducibility (`schema.md` §4.6).
- Never output or label a single point as "the exact origin" — the output is always a probability envelope.

## 9. AIS

- Validate timestamps and coordinates on ingest; reject or flag malformed records rather than silently accepting them.
- Normalize all timestamps to UTC at ingestion — never store or compare mixed time zones.
- AIS gap classification (`normal`/`uncertain`/`suspicious`) must use documented, consistent criteria — never an ad hoc per-incident judgment call embedded in code without explanation.

## 10. Security

- Never store secrets in code. All credentials/API keys come from environment configuration.
- Validate all file uploads (type, size) before processing.
- Apply CORS policy and rate limiting to all public-facing endpoints.

## 11. Testing

- New functionality requires appropriate tests before being considered complete (unit, integration, or end-to-end as appropriate to the change — see `implementationPlan.md` Phase 13 categories).
- A phase's Definition of Done in `implementationPlan.md` is not met without its corresponding validation step.

## 12. Decision Records

- Whenever there is an architectural alternative, create a documented decision using this format:

  ```
  Decision: <what was chosen>
  Reason: <why>
  Alternative: <what else was considered>
  Role/Fallback: <if the alternative still has a role, or is a documented fallback>
  ```

- Record new decisions in `Tracker.md` §Decisions and, if it changes technology classification, update `tech_stack.md` directly. Do not invent a decision that contradicts an existing entry without superseding it explicitly (with reasoning) in both places.

## 13. Git

- Use meaningful, scoped commit messages describing what changed and why.
- Avoid sprawling commits that mix unrelated domain modules.

## 14. Dependencies

- No unnecessary libraries. Before adding a dependency:
  - Confirm it solves a concrete requirement.
  - Check maintenance status.
  - Consider license compatibility.
  - Consider whether standard-library or already-approved functionality is sufficient.
- Document major dependencies and their role in `tech_stack.md` — do not introduce a new library without a corresponding entry there.
- Community reference repositories (e.g., OilSpillNet, Multi-Factor-Attribution-Engine, Aresys SCT) are never blindly copied. Verify license, maintenance status, and integration suitability first (`tech_stack.md` §15).

## 15. Documentation

- Architectural changes require documentation updates in the same change set — not a follow-up "later" task.
- All eight project documents (`prd.md`, `tech_stack.md`, `AppFlow.md`, `design.md`, `schema.md`, `implementationPlan.md`, `Tracker.md`, `rules.md`) must remain mutually consistent (terminology, database names, API paths, service names, technologies, module names, architecture, feature scope, priorities, workflows). When detailed information is defined in one document, reference it — do not duplicate a conflicting version elsewhere.

## 16. Agent Workflow

Before modifying anything, follow this sequence:
1. **Inspect** — read the current state of the relevant code/docs.
2. **Understand** — confirm how it fits the broader architecture.
3. **Plan** — decide the smallest safe change that satisfies the requirement.
4. **Modify** — implement.
5. **Test** — validate against the phase's DoD/testing category.
6. **Verify** — confirm consistency with all eight project documents.
7. **Document** — update `Tracker.md` status and, if applicable, record a decision (§12).

## 17. Model & Data Versioning

- Version identifiers are required for: the ML segmentation model, the preprocessing pipeline, the drift configuration, the AIS dataset, the environmental dataset, and the software release (`schema.md` §4.17 `model_versions`).
- Every generated evidence package must be traceable to these versions (PRD §21).

---

## 18. No Fake Features

Do not create a feature merely because it can be displayed in the UI. Every major analytical feature must have an actual implementation path:

- **AI:** Input → Model → Output → Confidence → Validation.
- **Drift:** Inputs → Simulation → Output → Uncertainty.
- **Attribution:** Evidence → Scoring → Ranking → Explanation.
- **Evidence:** Source → Processing → Artifact → Hash → Provenance.

If a feature cannot follow its full chain within the hackathon timeline, it is either descoped to P2/P3 (`tech_stack.md`) or shipped explicitly labeled as a limited prototype (as with SAR-vessel dark-vessel detection, `implementationPlan.md` Phase 9) — never faked to appear complete.

## 19. No Fake Real-Time

Do not call something real-time unless the underlying data source and system architecture genuinely support the necessary latency. Use accurate terminology:

- `real-time` — only if genuinely sub-minute latency, end to end.
- `near-real-time` — for satellite/AIS data with meaningful but bounded delay.
- `latest available` — when serving the most recent cached/retrieved data without a real-time guarantee.
- `historical` — for archival data.
- `batch` — for scheduled/periodic processing.

Spill Sense's satellite revisit and processing pipeline is **not** real-time; UI, API, and documentation must consistently use `near-real-time`, `latest available`, `historical`, or `batch` as appropriate (PRD §6, §65).

## 20. No Fake Legal Claims

- SHA-256 provides cryptographic **integrity**. It does not by itself establish legal admissibility.
- The evidence dossier supports: provenance, integrity, reproducibility, investigation — while leaving legal admissibility to the appropriate authorities and procedures.
- This distinction must appear explicitly in the dossier text, the Evidence Center UI, and the `/api/v1/evidence` documentation — never implied to be settled by hashing alone.

## 21. No Fake Scientific Certainty

Required substitutions, enforced everywhere (UI, API, database labels, documentation, PDF dossier):

| Never write | Always write |
|---|---|
| "exact origin" | "probable origin region" |
| "responsible vessel" / "the vessel" | "highest-ranked candidate vessel" / "candidate vessel" |
| "confirmed oil" | "likely oil slick" |
| "proves guilt" / "determines with certainty" | "supports the assessment that…" / "is consistent with…" |
| "real-time" (unless genuinely true) | "near-real-time" / "latest available" |
| "court-admissible" (as a bare claim) | "supports integrity and provenance; admissibility is determined by the appropriate authorities" |

Defensible vocabulary to use throughout: `probable`, `estimated`, `confidence`, `likelihood`, `candidate vessel`, `origin probability envelope`, `analytical evidence`, `tamper-evident`, `integrity-verifiable`, `decision support` (PRD §6).

## 22. Scientific & Legal Honesty — Standing Prohibition

Never write documentation, UI copy, API responses, or dossier text claiming that:
- AI automatically proves criminal guilt.
- The system determines the exact vessel with certainty.
- Backward drift produces the exact release point.
- A probability score is a factual accusation.
- SHA-256 alone makes evidence automatically court-admissible.
- Every dark SAR object is a vessel.
- Every AIS gap indicates deliberate evasion.
- Every dark SAR patch is oil.
- Estimated volume is exact.
- Satellite imagery is inherently real-time.

This prohibition applies at every layer — frontend copy, API field naming, database labels, generated PDF text, and this documentation set itself.

---

## 23. Consistency Enforcement

Before considering any change complete, cross-check it against all seven other documents for: terminology, database/table names, API paths, service/module names, technology choices, feature scope, priority classifications (P0–P3), and workflow descriptions. A change that makes one document correct while leaving another contradictory is not done.

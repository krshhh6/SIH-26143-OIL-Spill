# Spill Sense — Security Guidelines

**Project:** Spill Sense · **Team:** BUG STALKERS · **SIH26143**
**Companion documents:** `prd.md`, `tech_stack.md`, `AppFlow.md`, `design.md`, `schema.md`, `implementationPlan.md`, `Tracker.md`, `rules.md`

> This document consolidates and expands every security requirement referenced elsewhere in the project (`prd.md` §12 Non-functional Requirements, `tech_stack.md` §11, `rules.md` §10) into one authoritative security specification. It is binding for the coding agent in the same way `rules.md` is. Where this document adds detail beyond `rules.md` §10, this document is the fuller reference; the two must never contradict each other (`rules.md` §23 Consistency Enforcement applies to this file too).

---

## 1. Guiding Principle

Spill Sense processes data that ultimately feeds an **evidence chain** for a real-world investigative workflow (PRD §6, §20–21). Security failures here are not just operational risk — a compromised or tampered pipeline undermines the scientific and legal honesty commitments in `rules.md` §18–22. Every security control below exists to protect either (a) the system's operational integrity, or (b) the **provenance and tamper-evidence of evidence artifacts**.

---

## 2. Secrets & Credential Management

- **No credentials, API keys, tokens, or connection strings are ever committed to source code or version control**, in any form — not in code, not in config files checked into Git, not in comments, not in test fixtures.
- All secrets (Copernicus Data Space OAuth client ID/secret, ISRO Bhoonidhi credentials, Global Fishing Watch API token, database credentials, Redis/MinIO credentials, Mapbox/MapLibre tokens, JWT signing keys) are supplied exclusively via environment variables, loaded through a `.env` file that is **git-ignored** by default (`.env.example` with placeholder values is the only version-controlled variant).
- Production/demo-day deployment secrets are managed through the deployment environment's configuration mechanism (Docker Compose `env_file`, CI/CD secret store) — never hardcoded into `docker-compose.yml` itself.
- Rotate any credential immediately if it is suspected to have been exposed (e.g., accidentally pasted into a chat, screen-shared during a demo rehearsal, or committed and later removed from history).
- Client-side code (frontend) never embeds a secret that grants write access or elevated data access — only public, domain-restricted tokens (e.g., a scoped Mapbox public token) may appear in frontend bundles.

## 3. Authentication & Authorization

- The investigator-facing application requires authentication (JWT-based, per `tech_stack.md` §11) before exposing incident data, evidence artifacts, or AIS/vessel information — these are not anonymously browsable.
- Session/token expiry is enforced; tokens are not indefinitely valid.
- Authorization checks happen server-side on every request — the frontend hiding a UI element is never treated as an access control mechanism.
- Role separation is documented even if the MVP ships a single "investigator" role: the schema and API must not assume every future user has full read/write access to every incident (a foundation for future role-based access, per `prd.md` §15 Future Scope).
- Evidence Center endpoints (`/api/v1/evidence`) enforce the same authentication as the rest of the API — a generated PDF dossier is not reachable via an unauthenticated, guessable URL.

## 4. API Security

- **Versioned REST APIs only** (`/api/v1/...` per `prd.md` §25) — no unversioned or ad hoc endpoints.
- **CORS policy** restricts allowed origins to the known frontend origin(s); wildcard (`*`) CORS is never used in any environment beyond isolated local development.
- **Rate limiting** (e.g., via `slowapi`) is applied to all public-facing endpoints, with stricter limits on expensive operations (job creation, PDF generation, SAR ingestion triggers) than on simple reads.
- **Input validation** is enforced through Pydantic models on every request — no endpoint accepts or processes a raw, unvalidated payload.
- **Output shaping:** API responses are built from explicit Pydantic response models, never a raw ORM object dump — this prevents accidental exposure of internal fields (e.g., internal file paths, raw credentials embedded in provenance metadata) and keeps the API/UI/dossier contract consistent (`rules.md` §4, §23).
- Error responses never leak stack traces, internal file paths, database error text, or credential fragments to the client — errors are logged in full server-side and returned to the client as a sanitized, generic message plus a correlation/job ID for support/debugging.
- Every state-changing endpoint (create incident, trigger reprocessing, delete artifact) uses the correct HTTP method semantics and is protected against CSRF where relevant to the auth mechanism chosen.

## 5. File & Upload Validation

- Any user-supplied file (SAR scene upload, manual data import) is validated for:
  - expected file type/extension and actual content-type sniffing (never trust the extension alone),
  - maximum file size (bounded, documented per upload type),
  - well-formedness of the geospatial/raster structure before it enters the processing pipeline.
- Uploaded files are never executed, interpreted as code, or passed to a shell command unsanitized.
- Files are stored in object storage (MinIO/S3) with a generated, non-guessable key — never using the user-supplied filename directly as the storage path.

## 6. Database Security

- **SQL injection prevention:** all database access goes through SQLAlchemy's parameterized query interface (ORM or `text()` with bound parameters) — raw string-interpolated SQL is never constructed from user input, anywhere in the codebase.
- Database credentials use the principle of least privilege: the application's database role has only the permissions it needs (no unnecessary `DROP`/`SUPERUSER` grants for the runtime service account); migrations may run under a separate, more privileged role reserved for deployment/CI.
- PostGIS geometry inputs are validated (`ST_IsValid`) before persistence — malformed geometry is rejected rather than silently stored and propagated downstream.
- Foreign key and `ON DELETE RESTRICT` constraints on evidence-relevant tables (`schema.md` §6) are themselves a security/integrity control — they prevent accidental or malicious cascade deletion of an incident's evidentiary chain.

## 7. Object Storage Security

- MinIO/S3 buckets used for SAR rasters, generated PDFs, and model artifacts are **not publicly readable by default** — access is mediated through the API, using pre-signed URLs with a short expiry when direct client access is genuinely needed (e.g., downloading a generated dossier).
- Bucket policies follow least privilege: the application's storage credentials are scoped to only the buckets/prefixes it needs.
- Object storage access logs are retained where feasible, supporting the provenance chain (§10 below).

## 8. Evidence Integrity & Chain of Custody

- Every evidence artifact's SHA-256 hash (`schema.md` §4.14 `evidence_artifacts`) is computed **server-side**, immediately after artifact generation, before the artifact is exposed to any client — never trust a client-supplied hash.
- The hash and its associated provenance record (`schema.md` §4.14–4.15) are stored in the same transactional database as the rest of the incident data, so they cannot be altered independently of the audited record.
- Evidence artifacts, once generated and hashed, are treated as immutable — regenerating a dossier for the same incident state produces a new artifact record with a new hash rather than overwriting the prior one, preserving history.
- As stated throughout the project documents (`rules.md` §20): SHA-256 provides **integrity**, not legal admissibility — this is a scientific/legal-honesty rule as much as a security one, and the two are linked: a security control (hashing) must never be mis-marketed as a legal guarantee it does not provide.

## 9. Dependency Security

- Before adding any dependency (Python or JavaScript), per `rules.md` §14: confirm it solves a concrete requirement, check its maintenance status, consider license compatibility, and avoid unnecessary transitive attack surface.
- Dependencies are pinned (lockfiles: `poetry.lock`/`requirements.txt` with hashes, `package-lock.json`) so builds are reproducible and not silently pulling in an unreviewed newer version.
- Automated dependency vulnerability scanning runs in CI (e.g., `pip-audit` / `npm audit`, or GitHub's built-in Dependabot alerts) — flagged critical/high vulnerabilities are triaged before merging, not ignored.
- Community reference repositories evaluated for reuse (OilSpillNet, Multi-Factor-Attribution-Engine, Aresys SCT — see `tech_stack.md` §15) are reviewed for license and maintenance status before any code is integrated; unverified third-party code is never merged wholesale into the pipeline without review.

## 10. Logging & Audit Trail

- Structured logging (`tech_stack.md` §13) captures: request metadata, job lifecycle events, authentication events, and data-source fallback events (live vs cached) — but **never logs secrets, full credentials, or raw authentication tokens**.
- Logs support reconstructing the provenance of any incident's processing history (which data source was used, which model version, which fallback was triggered) — directly supporting `prd.md` §21 Data Provenance from a security/audit angle.
- Access to evidence artifacts (who viewed/downloaded a dossier) is logged where the auth system supports it, supporting future chain-of-custody needs even though full access-audit UI is out of MVP scope (`prd.md` §15).

## 11. Transport & Environment Security

- All external API calls (Copernicus, Bhoonidhi, CMEMS/INCOIS, ERA5/Open-Meteo, Global Fishing Watch, MarineCadastre) use HTTPS/TLS — plaintext HTTP is never used for any live external integration.
- Internal service-to-service traffic (frontend↔backend, backend↔Redis, backend↔PostgreSQL, backend↔MinIO) uses TLS wherever the deployment environment reasonably supports it; for the local/offline Demo Mode Docker Compose environment, network isolation via Docker's internal network substitutes for TLS between containers, with the understanding that this is a hackathon-appropriate simplification, not a production posture (documented as a P3 hardening item alongside Kubernetes/production infra in `tech_stack.md`).
- `.env` files, database volumes, and MinIO data directories are excluded from version control (`.gitignore`) and from any demo build artifact shared publicly (e.g., a public GitHub repo for judging must not include populated `.env`, database dumps with real credentials, or cached API tokens).

## 12. Third-Party Data License & Access Compliance

Security and compliance intersect at data licensing — using a data source outside its permitted terms is itself a risk to the project's integrity:

- **Global Fishing Watch APIs are non-commercial-use only** (verified, `tech_stack.md` §8) — the SIH prototype stays within this term; any future commercial pathway (`prd.md` §15) must revisit licensing before reuse.
- **ISRO Bhoonidhi fine-resolution (Stripmap) EOS-04 data is priced/restricted for non-government entities** (verified, `tech_stack.md` §9) — the team uses only the open ScanSAR tier unless institutional/government access is separately arranged.
- **MarineCadastre AIS data covers U.S. waters only** — used strictly as a structural/demo data substitute, never presented as Indian-waters ground truth (`tech_stack.md` §8, `AppFlow.md` §18).
- Registration credentials for any of the above (Copernicus, Bhoonidhi, GFW) are personal/team credentials subject to §2 above — never shared insecurely or embedded in shipped code.

## 13. Security Testing

- Security-relevant test coverage is part of the Phase 13 testing requirement (`implementationPlan.md`), including at minimum:
  - authentication/authorization enforcement tests (unauthenticated requests to protected endpoints are rejected),
  - input-validation boundary tests (oversized files, malformed geometry, invalid coordinates/timestamps are rejected, not silently accepted),
  - injection-style negative tests confirming parameterized queries reject attempted SQL injection payloads,
  - a manual review pass confirming no secret appears in logs, error responses, or the public demo repository before Phase 15 (Demo Hardening).

## 14. Incident Response (Project-Operational, Not Maritime-Incident)

- If a credential leak, security misconfiguration, or vulnerability is discovered during development: rotate/revoke the affected credential immediately, assess exposure window, and record the event and remediation in `Tracker.md` §Known Bugs / §Technical Debt as appropriate — this is treated with the same "document, don't hide" discipline as any other engineering issue (`rules.md` §16 Agent Workflow, step 7).
- A discovered security issue is never silently patched without a corresponding note — consistency and traceability (`rules.md` §23) apply to security fixes as much as feature work.

## 15. Explicit Non-Goals (Security Scope Boundary for SIH MVP)

Consistent with the MVP-vs-production split in `prd.md` §15 and `tech_stack.md` §13, the following are **explicitly out of scope for the SIH MVP** and documented here so they are not mistaken for oversights:

- Full penetration testing / third-party security audit.
- Multi-tenant data isolation beyond basic per-incident access control.
- Formal compliance certification (e.g., ISO 27001, SOC 2) — relevant only if/when a production/government adoption pathway (`prd.md` §15) is pursued.
- Hardware security modules (HSM) for key management — environment-variable-based secret management is the documented MVP-appropriate approach (§2 above).
- High-availability/DDoS-resilient production infrastructure — classified P3 alongside Kubernetes/Grafana/Prometheus (`tech_stack.md` §13).

These are recorded as **future production hardening items**, not permanently rejected — see `prd.md` §15 Future Scope and `tech_stack.md`'s production-tier classifications for where they belong once the project moves beyond hackathon scope.

---

## 16. Summary Checklist (mirrors `Tracker.md` conventions)

- [ ] No secrets in source control; `.env.example` only, `.env` git-ignored
- [ ] JWT authentication enforced on all incident/evidence/vessel endpoints
- [ ] CORS restricted to known origins; no wildcard in any shared environment
- [ ] Rate limiting applied, stricter on expensive endpoints
- [ ] All inputs validated via Pydantic; all outputs shaped via explicit response models
- [ ] File uploads validated (type, size, structural well-formedness)
- [ ] All DB access parameterized; no raw string-interpolated SQL
- [ ] PostGIS geometry validated before persistence
- [ ] Object storage buckets not publicly readable; pre-signed URLs used for client downloads
- [ ] Evidence hashes computed server-side, immutable once generated
- [ ] Dependencies pinned + scanned in CI
- [ ] Logs capture provenance/audit events, never secrets
- [ ] External API calls use HTTPS/TLS
- [ ] Third-party data license terms (GFW non-commercial, Bhoonidhi tiering, MarineCadastre coverage) respected and disclosed
- [ ] Security-relevant tests included in Phase 13 coverage
- [ ] Any discovered security issue logged in `Tracker.md`, not silently patched

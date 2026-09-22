import React, { useState } from 'react';

interface EvidenceViewProps {
  onOpenForensicModal: () => void;
}

export const EvidenceView: React.FC<EvidenceViewProps> = ({ onOpenForensicModal }) => {
  const masterHash =
    'a3f7c2d1e8b49f0c5a2e7d3b8c4f1a9e2d5b7c3e8a1f4d9b6c2e5a8f3d7b1c4e9a2f6d0b5c8e3a7f1d4b9c2e6a0f5d3b8c1e4a7f2d6b0c9e5a8f1d3b7c0e6';

  const [feedback, setFeedback] = useState<{ text: string; color: string } | null>(null);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const handleCopySignature = () => {
    navigator.clipboard?.writeText(masterHash);
    setFeedback({ text: 'Cryptographic master signature copied to clipboard.', color: 'var(--accent)' });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleDownloadArtifact = (fileName: string) => {
    setDownloadNotice(`Downloading authenticated package: ${fileName}...`);
    setTimeout(() => setDownloadNotice(null), 3000);
  };

  return (
    <div id="tab-evidence" className="tab-content visible modern-dashboard-root">
      {/* 1. EXECUTIVE HEADER */}
      <div className="workspace-header-bar">
        <div>
          <h1 className="workspace-main-title">Forensic Evidence &amp; Chain of Custody</h1>
          <p className="workspace-sub-title">
            Cryptographically Verifiable Evidence Package for Maritime Regulatory Enforcement · ISO/IEC 27037 Digital Forensics Standards
          </p>
        </div>

        <div className="workspace-header-actions">
          <button
            className="action-pill-btn secondary"
            onClick={handleCopySignature}
            title="Copy Master SHA-256 Fingerprint"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>content_copy</span>
            <span>Copy Master Signature</span>
          </button>

          <button
            className="action-pill-btn primary"
            onClick={onOpenForensicModal}
            title="Generate & View Court-Admissible PDF Dossier"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>description</span>
            <span>View Complete PDF Dossier</span>
          </button>
        </div>
      </div>

      {/* 2. EXECUTIVE METRIC CARDS */}
      <div className="executive-metrics-grid">
        <div className="metric-card-neumorphic">
          <div className="metric-card-header">
            <span className="metric-card-label">Custody Seal Status</span>
          </div>
          <div className="metric-card-body">
            <span className="metric-number" style={{ fontSize: 19 }}>
              ISO/IEC <span className="metric-unit">27037</span>
            </span>
            <span className="metric-trend-pill positive">
              Verified Active
            </span>
          </div>
          <div className="metric-card-footer">
            <span>Hardware Security Module (HSM)</span>
            <span className="material-symbols-outlined arrow-icon">verified</span>
          </div>
        </div>

        <div className="metric-card-neumorphic">
          <div className="metric-card-header">
            <span className="metric-card-label">SHA-256 Checksums</span>
          </div>
          <div className="metric-card-body">
            <span className="metric-number">
              4 / 4 <span className="metric-unit">Sealed</span>
            </span>
            <span className="metric-trend-pill positive">
              100% Intact
            </span>
          </div>
          <div className="metric-card-footer">
            <span>Zero Bit Discrepancies</span>
            <span className="material-symbols-outlined arrow-icon">lock</span>
          </div>
        </div>

        <div className="metric-card-neumorphic">
          <div className="metric-card-header">
            <span className="metric-card-label">Evidence Package</span>
          </div>
          <div className="metric-card-body">
            <span className="metric-number">
              278.9 <span className="metric-unit">KB</span>
            </span>
            <span className="metric-trend-pill neutral">
              Bundle Package
            </span>
          </div>
          <div className="metric-card-footer">
            <span>GeoJSON / NetCDF / GPKG</span>
            <span className="material-symbols-outlined arrow-icon">folder_zip</span>
          </div>
        </div>

        <div className="metric-card-neumorphic">
          <div className="metric-card-header">
            <span className="metric-card-label">Admissibility Level</span>
          </div>
          <div className="metric-card-body">
            <span className="metric-number">
              Tier 4 <span className="metric-unit">Legal</span>
            </span>
            <span className="metric-trend-pill positive">
              Court-Admissible
            </span>
          </div>
          <div className="metric-card-footer">
            <span>Sec 356 MS Act 1958</span>
            <span className="material-symbols-outlined arrow-icon">gavel</span>
          </div>
        </div>
      </div>

      {/* 3. WORKFLOW NAV BAR */}
      <div className="workflow-nav-bar">
        <div className="workflow-title-area">
          <h2 className="workflow-title">Tamper-Evident Forensic Audit Ledger</h2>
          <span className="scenario-chip" style={{ borderColor: 'rgba(37, 99, 235, 0.4)', color: 'var(--accent)' }}>
            Ledger Block #40921-IN · ECDSA Signed
          </span>
        </div>

        <div className="workflow-tabs-strip">
          <button className="workflow-tab-btn active">
            Cryptographic Manifest
          </button>
          <button className="workflow-tab-btn" onClick={() => handleDownloadArtifact('full_forensic_bundle.zip')}>
            Exportable Artifacts (4)
          </button>
          <button className="workflow-tab-btn" onClick={onOpenForensicModal}>
            Court Dossier Preview
          </button>
        </div>

        {feedback && (
          <div style={{ fontSize: 11, fontWeight: 600, color: feedback.color, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>check_circle</span>
            {feedback.text}
          </div>
        )}
      </div>

      {downloadNotice && (
        <div
          style={{
            margin: '0 0 12px',
            padding: '8px 14px',
            background: 'rgba(56, 189, 248, 0.12)',
            border: '1px solid rgba(56, 189, 248, 0.28)',
            borderRadius: 8,
            fontSize: 12,
            color: '#38bdf8',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>cloud_download</span>
          {downloadNotice}
        </div>
      )}

      {/* 4. ROUNDED CANVAS CONTAINER */}
      <div className="canvas-rounded-container">
        <div className="canvas-two-column">
          {/* LEFT PANE: MASTER MANIFEST & ARTIFACTS */}
          <div className="canvas-pane">
            <div className="pane-header">
              <span className="pane-title">
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--accent)' }}>lock</span>
                Master Cryptographic Manifest
              </span>
              <span className="metric-trend-pill positive" style={{ fontSize: 10, fontWeight: 700 }}>
                VERIFIED SECURE
              </span>
            </div>

            {/* TAMPER-PROOF DIGITAL SEAL CARD */}
            <div
              style={{
                background: 'var(--bg-raised)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 12,
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'rgba(37, 99, 235, 0.12)',
                      color: 'var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>verified_user</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      Cryptographic Chain of Custody Seal
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                      ISO/IEC 27037 Tamper-Proof Digital Seal · Registered in Maritime Ledger
                    </div>
                  </div>
                </div>

                <button
                  className="action-pill-btn secondary"
                  onClick={handleCopySignature}
                  style={{ fontSize: 11, padding: '4px 10px' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>content_copy</span>
                  <span>Copy Digest</span>
                </button>
              </div>

              <div
                style={{
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  padding: '8px 10px',
                  fontFamily: 'monospace',
                  fontSize: 10,
                  color: 'var(--accent)',
                  wordBreak: 'break-all',
                  lineHeight: 1.4,
                }}
              >
                {masterHash}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: 10 }}>
                <div>
                  <span className="text-muted">Algorithm: </span>
                  <strong>SHA-256 + ECDSA</strong>
                </div>
                <div>
                  <span className="text-muted">Key ID: </span>
                  <strong>ICG-C2-2026-9</strong>
                </div>
                <div>
                  <span className="text-muted">Timestamp: </span>
                  <strong>RFC 3161 TSP</strong>
                </div>
              </div>
            </div>

            {/* EXPORTABLE FORENSIC ARTIFACTS LIST */}
            <div style={{ marginTop: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--accent)' }}>folder_zip</span>
                  Exportable Forensic Artifacts (4 Assets)
                </span>
                <span className="text-xs text-muted">GeoJSON · GeoPackage · XML</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Item 1 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: 'var(--bg-raised)',
                    borderRadius: 10,
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="material-symbols-outlined" style={{ color: '#ef4444', fontSize: 20 }}>water_drop</span>
                    <div>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                        slick_detection_polygon.geojson
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        EPSG:4326 · Calibrated Sentinel-1 U-Net SAR Mask
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="mono text-xs text-muted">14.2 KB</span>
                    <button
                      className="action-pill-btn secondary"
                      onClick={() => handleDownloadArtifact('slick_detection_polygon.geojson')}
                      style={{ padding: '3px 8px', fontSize: 10 }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>download</span>
                    </button>
                  </div>
                </div>

                {/* Item 2 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: 'var(--bg-raised)',
                    borderRadius: 10,
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="material-symbols-outlined" style={{ color: '#f59e0b', fontSize: 20 }}>grain</span>
                    <div>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                        origin_probability_envelopes.geojson
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        50%, 75%, 90% contours · Lagrangian backward N=1000
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="mono text-xs text-muted">38.7 KB</span>
                    <button
                      className="action-pill-btn secondary"
                      onClick={() => handleDownloadArtifact('origin_probability_envelopes.geojson')}
                      style={{ padding: '3px 8px', fontSize: 10 }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>download</span>
                    </button>
                  </div>
                </div>

                {/* Item 3 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: 'var(--bg-raised)',
                    borderRadius: 10,
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--accent)', fontSize: 20 }}>route</span>
                    <div>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                        ais_candidate_trajectories.gpkg
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        72h AIS tracks with gap annotations · OGC GeoPackage
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="mono text-xs text-muted">226 KB</span>
                    <button
                      className="action-pill-btn secondary"
                      onClick={() => handleDownloadArtifact('ais_candidate_trajectories.gpkg')}
                      style={{ padding: '3px 8px', fontSize: 10 }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>download</span>
                    </button>
                  </div>
                </div>

                {/* Item 4 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: 'var(--bg-raised)',
                    borderRadius: 10,
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: 20 }}>satellite_alt</span>
                    <div>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                        sentinel1_calibration_metadata.xml
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        CEOS / SAFE Header Ingestion Metadata · Radiometric Calibration
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="mono text-xs text-muted">18.4 KB</span>
                    <button
                      className="action-pill-btn secondary"
                      onClick={() => handleDownloadArtifact('sentinel1_calibration_metadata.xml')}
                      style={{ padding: '3px 8px', fontSize: 10 }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>download</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT PANE: TIMELINE & LEGAL STATUTORY ADVISORY */}
          <div className="canvas-pane">
            <div className="pane-header">
              <span className="pane-title">
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--accent)' }}>link</span>
                Forensic Chain of Custody Timeline
              </span>
              <span className="metric-trend-pill neutral" style={{ fontSize: 10 }}>
                5 MILESTONES SEALED
              </span>
            </div>

            {/* CHRONOLOGICAL TIMELINE */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                    SAR Scene Ingestion Authenticated
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    2024-11-14 04:22 UTC · Sentinel-1 L1C Ground Range Detected (GRD) CRC32 Verified
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Feature Mask SHA-256 Timestamped
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    2024-11-14 04:25 UTC · U-Net ResNet-50 oil polygon boundary immutable hash
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Drift NetCDF Output Hashed
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    2024-11-14 04:29 UTC · OpenDrift Lagrangian Monte Carlo trajectory coordinates sealed
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                    AIS Intersect Matrix Sealed
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    2024-11-14 04:33 UTC · AISHub candidate correlations &amp; silence gaps recorded
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'rgba(37, 99, 235, 0.15)',
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>rate_review</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
                    Dossier Validated by Lead Investigator
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    2026-09-01 18:30 IST · Duty Surveillance Officer (ICG Maritime Intel Unit)
                  </div>
                </div>
              </div>
            </div>

            {/* LEGAL ADMISSIBILITY ADVISORY */}
            <div
              style={{
                background: 'var(--bg-raised)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 12,
                padding: '14px',
                marginTop: 'auto',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--accent)' }}>balance</span>
                Statutory Compliance &amp; Legal Precedent
              </div>
              <p style={{ fontSize: 10.5, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 8px' }}>
                This cryptographic packet adheres to the Indian Evidence Act (Section 65B electronic record admissibility) and ISO/IEC 27037 standards for digital evidence collection.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className="scenario-chip" style={{ fontSize: 9.5 }}>MARPOL 73/78 Annex I</span>
                <span className="scenario-chip" style={{ fontSize: 9.5 }}>MS Act 1958 Sec 356</span>
                <span className="scenario-chip" style={{ fontSize: 9.5 }}>UNCLOS Art. 217</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';

interface EvidenceViewProps {
  onOpenForensicModal: () => void;
}

export const EvidenceView: React.FC<EvidenceViewProps> = ({ onOpenForensicModal }) => {
  const masterHash =
    'a3f7c2d1e8b49f0c5a2e7d3b8c4f1a9e2d5b7c3e8a1f4d9b6c2e5a8f3d7b1c4e9a2f6d0b5c8e3a7f1d4b9c2e6a0f5d3b8c1e4a7f2d6b0c9e5a8f1d3b7c0e6';

  const [verifyInput, setVerifyInput] = useState<string>('');
  const [feedback, setFeedback] = useState<{ text: string; color: string } | null>(null);

  const handleVerify = () => {
    const input = verifyInput.trim();
    if (!input) {
      setFeedback({
        text: 'Please enter a SHA-256 hash string.',
        color: 'var(--sev-medium)',
      });
      return;
    }

    if (input.toLowerCase() === masterHash.toLowerCase()) {
      setFeedback({
        text: '✅ INTEGRITY CONFIRMED: Master hash matches database signature. 0 byte tamper detected.',
        color: '#16A34A',
      });
    } else {
      setFeedback({
        text: '❌ INTEGRITY FAILURE: Hash mismatch! Data may have been tampered or corrupted.',
        color: 'var(--sev-critical)',
      });
    }
  };

  return (
    <div id="tab-evidence" className="tab-content visible">
      {/* PAGE HEADER */}
      <div className="page-header" style={{ paddingTop: 'var(--sp-4)' }}>
        <div>
          <div className="flex items-center gap-3">
            <div className="page-title">Forensic Evidence &amp; Chain of Custody</div>
            <span className="id-tag">SHA-256 TAMPER-PROOF</span>
          </div>
          <div className="page-subtitle">
            Cryptographically verifiable evidence package for maritime regulatory enforcement
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={onOpenForensicModal}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>description</span>
            View Complete PDF Dossier
          </button>
        </div>
      </div>

      <div className="content-area" style={{ alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          {/* MASTER MANIFEST */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>lock</span>
                Master Cryptographic Manifest
              </span>
              <span className="chip chip-ok">VERIFIED</span>
            </div>
            <div className="panel-body">
              <div style={{ background: 'var(--bg-raised)', padding: '10px 12px', borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
                  Master Dossier SHA-256 Hash
                </div>
                <div className="mono text-xs text-mono" style={{ wordBreak: 'break-all' }}>
                  {masterHash}
                </div>
              </div>

              {/* Interactive Hash Integrity Verifier */}
              <div style={{ marginTop: 'var(--sp-3)', display: 'flex', gap: 'var(--sp-2)' }}>
                <input
                  type="text"
                  placeholder="Paste SHA-256 to verify integrity..."
                  value={verifyInput}
                  onChange={(e) => setVerifyInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 11,
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                />
                <button
                  className="btn btn-secondary"
                  onClick={handleVerify}
                  style={{ padding: '6px 12px', fontSize: 11 }}
                >
                  Verify Integrity
                </button>
              </div>
              {feedback && (
                <div style={{ marginTop: 'var(--sp-2)', fontSize: 11, fontWeight: 600, color: feedback.color }}>
                  {feedback.text}
                </div>
              )}
            </div>
          </div>

          {/* EXPORTABLE ARTIFACTS */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>folder_zip</span>
                Exportable Forensic Artifacts
              </span>
              <span className="text-xs text-muted">GeoJSON / GeoPackage / JSON</span>
            </div>
            <div className="panel-body" style={{ paddingTop: 'var(--sp-2)', paddingBottom: 'var(--sp-2)' }}>
              <div className="flex items-center justify-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-rounded" style={{ color: 'var(--slick-color)', fontSize: 20 }}>
                    water_drop
                  </span>
                  <div>
                    <div className="font-semibold text-xs">slick_detection_polygon.geojson</div>
                    <div className="text-xs text-muted">EPSG:4326 · Calibrated Sentinel-1 U-Net SAR Mask</div>
                  </div>
                </div>
                <div className="mono text-xs text-muted">14.2 KB</div>
              </div>

              <div className="flex items-center justify-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-rounded" style={{ color: 'var(--drift-color)', fontSize: 20 }}>
                    grain
                  </span>
                  <div>
                    <div className="font-semibold text-xs">origin_probability_envelopes.geojson</div>
                    <div className="text-xs text-muted">50%, 75%, 90% contours · Lagrangian backward N=1000</div>
                  </div>
                </div>
                <div className="mono text-xs text-muted">38.7 KB</div>
              </div>

              <div className="flex items-center justify-between" style={{ padding: '8px 0' }}>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-rounded" style={{ color: 'var(--vessel-color)', fontSize: 20 }}>
                    route
                  </span>
                  <div>
                    <div className="font-semibold text-xs">ais_candidate_trajectories.gpkg</div>
                    <div className="text-xs text-muted">72h AIS tracks with gap annotations</div>
                  </div>
                </div>
                <div className="mono text-xs text-muted">226 KB</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>link</span>
                Forensic Chain of Custody
              </span>
            </div>
            <div className="panel-body" style={{ paddingTop: 'var(--sp-2)' }}>
              <div className="tl-row">
                <div className="tl-dot done"></div>
                <div>
                  <div className="tl-event fw-600">SAR Scene Ingestion Authenticated</div>
                  <div className="tl-time">2024-11-14 04:22 UTC</div>
                </div>
              </div>
              <div className="tl-row">
                <div className="tl-dot done"></div>
                <div>
                  <div className="tl-event">Feature Mask SHA-256 Timestamped</div>
                  <div className="tl-time">2024-11-14 04:25 UTC</div>
                </div>
              </div>
              <div className="tl-row">
                <div className="tl-dot done"></div>
                <div>
                  <div className="tl-event">Drift NetCDF Output Hashed</div>
                  <div className="tl-time">2024-11-14 04:29 UTC</div>
                </div>
              </div>
              <div className="tl-row">
                <div className="tl-dot done"></div>
                <div>
                  <div className="tl-event">AIS Intersect Matrix Sealed</div>
                  <div className="tl-time">2024-11-14 04:33 UTC</div>
                </div>
              </div>
              <div className="tl-row" style={{ paddingBottom: 0 }}>
                <div className="tl-dot run"></div>
                <div>
                  <div className="tl-event" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                    Dossier Validated by Lead Investigator
                  </div>
                  <div className="tl-time">2026-09-01 18:30 IST · Duty Surveillance Officer</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

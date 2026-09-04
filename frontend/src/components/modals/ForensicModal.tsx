import React from 'react';
import type { Scenario } from '../../types/dashboard';

interface ForensicModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenario: Scenario;
}

export const ForensicModal: React.FC<ForensicModalProps> = ({ isOpen, onClose, scenario }) => {
  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop open"
      id="forensic-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card">
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ color: 'var(--accent)' }}>gavel</span>
            <span style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Official Maritime Forensic Evidence Dossier
            </span>
          </div>
          <div className="flex items-center gap-2 modal-actions">
            <button
              className="btn btn-secondary"
              onClick={() => window.print()}
              style={{ padding: '4px 10px', fontSize: 11 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>print</span>
              Print / Export PDF
            </button>
            <button className="btn-icon" onClick={onClose}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div style={{ textAlign: 'center', borderBottom: '2px solid var(--border-default)', paddingBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Government of India · Maritime Intelligence Cell
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
              SPILL SENSE FORENSIC ATTRIBUTION REPORT
            </div>
            <div className="mono text-xs text-muted" style={{ marginTop: 3 }}>
              Doc Ref: ICG/MRCC/2026/SS-{scenario.id} · Classification: INVESTIGATIVE DECISION-SUPPORT
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              background: 'var(--bg-raised)',
              padding: 12,
              borderRadius: 4,
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div><strong>Incident Identifier:</strong> <span className="mono">{scenario.id} ({scenario.title})</span></div>
            <div><strong>Detection Timestamp:</strong> <span className="mono">2024-11-14 04:22:11Z</span></div>
            <div><strong>Centroid Coordinate:</strong> <span className="mono">{scenario.lat.toFixed(4)}°N, {scenario.lng.toFixed(4)}°E (EPSG:4326)</span></div>
            <div><strong>Estimated Surface Area:</strong> <span className="mono">{scenario.area || 'Model-Derived Polygon Area'}</span></div>
            <div><strong>Satellite Source:</strong> <span className="mono">Sentinel-1A IW GRD (Copernicus)</span></div>
            <div><strong>Wind / Current Regime:</strong> <span className="mono">ERA5 4.2 m/s · CMEMS 0.34 kn</span></div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>
              Highest-Ranked Candidate Vessel
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, border: '1px solid var(--border-subtle)' }}>
              <thead>
                <tr style={{ background: 'var(--bg-raised)', textAlign: 'left' }}>
                  <th style={{ padding: 6, border: '1px solid var(--border-subtle)' }}>Rank</th>
                  <th style={{ padding: 6, border: '1px solid var(--border-subtle)' }}>Vessel Name</th>
                  <th style={{ padding: 6, border: '1px solid var(--border-subtle)' }}>MMSI / IMO</th>
                  <th style={{ padding: 6, border: '1px solid var(--border-subtle)' }}>Flag / Type</th>
                  <th style={{ padding: 6, border: '1px solid var(--border-subtle)' }}>Attribution Score</th>
                  <th style={{ padding: 6, border: '1px solid var(--border-subtle)' }}>AIS Anomaly</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: 6, border: '1px solid var(--border-subtle)', fontWeight: 700 }}>#1</td>
                  <td style={{ padding: 6, border: '1px solid var(--border-subtle)', color: 'var(--vessel-color)', fontWeight: 700 }}>
                    {scenario.topVessel}
                  </td>
                  <td style={{ padding: 6, border: '1px solid var(--border-subtle)', fontFamily: 'JetBrains Mono' }}>
                    419001234 / 9412345
                  </td>
                  <td style={{ padding: 6, border: '1px solid var(--border-subtle)' }}>India · Crude Tanker</td>
                  <td style={{ padding: 6, border: '1px solid var(--border-subtle)', fontFamily: 'JetBrains Mono', fontWeight: 700, color: 'var(--sev-high)' }}>
                    0.82
                  </td>
                  <td style={{ padding: 6, border: '1px solid var(--border-subtle)', color: 'var(--sev-critical)', fontWeight: 600 }}>
                    {scenario.diagDetails}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ background: 'var(--bg-raised)', padding: '12px 14px', borderRadius: 4, border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--accent)' }}>verified</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Digital Chain of Custody Verified
                </div>
                <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                  Tamper-proof cryptographic seal confirms zero byte modifications post-ingestion. ISO/IEC 27037 compliant.
                </div>
              </div>
            </div>
            <span className="chip chip-ok" style={{ fontSize: 10, padding: '2px 8px' }}>SEALED &amp; VERIFIED</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700 }}>Lead Technical Investigator</div>
              <div className="mono text-xs text-muted" style={{ marginTop: 2 }}>Surveillance Operations Cell (BUG STALKERS)</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, fontWeight: 700 }}>Authorized Maritime Cell Sign-Off</div>
              <div className="mono text-xs text-muted" style={{ marginTop: 2 }}>Coast Guard District HQ No. 11</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

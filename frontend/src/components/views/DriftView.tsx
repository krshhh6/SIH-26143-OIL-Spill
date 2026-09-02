import React from 'react';
import type { TabType } from '../../types/dashboard';

interface DriftViewProps {
  onSelectTab: (tab: TabType) => void;
}

export const DriftView: React.FC<DriftViewProps> = ({ onSelectTab }) => {
  return (
    <div id="tab-drift" className="tab-content visible">
      {/* PAGE HEADER */}
      <div className="page-header" style={{ paddingTop: 'var(--sp-4)' }}>
        <div>
          <div className="flex items-center gap-3">
            <div className="page-title">Lagrangian Hydrodynamic Drift Simulation</div>
            <span className="id-tag">OpenDrift / OpenOil</span>
          </div>
          <div className="page-subtitle">
            Backward Monte Carlo Dispersion (N=1,000 particles) driven by CMEMS Ocean Currents &amp; ERA5 10m Wind Vectors
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => onSelectTab('attribution')}>
            Vessel Attribution
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
          </button>
        </div>
      </div>

      <div className="content-area" style={{ alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>cyclone</span>
                Origin Probability Envelope Analysis (Reverse Time)
              </span>
              <span
                className="chip"
                style={{
                  background: 'rgba(217,119,6,.10)',
                  color: 'var(--drift-color)',
                  borderColor: 'rgba(217,119,6,.25)',
                  fontSize: 9,
                }}
              >
                PHYSICS BACKTRACKING
              </span>
            </div>
            <div className="panel-body">
              <div className="prob-note" style={{ marginBottom: 'var(--sp-4)' }}>
                <strong>Operational Hydrodynamic Rule:</strong> Because sea surface currents and wind drift constantly
                transport oil films, a detected slick position is NEVER the discharge point. OpenDrift reverses the
                advection-diffusion equation to isolate the exact space-time envelope where discharge statistically occurred.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
                <div style={{ background: 'var(--bg-raised)', padding: 10, borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
                  <div className="text-xs text-muted fw-600">50% Core Probability</div>
                  <div className="text-base fw-700" style={{ color: 'var(--drift-color)' }}>18.62°N, 71.18°E</div>
                  <div className="text-xs text-muted">Discharge Window: T - 20h to - 24h</div>
                </div>
                <div style={{ background: 'var(--bg-raised)', padding: 10, borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
                  <div className="text-xs text-muted fw-600">75% Probability Area</div>
                  <div className="text-base fw-700">68.4 km²</div>
                  <div className="text-xs text-muted">Spatiotemporal uncertainty radius</div>
                </div>
                <div style={{ background: 'var(--bg-raised)', padding: 10, borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
                  <div className="text-xs text-muted fw-600">Total Particles Trailed</div>
                  <div className="text-base fw-700">1,000 Lagrangian</div>
                  <div className="text-xs text-muted">Runge-Kutta 4th Order Integrator</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>tune</span>
                Hydrodynamic Engine Parameters
              </span>
            </div>
            <div className="panel-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
                <div>
                  <div className="text-xs text-muted">Integration Time Step</div>
                  <div className="mono fw-700">15 minutes</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Wind Drag Coefficient</div>
                  <div className="mono fw-700">3.5% (Stokes Drift)</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Horizontal Diffusivity</div>
                  <div className="mono fw-700">10 m²/s</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Current Layer Depth</div>
                  <div className="mono fw-700">0.0 – 1.0 m (Ekman)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

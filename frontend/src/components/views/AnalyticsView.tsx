import React from 'react';

export const AnalyticsView: React.FC = () => {
  return (
    <div id="tab-analytics" className="tab-content visible">
      {/* PAGE HEADER */}
      <div className="page-header" style={{ paddingTop: 'var(--sp-4)' }}>
        <div>
          <div className="page-title">Spill Analytics &amp; Incident Heatmap</div>
          <div className="page-subtitle">Rolling 14-day trends across Indian Exclusive Economic Zone</div>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Active Incidents</div>
          <div className="stat-value">3</div>
          <div className="stat-sub">Arabian Sea: 1 · Bay of Bengal: 1 · Andaman: 1</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Slick Area</div>
          <div className="stat-value">3.6 km²</div>
          <div className="stat-sub">Range: 1.2 – 4.82 km²</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Model IoU Accuracy</div>
          <div className="stat-value">83.4%</div>
          <div className="stat-sub">Validated against SAR truth sets</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">AIS Transponder Gaps</div>
          <div className="stat-value">2</div>
          <div className="stat-sub">Classified as suspicious</div>
        </div>
      </div>

      <div className="content-area" style={{ alignItems: 'start', marginTop: 'var(--sp-4)' }}>
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>pie_chart</span>
              MARPOL Oil Classification Distribution
            </span>
          </div>
          <div className="panel-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-3)', textAlign: 'center' }}>
              <div style={{ padding: 12, background: 'var(--bg-raised)', borderRadius: 4, borderLeft: '3px solid #B45309' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>CRUDE OIL</div>
                <div className="mono font-bold text-lg" style={{ color: '#B45309', marginTop: 4 }}>48%</div>
                <div className="text-xs text-muted">Mumbai High / Deepwater</div>
              </div>
              <div style={{ padding: 12, background: 'var(--bg-raised)', borderRadius: 4, borderLeft: '3px solid #0D0D11' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>HEAVY BUNKER</div>
                <div className="mono font-bold text-lg" style={{ color: '#0D0D11', marginTop: 4 }}>27%</div>
                <div className="text-xs text-muted">Corridor Collisions</div>
              </div>
              <div style={{ padding: 12, background: 'var(--bg-raised)', borderRadius: 4, borderLeft: '3px solid #38BDF8' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>BILGE WATER</div>
                <div className="mono font-bold text-lg" style={{ color: '#0284C7', marginTop: 4 }}>16%</div>
                <div className="text-xs text-muted">Illegal Dark Vessel Discharge</div>
              </div>
              <div style={{ padding: 12, background: 'var(--bg-raised)', borderRadius: 4, borderLeft: '3px solid #EAB308' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>DIESEL / GAS OIL</div>
                <div className="mono font-bold text-lg" style={{ color: '#D97706', marginTop: 4 }}>9%</div>
                <div className="text-xs text-muted">Bunkering Hose Leaks</div>
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>speed</span>
              System Pipeline Latencies
            </span>
          </div>
          <div className="panel-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
              <div className="flex justify-between items-center">
                <span>SAR Scene Decryption &amp; Ingestion</span>
                <span className="mono font-semibold">18.2s</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Lee Filter &amp; Radiometric Calibration</span>
                <span className="mono font-semibold">38.4s</span>
              </div>
              <div className="flex justify-between items-center">
                <span>U-Net ResNet-50 AI Segmentation</span>
                <span className="mono font-semibold">2m 11s</span>
              </div>
              <div className="flex justify-between items-center">
                <span>OpenDrift Lagrangian Monte Carlo</span>
                <span className="mono font-semibold">4m 41s</span>
              </div>
              <div className="flex justify-between items-center">
                <span>AIS Correlation &amp; Multi-Factor Scoring</span>
                <span className="mono font-semibold">4m 07s</span>
              </div>
              <div className="flex justify-between items-center" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
                <span className="font-bold">Total Time to Court Dossier</span>
                <span className="mono font-bold" style={{ color: '#16A34A' }}>11m 47s</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

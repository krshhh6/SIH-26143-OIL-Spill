import React from 'react';
import type { TabType } from '../types/dashboard';

interface SidebarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab }) => {
  return (
    <aside className="sidebar">
      <div className="sec-label">Operations</div>
      <ul className="nav-list">
        <li
          className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => onSelectTab('dashboard')}
        >
          <span className="material-symbols-outlined">dashboard</span>
          Command Dashboard
          <span className="nav-badge" id="badge-count">3</span>
        </li>
        <li
          className={`nav-item ${activeTab === 'investigation' ? 'active' : ''}`}
          onClick={() => onSelectTab('investigation')}
        >
          <span className="material-symbols-outlined">satellite_alt</span>
          Copernicus Satellite Studio
          <span className="nav-badge blue">ESA CDSE</span>
        </li>
        <li
          className={`nav-item ${activeTab === 'drift' ? 'active' : ''}`}
          onClick={() => onSelectTab('drift')}
        >
          <span className="material-symbols-outlined">air</span>
          Drift Backtracking
        </li>
        <li
          className={`nav-item ${activeTab === 'attribution' ? 'active' : ''}`}
          onClick={() => onSelectTab('attribution')}
        >
          <span className="material-symbols-outlined">directions_boat</span>
          Vessel Attribution
        </li>
        <li
          className={`nav-item ${activeTab === 'evidence' ? 'active' : ''}`}
          onClick={() => onSelectTab('evidence')}
        >
          <span className="material-symbols-outlined">verified</span>
          Evidence Center
        </li>
      </ul>

      <div className="sb-divider"></div>

      <div className="sec-label" style={{ marginTop: 'var(--sp-2)' }}>Analytics</div>
      <ul className="nav-list">
        <li
          className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => onSelectTab('analytics')}
        >
          <span className="material-symbols-outlined">monitoring</span>
          Spill Analytics
          <span className="nav-badge gray">14d</span>
        </li>
      </ul>

      <div className="sys-status">
        <div className="sec-label" style={{ padding: '0 0 var(--sp-2)' }}>Telemetry Data Feed</div>
        <div className="sys-row">
          <span>MSN / Virtual Earth</span>
          <div className="flex items-center gap-2">
            <div className="sd ok"></div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Aerial Live</span>
          </div>
        </div>
        <div className="sys-row">
          <span>Esri Hydrographic</span>
          <div className="flex items-center gap-2">
            <div className="sd ok"></div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Nautical Topo</span>
          </div>
        </div>
        <div className="sys-row">
          <span>OpenSeaMap Aids</span>
          <div className="flex items-center gap-2">
            <div className="sd ok"></div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Seamarks</span>
          </div>
        </div>
        <div className="sys-row">
          <span>CMEMS Currents</span>
          <div className="flex items-center gap-2">
            <div className="sd ok"></div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>0.25° Mesh</span>
          </div>
        </div>
        <div className="sys-row">
          <span>PostGIS / Celery</span>
          <div className="flex items-center gap-2">
            <div className="sd ok"></div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>4/4 Healthy</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

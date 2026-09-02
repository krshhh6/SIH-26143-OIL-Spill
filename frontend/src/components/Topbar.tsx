import React from 'react';
import type { Scenario } from '../types/dashboard';
import { SCENARIOS } from '../data/scenarios';

interface TopbarProps {
  currentScenario: Scenario;
  currentScenarioKey: string;
  onSelectScenario: (key: string) => void;
  coordinates: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenForensicModal: () => void;
  onOpenSentinelHubModal: () => void;
  onSearchPlace: (query: string) => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  currentScenario,
  currentScenarioKey,
  onSelectScenario,
  coordinates,
  theme,
  onToggleTheme,
  onOpenForensicModal,
  onOpenSentinelHubModal,
  onSearchPlace,
}) => {
  const [searchInput, setSearchInput] = React.useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchInput.trim()) {
      onSearchPlace(searchInput.trim());
    }
  };

  const statusColor = currentScenario.sev.includes('CRITICAL')
    ? '#EF4444'
    : currentScenario.sev.includes('HIGH')
    ? '#F97316'
    : '#F59E0B';

  return (
    <header className="topbar">
      {/* BRAND LOGO */}
      <div className="topbar-logo">
        <div className="logo-icon">
          <span className="material-symbols-rounded" style={{ fontSize: 20 }}>waves</span>
        </div>
        <div>
          <div className="logo-name">SPILL SENSE</div>
          <div className="logo-sub">MARITIME C2 INTELLIGENCE</div>
        </div>
      </div>

      <div className="topbar-divider"></div>

      {/* SLEEK INCIDENT SELECTOR */}
      <div className="scenario-selector-pill">
        <span
          className="scenario-status-dot"
          style={{ backgroundColor: statusColor, color: statusColor }}
          title={`Active Status: ${currentScenario.sev}`}
        ></span>
        <select
          id="scenario-dropdown"
          className="scenario-select-styled"
          value={currentScenarioKey}
          onChange={(e) => onSelectScenario(e.target.value)}
          title="Switch Active Maritime Spill Incident"
        >
          {Object.entries(SCENARIOS).map(([key, s]) => (
            <option key={key} value={key}>
              {s.id}: {s.title} ({s.oilType})
            </option>
          ))}
        </select>
      </div>

      {/* UNIFIED TELEMETRY CAPSULE */}
      <div className="telemetry-capsule">
        <div className="telem-unit" title="Spill Centroid GPS Coordinates">
          <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#38BDF8' }}>
            near_me
          </span>
          <span>{coordinates}</span>
        </div>
        <span className="telem-div">|</span>
        <div className="telem-unit" title="ERA5 Surface Wind Vector">
          <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#38BDF8' }}>
            air
          </span>
          <span>4.2 m/s WSW</span>
        </div>
        <span className="telem-div">|</span>
        <div className="telem-unit" title="CMEMS Surface Drift Current">
          <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#38BDF8' }}>
            water
          </span>
          <span>0.34 kn ESE</span>
        </div>
      </div>

      {/* TOPBAR ACTIONS */}
      <div className="topbar-actions">
        {/* Maritime Search */}
        <div className="search-pill-container">
          <span
            className="material-symbols-outlined"
            style={{
              position: 'absolute',
              left: 8,
              fontSize: 15,
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          >
            search
          </span>
          <input
            type="text"
            className="search-pill-input"
            placeholder="Search port, strait..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span className="search-kbd">↵</span>
        </div>

        {/* Forensic Dossier */}
        <button
          className="btn btn-secondary"
          onClick={onOpenForensicModal}
          style={{ padding: '4px 9px', fontSize: 11, gap: 5 }}
          title="Generate Signed Maritime Forensic Evidence Dossier"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15, color: 'var(--accent)' }}>gavel</span>
          Dossier
        </button>

        {/* Sentinel Hub & CDSE Gateway */}
        <button
          className="btn btn-secondary"
          onClick={onOpenSentinelHubModal}
          title="Sentinel Hub & Copernicus Data Space Ecosystem API Suite"
          style={{ padding: '4px 9px', fontSize: 11, gap: 5 }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#0284C7' }}>
            hub
          </span>
          CDSE Cloud
        </button>

        {/* Theme Switcher */}
        <button className="btn-icon" onClick={onToggleTheme} title="Switch Light / Dark Theme">
          <span className="material-symbols-outlined" style={{ fontSize: 17 }}>
            {theme === 'dark' ? 'light_mode' : 'dark_mode'}
          </span>
        </button>

        {/* Alerts Notification */}
        <button className="btn-icon notif" title="Maritime Surveillance Alerts (2 Active)">
          <span className="material-symbols-outlined" style={{ fontSize: 17 }}>notifications</span>
        </button>

        {/* User Profile */}
        <div className="topbar-user" title="Indian Coast Guard Maritime Intelligence Cell">
          <div className="avatar">ICG</div>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Duty Officer
          </span>
        </div>
      </div>
    </header>
  );
};

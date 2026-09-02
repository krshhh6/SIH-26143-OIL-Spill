import React from 'react';
import type { Scenario, TabType } from '../../types/dashboard';
import { MapPanel } from '../MapPanel';

interface DashboardViewProps {
  currentScenario: Scenario;
  onSelectTab: (tab: TabType) => void;
  onOpenForensicModal: () => void;
  onUpdateCoords: (coords: string) => void;
  onSelectScenario?: (key: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentScenario,
  onSelectTab,
  onOpenForensicModal,
  onUpdateCoords,
  onSelectScenario,
}) => {
  const statusColor = currentScenario.sev.includes('CRITICAL')
    ? '#EF4444'
    : currentScenario.sev.includes('HIGH')
    ? '#F97316'
    : '#F59E0B';

  return (
    <div id="tab-dashboard" className="tab-content visible" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      {/* EXECUTIVE OPERATIONAL HEADER */}
      <div
        className="page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--accent)',
              }}
            >
              DEFENSE MARITIME C2 · SITUATIONAL INTELLIGENCE
            </span>
            <span style={{ color: 'var(--border-default)' }}>|</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 10,
                fontWeight: 700,
                color: statusColor,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: statusColor,
                  boxShadow: `0 0 6px ${statusColor}`,
                }}
              ></span>
              {currentScenario.sev}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
            <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              {currentScenario.title}
            </h1>
            <span
              style={{
                fontFamily: 'JetBrains Mono',
                fontSize: 11,
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: 4,
                background: 'var(--bg-raised)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-secondary)',
              }}
            >
              {currentScenario.id}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '1px 8px',
                borderRadius: 12,
                background: 'rgba(37, 99, 235, 0.1)',
                color: '#2563EB',
                border: '1px solid rgba(37, 99, 235, 0.25)',
              }}
            >
              {currentScenario.oilType} · Live Sentinel-1 SAR Pipeline
            </span>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {currentScenario.sub} · Candidate Intercept: <strong style={{ color: 'var(--text-primary)' }}>{currentScenario.topVessel}</strong> · Sensor: <strong>Sentinel-1A IW GRD / Sentinel-2 L2A</strong>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={onOpenForensicModal}
            style={{ padding: '6px 12px', fontSize: 11, gap: 6 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15, color: 'var(--accent)' }}>verified</span>
            Legal Dossier
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onSelectTab('investigation')}
            style={{ padding: '6px 14px', fontSize: 11, gap: 6 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>analytics</span>
            SAR Studio
          </button>
        </div>
      </div>

      {/* FULL-WIDTH TACTICAL MAP PANEL */}
      <div className="content-area" style={{ display: 'flex', flexDirection: 'column', width: '100%', flex: 1, padding: '8px 16px 12px', minHeight: 0 }}>
        <MapPanel scenario={currentScenario} onUpdateCoords={onUpdateCoords} onSelectScenario={onSelectScenario} />
      </div>
    </div>
  );
};

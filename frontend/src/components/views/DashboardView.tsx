import React from 'react';
import type { Scenario, TabType } from '../../types/dashboard';
import { MapPanel } from '../MapPanel';

interface DashboardViewProps {
  currentScenario: Scenario | null;
  onSelectTab: (tab: TabType) => void;
  onOpenForensicModal: () => void;
  onUpdateCoords: (coords: string) => void;
  onSelectScenario?: (key: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentScenario,
  onSelectTab,
  onOpenForensicModal: _onOpenForensicModal,
  onUpdateCoords,
  onSelectScenario,
}) => {
  const statusColor = !currentScenario
    ? '#2563EB'
    : currentScenario.sev.includes('CRITICAL')
    ? '#EF4444'
    : currentScenario.sev.includes('HIGH')
    ? '#F97316'
    : '#F59E0B';

  return (
    <div
      id="tab-dashboard"
      className="tab-content visible"
      style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', minHeight: 0, overflow: 'hidden' }}
    >
      {/* EXECUTIVE OPERATIONAL HEADER */}
      <div
        className="page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 14px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: statusColor,
              display: 'inline-block',
            }}
          ></span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            {currentScenario ? currentScenario.title : 'Indian Ocean & EEZ Maritime Surveillance'}
          </span>
          {currentScenario && (
            <>
              <span
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '1px 5px',
                  borderRadius: 3,
                  background: 'var(--bg-raised)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}
              >
                {currentScenario.id}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {currentScenario.oilType} · {currentScenario.area || 'Active'} · Intercept: <strong style={{ color: 'var(--text-secondary)' }}>{currentScenario.topVessel}</strong>
              </span>
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {currentScenario && onSelectScenario && (
            <button
              className="btn btn-secondary"
              onClick={() => onSelectScenario('')}
              style={{ padding: '4px 10px', fontSize: 11, gap: 5 }}
              title="Return to National Indian Ocean Overview"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>zoom_out_map</span>
              Overview
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={() => onSelectTab('investigation')}
            style={{ padding: '4px 12px', fontSize: 11, gap: 5 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>analytics</span>
            SAR Studio
          </button>
        </div>
      </div>

      {/* FULL-WIDTH TACTICAL MAP PANEL */}
      <div
        className="content-area"
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          flex: 1,
          padding: '4px 16px 8px',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <MapPanel scenario={currentScenario} onUpdateCoords={onUpdateCoords} onSelectScenario={onSelectScenario} />
      </div>
    </div>
  );
};

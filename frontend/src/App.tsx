import React, { useState, useEffect } from 'react';
import type { TabType } from './types/dashboard';
import { SCENARIOS } from './data/scenarios';
import { useIncidents } from './hooks/useIncidents';
import { Topbar } from './components/Topbar';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/views/DashboardView';
import { DriftView } from './components/views/DriftView';
import { AttributionView } from './components/views/AttributionView';
import { EvidenceView } from './components/views/EvidenceView';
import { AnalyticsView } from './components/views/AnalyticsView';
import { DetectionView } from './components/views/DetectionView';
import { ForensicModal } from './components/modals/ForensicModal';
import { SentinelHubModal } from './components/modals/SentinelHubModal';
import { BhoonidhiModal } from './components/modals/BhoonidhiModal';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [currentScenarioKey, setCurrentScenarioKey] = useState<string>('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [coordinates, setCoordinates] = useState<string>('15.5000°N, 79.0000°E (Indian Ocean EEZ)');
  const [isForensicOpen, setIsForensicOpen] = useState<boolean>(false);
  const [isSentinelHubOpen, setIsSentinelHubOpen] = useState<boolean>(false);
  const [isBhoonidhiOpen, setIsBhoonidhiOpen] = useState<boolean>(false);
  const [isMapFullscreen, setIsMapFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMapFullscreen) {
        setIsMapFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMapFullscreen]);

  // Live incident data — falls back to static SCENARIOS when backend is offline
  const { incidents, scenarios: liveScenarios } = useIncidents();
  const scenarios = { ...SCENARIOS, ...liveScenarios };

  const scenario = currentScenarioKey ? scenarios[currentScenarioKey] || null : null;

  // Apply theme to document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleSelectTab = (tab: TabType) => {
    setActiveTab(tab);
    if (isMapFullscreen) {
      setIsMapFullscreen(false);
    }
  };

  const handleSelectScenario = (key: string) => {
    setCurrentScenarioKey(key);
    if (key && scenarios[key]) {
      const s = scenarios[key];
      setCoordinates(`${s.lat.toFixed(4)}°N, ${s.lng.toFixed(4)}°E`);
    } else {
      setCoordinates('15.5000°N, 79.0000°E (Indian Ocean EEZ)');
    }
  };

  const handleSearchPlace = (query: string) => {
    const q = query.toLowerCase();
    if (q.includes('mumbai')) handleSelectScenario('INC-001');
    else if (q.includes('chennai') || q.includes('ennore')) handleSelectScenario('INC-002');
    else if (q.includes('andaman') || q.includes('malacca')) handleSelectScenario('INC-003');
    else if (q.includes('goa')) handleSelectScenario('INC-004');
    else if (q.includes('kutch') || q.includes('vadinar') || q.includes('gujarat')) handleSelectScenario('INC-005');
    else if (q.includes('cochin') || q.includes('kochi') || q.includes('kerala')) handleSelectScenario('INC-006');
    else if (q.includes('paradip') || q.includes('odisha') || q.includes('bengal')) handleSelectScenario('INC-007');
    else if (q.includes('lakshadweep') || q.includes('channel')) handleSelectScenario('INC-008');
    else {
      alert(`Maritime Place Search: Found location coordinates for "${query}". Navigating chart.`);
    }
  };

  // Keyboard navigation shortcuts (1-6, Escape)
  useEffect(() => {
    const tabs: TabType[] = ['dashboard', 'detection', 'drift', 'attribution', 'evidence', 'analytics'];
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      const k = parseInt(e.key, 10);
      if (k >= 1 && k <= 6) {
        setActiveTab(tabs[k - 1]);
      }
      if (e.key === 'Escape') {
        setIsForensicOpen(false);
        setIsSentinelHubOpen(false);
        setIsBhoonidhiOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="app-shell">
      {/* PRIMARY NAVIGATION DRAWER */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        currentScenarioKey={currentScenarioKey}
        onSelectScenario={handleSelectScenario}
        onOpenSettings={() => setIsForensicOpen(true)}
        incidents={incidents}
      />

      {/* MAIN WORKSPACE CANVAS */}
      <div className={`workspace-container ${isMapFullscreen ? 'map-fullscreen-active' : ''}`}>
        {/* WORKSPACE HEADER */}
        <Topbar
          currentScenario={scenario}
          currentScenarioKey={currentScenarioKey}
          onSelectScenario={handleSelectScenario}
          coordinates={coordinates}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenForensicModal={() => setIsForensicOpen(true)}
          onOpenSentinelHubModal={() => setIsSentinelHubOpen(true)}
          onOpenBhoonidhiModal={() => setIsBhoonidhiOpen(true)}
          onSearchPlace={handleSearchPlace}
        />

        {/* WORKSPACE MAIN VIEW */}
        <main
          className="main"
          id="main-content"
          style={{
            overflow: activeTab === 'dashboard' ? 'hidden' : 'auto',
          }}
        >
          {activeTab === 'dashboard' && (
            <DashboardView
              currentScenario={scenario}
              onSelectTab={handleSelectTab}
              onOpenForensicModal={() => setIsForensicOpen(true)}
              onUpdateCoords={setCoordinates}
              onSelectScenario={handleSelectScenario}
              incidents={incidents}
              scenarios={scenarios}
              isFullscreen={isMapFullscreen}
              onToggleFullscreen={() => setIsMapFullscreen((prev) => !prev)}
            />
          )}

          {activeTab === 'drift' && (
            <DriftView
              onSelectTab={setActiveTab}
              currentScenario={scenario}
              onSelectScenario={handleSelectScenario}
            />
          )}

          {activeTab === 'attribution' && (
            <AttributionView
              currentScenario={scenario}
              onSelectScenario={handleSelectScenario}
            />
          )}

          {activeTab === 'evidence' && (
            <EvidenceView
              onOpenForensicModal={() => setIsForensicOpen(true)}
              currentScenario={scenario}
            />
          )}

          {activeTab === 'analytics' && <AnalyticsView incidents={incidents} />}

          {activeTab === 'detection' && <DetectionView onSelectTab={setActiveTab} />}
        </main>
      </div>

      {/* MODALS */}
      <ForensicModal
        isOpen={isForensicOpen}
        onClose={() => setIsForensicOpen(false)}
        scenario={scenario || SCENARIOS['INC-001']}
      />

      <SentinelHubModal
        isOpen={isSentinelHubOpen}
        onClose={() => setIsSentinelHubOpen(false)}
      />

      <BhoonidhiModal
        isOpen={isBhoonidhiOpen}
        onClose={() => setIsBhoonidhiOpen(false)}
        scenario={scenario}
      />
    </div>
  );
};

export default App;

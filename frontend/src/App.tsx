import React, { useState, useEffect } from 'react';
import type { TabType } from './types/dashboard';
import { SCENARIOS } from './data/scenarios';
import { Topbar } from './components/Topbar';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/views/DashboardView';
import { InvestigationView } from './components/views/InvestigationView';
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
  const [currentScenarioKey, setCurrentScenarioKey] = useState<string>('INC-001');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [coordinates, setCoordinates] = useState<string>('18.7430°N, 71.2180°E (Mumbai High Basin)');
  const [isForensicOpen, setIsForensicOpen] = useState<boolean>(false);
  const [isSentinelHubOpen, setIsSentinelHubOpen] = useState<boolean>(false);
  const [isBhoonidhiOpen, setIsBhoonidhiOpen] = useState<boolean>(false);

  const scenario = currentScenarioKey ? SCENARIOS[currentScenarioKey] || null : null;

  // Apply theme to document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleSelectScenario = (key: string) => {
    setCurrentScenarioKey(key);
    if (key && SCENARIOS[key]) {
      const s = SCENARIOS[key];
      setCoordinates(`${s.lat.toFixed(4)}°N, ${s.lng.toFixed(4)}°E`);
    } else {
      setCoordinates('13.5000°N, 71.0000°E (National Overview)');
    }
  };

  const handleSearchPlace = (query: string) => {
    const q = query.toLowerCase();
    if (q.includes('mumbai')) handleSelectScenario('INC-001');
    else if (q.includes('chennai') || q.includes('ennore')) handleSelectScenario('INC-002');
    else if (q.includes('andaman') || q.includes('malacca')) handleSelectScenario('INC-003');
    else if (q.includes('goa')) handleSelectScenario('INC-004');
    else {
      alert(`Maritime Place Search: Found location coordinates for "${query}". Navigating chart.`);
    }
  };

  // Keyboard navigation shortcuts (1-7, Escape)
  useEffect(() => {
    const tabs: TabType[] = ['dashboard', 'investigation', 'drift', 'attribution', 'evidence', 'analytics', 'detection'];
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      const k = parseInt(e.key, 10);
      if (k >= 1 && k <= 7) {
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
      {/* TOPBAR */}
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

      {/* SIDEBAR */}
      <Sidebar activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* MAIN CONTAINER */}
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
            onSelectTab={setActiveTab}
            onOpenForensicModal={() => setIsForensicOpen(true)}
            onUpdateCoords={setCoordinates}
            onSelectScenario={handleSelectScenario}
          />
        )}

        {activeTab === 'investigation' && (
          <InvestigationView
            onSelectTab={setActiveTab}
            onOpenForensicModal={() => setIsForensicOpen(true)}
          />
        )}

        {activeTab === 'drift' && <DriftView onSelectTab={setActiveTab} />}

        {activeTab === 'attribution' && <AttributionView />}

        {activeTab === 'evidence' && (
          <EvidenceView onOpenForensicModal={() => setIsForensicOpen(true)} />
        )}

        {activeTab === 'analytics' && <AnalyticsView />}

        {activeTab === 'detection' && <DetectionView onSelectTab={setActiveTab} />}
      </main>

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

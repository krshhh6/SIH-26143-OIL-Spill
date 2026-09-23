import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Scenario, TabType } from '../types/dashboard';
import { SCENARIOS } from '../data/scenarios';
import { searchMaritimeCatalog, parseGpsCoordinates, type MaritimeSearchResult } from '../services/maritimeSearchService';

interface TopbarProps {
  activeTab?: TabType;
  onSelectTab?: (tab: TabType) => void;
  currentScenario: Scenario | null;
  currentScenarioKey: string;
  onSelectScenario: (key: string) => void;
  coordinates: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenForensicModal: () => void;
  onOpenSentinelHubModal: () => void;
  onOpenBhoonidhiModal: () => void;
  onSearchPlace?: (query: string) => void;
  onSelectSearchResult?: (result: MaritimeSearchResult) => void;
  scenarios?: Record<string, Scenario>;
}

export const Topbar: React.FC<TopbarProps> = ({
  activeTab = 'dashboard',
  onSelectTab,
  currentScenario,
  currentScenarioKey,
  onSelectScenario,
  coordinates,
  theme,
  onToggleTheme,
  onOpenForensicModal,
  onOpenSentinelHubModal: _onOpenSentinelHubModal,
  onOpenBhoonidhiModal: _onOpenBhoonidhiModal,
  onSearchPlace,
  onSelectSearchResult,
  scenarios,
}) => {
  const isDashboard = activeTab === 'dashboard';

  const [searchInput, setSearchInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeScenarios = scenarios || SCENARIOS;
  const searchResults = useMemo(() => {
    return searchMaritimeCatalog(searchInput, activeScenarios);
  }, [searchInput, activeScenarios]);

  // Click outside listener to dismiss search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectResult = (result: MaritimeSearchResult) => {
    setIsOpen(false);
    setSearchInput(result.title);
    if (onSelectSearchResult) {
      onSelectSearchResult(result);
    } else if (result.scenarioKey) {
      onSelectScenario(result.scenarioKey);
    } else if (onSearchPlace) {
      onSearchPlace(result.title);
    }
  };

  const handleExecuteSearch = () => {
    if (!searchInput.trim()) return;
    if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
      handleSelectResult(searchResults[selectedIndex]);
      return;
    }
    if (searchResults.length > 0) {
      handleSelectResult(searchResults[0]);
      return;
    }

    const coords = parseGpsCoordinates(searchInput);
    if (coords) {
      handleSelectResult({
        id: 'coord-custom',
        title: `GPS Coordinates: ${coords.lat.toFixed(4)}°N, ${coords.lng.toFixed(4)}°E`,
        category: 'coordinate',
        lat: coords.lat,
        lng: coords.lng,
        zoom: 12,
        sub: 'Direct nautical coordinate inspection',
        badge: 'COORDINATES',
        badgeColor: '#0284C7',
        icon: 'pin_drop',
      });
      return;
    }

    if (onSearchPlace) {
      onSearchPlace(searchInput.trim());
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen && searchResults.length > 0) {
        setIsOpen(true);
      }
      setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleExecuteSearch();
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const statusColor = !currentScenario
    ? '#0284C7'
    : currentScenario.sev.includes('CRITICAL')
    ? '#EF4444'
    : currentScenario.sev.includes('HIGH')
    ? '#F97316'
    : '#F59E0B';

  if (!isDashboard) {
    return (
      <header className="topbar topbar-compact">
        {/* BRAND LOGO ONLY */}
        <div
          className="topbar-logo"
          style={{ padding: 0, gap: '12px', cursor: onSelectTab ? 'pointer' : 'default' }}
          onClick={() => onSelectTab && onSelectTab('dashboard')}
          title="Return to Main Dashboard"
        >
          <img src="/clean_raw_logo.png" alt="Spill Sense Logo" style={{ height: '40px', width: 'auto', objectFit: 'contain' }} />
          <div>
            <div className="logo-name">SPILL SENSE</div>
            <div className="logo-sub">MARITIME C2 INTELLIGENCE</div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="topbar">
      {/* BRAND LOGO */}
      <div className="topbar-logo" style={{ padding: 0, gap: '12px' }}>
        <img src="/clean_raw_logo.png" alt="Spill Sense Logo" style={{ height: '40px', width: 'auto', objectFit: 'contain' }} />
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
          title={currentScenario ? `Active Status: ${currentScenario.sev}` : 'National EEZ Overview: 4 Monitored Spills'}
        ></span>
        <select
          id="scenario-dropdown"
          className="scenario-select-styled"
          value={currentScenarioKey}
          onChange={(e) => onSelectScenario(e.target.value)}
          title="Switch Active Maritime Spill Incident"
        >
          <option value="">Select monitored incident...</option>
          {Object.entries(activeScenarios).map(([key, s]) => (
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
        <div
          className={`search-pill-container ${isOpen && searchInput.trim().length > 0 ? 'active-open' : ''}`}
          ref={searchContainerRef}
        >
          <button
            type="button"
            className="search-pill-icon-btn"
            onClick={handleExecuteSearch}
            title="Search port, strait, vessel, or spill incident"
          >
            <span className="material-symbols-outlined search-pill-icon">
              search
            </span>
          </button>
          <input
            ref={inputRef}
            type="text"
            className="search-pill-input"
            placeholder="Search port, strait, vessel, spill..."
            value={searchInput}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => {
              setSearchInput(e.target.value);
              setIsOpen(true);
              setSelectedIndex(-1);
            }}
            onFocus={() => {
              if (searchInput.trim().length > 0) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
          />
          {searchInput.length > 0 && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => {
                setSearchInput('');
                setIsOpen(false);
                setSelectedIndex(-1);
                inputRef.current?.focus();
              }}
              title="Clear search input"
            >
              ✕
            </button>
          )}
          <button
            type="button"
            className="search-kbd-btn"
            onClick={handleExecuteSearch}
            title="Press Enter or Click to search"
          >
            <span className="search-kbd">↵</span>
          </button>

          {/* Autocomplete / Search Results Dropdown */}
          {isOpen && searchInput.trim().length > 0 && (
            <div className="search-dropdown-menu">
              <div className="search-dropdown-header">
                <span>MARITIME INTELLIGENCE DIRECTORY</span>
                <span>{searchResults.length} match{searchResults.length === 1 ? '' : 'es'}</span>
              </div>

              {searchResults.length > 0 ? (
                <div className="search-dropdown-list">
                  {searchResults.map((item, idx) => (
                    <div
                      key={item.id}
                      className={`search-dropdown-item ${idx === selectedIndex ? 'selected' : ''}`}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => handleSelectResult(item)}
                    >
                      <div className="item-icon-wrap" style={{ color: item.badgeColor }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                          {item.icon}
                        </span>
                      </div>

                      <div className="item-info">
                        <div className="item-title-row">
                          <span className="item-title">{item.title}</span>
                          <span
                            className="item-badge"
                            style={{
                              borderColor: `${item.badgeColor}55`,
                              backgroundColor: `${item.badgeColor}18`,
                              color: item.badgeColor,
                            }}
                          >
                            {item.badge}
                          </span>
                        </div>
                        <div className="item-sub">{item.sub}</div>
                      </div>

                      <span className="material-symbols-outlined item-action-arrow">
                        arrow_forward
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="search-dropdown-empty">
                  <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--text-muted)' }}>
                    location_off
                  </span>
                  <div>No maritime port, strait, or incident matching "{searchInput}"</div>
                  <div className="search-dropdown-tip">
                    Tip: Enter GPS coordinates like <code>18.74, 71.21</code> or search <code>Mumbai</code>, <code>Ennore</code>, <code>Malacca</code>, <code>Crude Atlas</code>
                  </div>
                </div>
              )}

              <div className="search-dropdown-footer">
                <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
                <span><kbd>↵</kbd> Select</span>
                <span><kbd>Esc</kbd> Close</span>
              </div>
            </div>
          )}
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

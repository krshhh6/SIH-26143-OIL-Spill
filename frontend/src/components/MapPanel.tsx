import React, { useState, useEffect, useRef } from 'react';
import type { Scenario, BaseLayerType, CopernicusLayerId, CopernicusLayerInfo, DetectionResult } from '../types/dashboard';
import { LeafletMap } from './LeafletMap';
import { TimeScrubber } from './TimeScrubber';
import { runSentinel1Detection } from '../services/detectionService';
import { createAoiForScenario } from '../utils/geoContours';
import L from 'leaflet';

interface MapPanelProps {
  scenario: Scenario | null;
  onUpdateCoords: (coords: string) => void;
  onSelectScenario?: (key: string) => void;
}

const COPERNICUS_LAYERS: CopernicusLayerInfo[] = [
  {
    id: 'true-color',
    name: 'True color',
    bands: 'Based on bands B4, B3, B2',
    desc: 'Photorealistic natural ocean satellite imagery (Copernicus Browser standard).',
    badge: 'OPTICAL',
    badgeColor: '#0284C7',
    thumbBg: '#1e3a5f',
  },
  {
    id: 'sar-vv',
    name: 'SAR Decibel (VV Damping)',
    bands: 'Sentinel-1 C-SAR IW GRD',
    desc: 'Capillary wave depression (Δσ0 ≤ -8.4 dB). High-contrast oil slick boundary mask.',
    badge: 'RADAR P0',
    badgeColor: '#0891B2',
    thumbBg: '#0f2b38',
  },
  {
    id: 'swir-oil',
    name: 'Highlight Optimized (SWIR)',
    bands: 'SWIR B11 (1610nm), B12 (2190nm)',
    desc: 'Shortwave infrared absorption overtones. Highlights weathered crude emulsions.',
    badge: 'HYDROCARBON',
    badgeColor: '#B45309',
    thumbBg: '#3d2508',
  },
  {
    id: 'false-color',
    name: 'False color (CIR)',
    bands: 'Based on bands B8, B4, B3',
    desc: 'Near-Infrared CIR. Distinguishes biogenic Sargassum/algae blooms from mineral oil.',
    badge: 'ALGAE REJECT',
    badgeColor: '#DC2626',
    thumbBg: '#3b1212',
  },
  {
    id: 'ndwi',
    name: 'NDWI (Water Mask)',
    bands: 'Based on combination (B3 - B8)/(B3 + B8)',
    desc: 'Normalized Difference Water Index. Sharp boundary between open water and petroleum.',
    badge: 'WATER MASK',
    badgeColor: '#2563EB',
    thumbBg: '#14254b',
  },
  {
    id: 'thermal',
    name: 'Sea Surface Thermal Anomaly',
    bands: 'Copernicus SLSTR 1km Thermal IR',
    desc: 'Sea surface temperature gradient caused by evaporative cooling of volatile fractions.',
    badge: 'THERMAL',
    badgeColor: '#7C3AED',
    thumbBg: '#2a144b',
  },
];

export const MapPanel: React.FC<MapPanelProps> = ({ scenario, onUpdateCoords, onSelectScenario }) => {
  const [baseLayer2D, setBaseLayer2D] = useState<BaseLayerType>('satellite');
  const [showSeamarks, setShowSeamarks] = useState<boolean>(true);
  const [selectedCopernicusLayer, setSelectedCopernicusLayer] = useState<CopernicusLayerId>('true-color');
  const [isSideLayersOpen, setIsSideLayersOpen] = useState<boolean>(true);
  const [selectedMission, setSelectedMission] = useState<string>('Sentinel-1 C-SAR');
  const [layerOpacity, setLayerOpacity] = useState<number>(0.85);
  const [selectedDate, setSelectedDate] = useState<string>('2024-11-14');
  const [cloudCoverMax] = useState<number>(30);

  // Real Sentinel-1 SAR Detection Pipeline States
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);

  const leafletMapRef = useRef<L.Map | null>(null);

  // Run live Sentinel-1 SAR + U-Net inference on AOI
  const executeDetection = async () => {
    if (!scenario) {
      setDetectionResult(null);
      setIsDetecting(false);
      return;
    }
    setIsDetecting(true);
    const aoi = createAoiForScenario(scenario.lat, scenario.lng);
    const result = await runSentinel1Detection(aoi, undefined, 0.35);
    setDetectionResult(result);
    setIsDetecting(false);
  };

  // Trigger real detection whenever active scenario changes
  useEffect(() => {
    executeDetection();
  }, [scenario?.id]);

  const handleSelectBasemap = (layer: BaseLayerType) => {
    setBaseLayer2D(layer);
  };

  const handleSelectCopernicusLayer = (id: CopernicusLayerId) => {
    setSelectedCopernicusLayer(id);
    if (id === 'sar-vv') {
      setBaseLayer2D('sar');
    } else if (baseLayer2D === 'sar') {
      setBaseLayer2D('satellite');
    }
  };

  const handleFocusSpill = () => {
    if (leafletMapRef.current) {
      if (scenario) {
        leafletMapRef.current.flyTo([scenario.lat, scenario.lng], 12, { duration: 0.8 });
      } else {
        leafletMapRef.current.flyTo([13.5, 71.0], 3.75, { duration: 0.8 });
      }
    }
  };

  const handleStepDate = (deltaDays: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + deltaDays);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  return (
    <div className="map-panel" style={{ flex: 1, width: '100%', height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* MAP HEADER CONTROLS (3D GLOBE REMOVED) */}
      <div className="map-header">
        <div className="flex items-center gap-2">
          {/* Mission Indicator Tag */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(37, 99, 235, 0.1)',
              border: '1px solid rgba(37, 99, 235, 0.3)',
              borderRadius: 4,
              padding: '3px 8px',
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#2563EB',
                boxShadow: '0 0 8px #2563EB',
              }}
            ></span>
            <span
              style={{
                fontFamily: 'JetBrains Mono',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-primary)',
              }}
            >
              {selectedMission}
            </span>
          </div>

          <span className="badge badge-accent" style={{ fontSize: 10, padding: '2px 6px' }}>
            {isDetecting ? 'PROCESSING SAR PASS...' : '10M GROUND RESOLUTION'}
          </span>
        </div>

        {/* Real GIS Basemap Controls */}
        <div className="flex items-center gap-2">
          <div className="map-base-selector">
            <button
              className={`base-btn ${baseLayer2D === 'satellite' ? 'active' : ''}`}
              onClick={() => handleSelectBasemap('satellite')}
              title="Esri World Imagery / Copernicus Natural Satellite"
            >
              Satellite
            </button>
            <button
              className={`base-btn ${baseLayer2D === 'sar' ? 'active' : ''}`}
              onClick={() => handleSelectBasemap('sar')}
              title="Sentinel-1 C-SAR IW GRD Calibrated Radar Backscatter"
            >
              SAR-1 Radar
            </button>
            <button
              className={`base-btn ${baseLayer2D === 'carto-voyager' || baseLayer2D === 'opensea' ? 'active' : ''}`}
              onClick={() => handleSelectBasemap('carto-voyager')}
              title="Hydrographic / Nautical Chart"
            >
              Hydrographic
            </button>
            <button
              className={`base-btn ${baseLayer2D === 'carto-dark' || baseLayer2D === 'dark' ? 'active' : ''}`}
              onClick={() => handleSelectBasemap('carto-dark')}
              title="Dark Night Tactical Chart"
            >
              Dark Chart
            </button>
          </div>

          {/* Quick Action: Center / Focus Spill */}
          <button
            className="btn btn-secondary"
            onClick={handleFocusSpill}
            title="Recenter Camera on Detected Spill"
            style={{ padding: '4px 10px', fontSize: 11, gap: 5 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--slick-color)' }}>
              my_location
            </span>
            Focus Spill
          </button>

          {/* Seamarks Toggle */}
          <button
            className={`toggle-btn ${showSeamarks ? 'active' : ''}`}
            onClick={() => setShowSeamarks(!showSeamarks)}
            title="Toggle OpenSeaMap Buoys, Beacons & TSS"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>anchor</span>
            Seamarks
          </button>
        </div>
      </div>

      {/* MAP CANVAS & COPERNICUS BROWSER PANEL */}
      <div style={{ position: 'relative', flex: 1, display: 'flex', minHeight: 0, height: '100%', overflow: 'hidden' }}>
        {/* COPERNICUS BROWSER SIDE LAYER PANEL */}
        <div className={`copernicus-side-panel ${isSideLayersOpen ? '' : 'collapsed'}`}>
          <div className="copernicus-header" style={{ flexShrink: 0 }}>
            <div className="copernicus-brand">
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#38BDF8' }}>public</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.03em' }}>Copernicus Browser</div>
                <div style={{ fontSize: 9, color: '#94A3B8' }}>Data Space Ecosystem</div>
              </div>
            </div>
            <button
              className="copernicus-collapse-btn"
              onClick={() => setIsSideLayersOpen(false)}
              title="Collapse Copernicus Layers"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
            </button>
          </div>

          {/* Date Strip */}
          <div style={{ padding: '8px 12px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button className="btn btn-secondary" onClick={() => handleStepDate(-1)} style={{ padding: '2px 6px', fontSize: 10 }}>◀</button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={{
                    fontSize: 11,
                    fontFamily: 'JetBrains Mono',
                    padding: '2px 6px',
                    borderRadius: 4,
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#0F172A',
                  }}
                />
                <button className="btn btn-secondary" onClick={() => handleStepDate(1)} style={{ padding: '2px 6px', fontSize: 10 }}>▶</button>
              </div>
              <span className="chip" style={{ background: '#E0F2FE', color: '#0369A1', fontSize: 9, fontWeight: 700 }}>
                ☁ {cloudCoverMax}% Max
              </span>
            </div>
          </div>

          {/* Mission Configuration */}
          <div className="copernicus-config" style={{ flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                Mission:
              </span>
              <span style={{ fontSize: 9, color: '#16A34A', fontWeight: 600 }}>● S1 Pass Ingested</span>
            </div>
            <select
              value={selectedMission}
              onChange={(e) => {
                setSelectedMission(e.target.value);
                if (e.target.value.includes('SAR')) {
                  handleSelectCopernicusLayer('sar-vv');
                } else {
                  handleSelectCopernicusLayer('true-color');
                }
              }}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '4px 6px',
                borderRadius: 4,
                border: '1px solid #CBD5E1',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="Sentinel-1 C-SAR">Sentinel-1 C-SAR (Radar IW GRD 10m)</option>
              <option value="Sentinel-2 L2A">Sentinel-2 L2A (Optical MSI 10m)</option>
              <option value="Landsat-8/9 OLI">Landsat-8/9 OLI (Optical/Thermal)</option>
            </select>
          </div>

          {/* Real Spectral Layers */}
          <div className="copernicus-layers-list" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {COPERNICUS_LAYERS.map((layer) => {
              const isActive = selectedCopernicusLayer === layer.id;
              return (
                <div
                  key={layer.id}
                  className={`copernicus-layer-card ${isActive ? 'active' : ''}`}
                  onClick={() => handleSelectCopernicusLayer(layer.id)}
                >
                  <div className="layer-thumb" style={{ background: layer.thumbBg }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#FFFFFF' }}>
                      {layer.id === 'true-color'
                        ? 'photo_camera'
                        : layer.id === 'sar-vv'
                        ? 'radar'
                        : layer.id === 'swir-oil'
                        ? 'oil_barrel'
                        : layer.id === 'false-color'
                        ? 'nature'
                        : layer.id === 'ndwi'
                        ? 'waves'
                        : 'thermostat'}
                    </span>
                  </div>
                  <div className="layer-info">
                    <div className="layer-name">
                      <span>{layer.name}</span>
                      {isActive && (
                        <span style={{ fontSize: 9, color: '#0284C7', fontWeight: 800 }}>ACTIVE</span>
                      )}
                    </div>
                    <div className="layer-bands">{layer.bands}</div>
                    <div className="layer-desc">{layer.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Docked Layer Opacity Slider Footer */}
          <div
            className="copernicus-opacity-footer"
            style={{
              padding: '8px 12px',
              borderTop: '1px solid var(--border-default)',
              background: 'var(--bg-raised)',
              flexShrink: 0,
              marginTop: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 600, marginBottom: 4 }}>
              <span style={{ color: 'var(--text-muted)' }}>Layer Opacity:</span>
              <span className="mono" style={{ color: 'var(--accent)' }}>{Math.round(layerOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.15"
              max="1.0"
              step="0.05"
              value={layerOpacity}
              onChange={(e) => setLayerOpacity(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer', display: 'block' }}
            />
          </div>
        </div>

        {/* Collapse / Expand Tab Button */}
        {!isSideLayersOpen && (
          <button
            className="panel-toggle-btn"
            onClick={() => setIsSideLayersOpen(true)}
            title="Open Copernicus Layers"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>layers</span>
            Layers
          </button>
        )}

        {/* Dedicated 2D Leaflet Map Viewport */}
        <LeafletMap
          scenario={scenario}
          baseLayer={baseLayer2D}
          showSeamarks={showSeamarks}
          selectedCopernicusLayer={selectedCopernicusLayer}
          layerOpacity={layerOpacity}
          detectionResult={detectionResult}
          onUpdateCoords={onUpdateCoords}
          onSelectScenario={onSelectScenario}
          mapRef={leafletMapRef}
        />

        {/* Cartographic Legend (Superhuman Glassmorphic HUD at Bottom-Right) */}
        <div className="map-overlay-hud">
          <div className="hud-header">
            <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#38BDF8' }}>layers</span>
            <span className="hud-title">Maritime Surveillance Layers</span>
          </div>
          
          <div className="hud-row">
            <div className="lswatch" style={{ background: '#00E5FF' }}></div>
            <span><strong>Current Spill (T0)</strong>: <span style={{ color: '#38BDF8' }}>{scenario?.area || 'Monitored'}</span></span>
          </div>

          <div className="hud-row">
            <div className="lswatch" style={{ background: '#10B981', border: '1px dashed #10B981' }}></div>
            <span><strong>Predicted Drift (T+24h)</strong>: Forecast</span>
          </div>

          <div className="hud-row">
            <div className="lswatch" style={{ background: '#F59E0B' }}></div>
            <span><strong>Discharge Origin (T-22h)</strong>: Source</span>
          </div>

          <div className="hud-row">
            <div className="lswatch" style={{ background: '#D97706', border: '1px dashed #D97706' }}></div>
            <span><strong>Reverse Drift Track</strong>: Past 22h</span>
          </div>

          <div className="hud-row">
            <div className="lswatch" style={{ background: '#DC2626', border: '1px dashed #DC2626' }}></div>
            <span><strong>Suspect AIS Silence</strong>: Gap Segment</span>
          </div>

          <div className="hud-footer">
            <span className="hud-status-dot"></span>
            <span className="hud-model-tag">{detectionResult?.model_version || 'unet-s1-sar-sos-v2.4-cdse'}</span>
            <span className="hud-model-sub">CDSE SAR Engine</span>
          </div>
        </div>
      </div>

      <TimeScrubber />
    </div>
  );
};

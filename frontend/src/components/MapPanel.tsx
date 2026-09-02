import React, { useState, useEffect, useRef } from 'react';
import type { Scenario, DimensionMode, BaseLayerType, CesiumBaseLayerType, CopernicusLayerId, CopernicusLayerInfo, DetectionResult } from '../types/dashboard';
import { LeafletMap } from './LeafletMap';
import { CesiumGlobe } from './CesiumGlobe';
import { TimeScrubber } from './TimeScrubber';
import { runSentinel1Detection } from '../services/detectionService';
import { createAoiForScenario } from '../utils/geoContours';
import L from 'leaflet';

declare const Cesium: any;

interface MapPanelProps {
  scenario: Scenario;
  onUpdateCoords: (coords: string) => void;
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

export const MapPanel: React.FC<MapPanelProps> = ({ scenario, onUpdateCoords }) => {
  const [dimensionMode, setDimensionMode] = useState<DimensionMode>('2D');
  const [baseLayer2D, setBaseLayer2D] = useState<BaseLayerType>('satellite');
  const [baseLayer3D, setBaseLayer3D] = useState<CesiumBaseLayerType>('google');
  const [showSeamarks, setShowSeamarks] = useState<boolean>(true);
  const [selectedCopernicusLayer, setSelectedCopernicusLayer] = useState<CopernicusLayerId>('true-color');
  const [isSideLayersOpen, setIsSideLayersOpen] = useState<boolean>(true);
  const [selectedMission, setSelectedMission] = useState<string>('Sentinel-1 C-SAR');
  const [layerOpacity, setLayerOpacity] = useState<number>(0.75);
  const [selectedDate, setSelectedDate] = useState<string>('2024-11-14');
  const [cloudCoverMax] = useState<number>(30);

  // Real Sentinel-1 SAR Detection Pipeline States
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);

  const leafletMapRef = useRef<L.Map | null>(null);
  const cesiumViewerRef = useRef<any>(null);

  // Run live Sentinel-1 SAR + U-Net inference on AOI
  const executeDetection = async () => {
    setIsDetecting(true);
    const aoi = createAoiForScenario(scenario.lat, scenario.lng);
    const result = await runSentinel1Detection(aoi, undefined, 0.35);
    setDetectionResult(result);
    setIsDetecting(false);
  };

  // Trigger real detection whenever active scenario changes
  useEffect(() => {
    executeDetection();
  }, [scenario.id]);

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
      leafletMapRef.current.flyTo([scenario.lat, scenario.lng], 12, { duration: 0.8 });
    }
    if (cesiumViewerRef.current && typeof Cesium !== 'undefined') {
      cesiumViewerRef.current.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(scenario.lng, scenario.lat - 0.08, 45000),
        orientation: { heading: 0.0, pitch: Cesium.Math.toRadians(-45.0), roll: 0.0 },
        duration: 1.2,
      });
    }
  };

  const handleStepDate = (deltaDays: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + deltaDays);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  return (
    <div className="map-panel" style={{ flex: 1, width: '100%', minHeight: 460, height: '100%' }}>
      {/* REAL SENTINEL-1 PASS ACQUISITION TELEMETRY STRIP */}
      <div
        style={{
          background: 'var(--bg-raised)',
          borderBottom: '1px solid var(--border-default)',
          padding: '6px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 11,
          fontFamily: 'JetBrains Mono',
          color: 'var(--text-secondary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#0284C7' }}>satellite_alt</span>
          <span>
            Detection based on Sentinel-1 pass:{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {detectionResult?.scene_timestamp
                ? new Date(detectionResult.scene_timestamp).toUTCString().replace('GMT', 'UTC')
                : 'Querying CDSE Catalogue...'}
            </strong>{' '}
            <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>(Orbital Revisit: 6–12 days · Not continuous stream)</span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isDetecting ? (
            <span className="chip chip-run" style={{ fontSize: 9 }}>
              ● FETCHING SAR TILES &amp; RUNNING U-NET INFERENCE...
            </span>
          ) : detectionResult?.status === 'detected' ? (
            <span className="chip chip-c" style={{ fontSize: 9, fontWeight: 800 }}>
              🚨 SLICK DETECTED: {detectionResult.total_detected_area_km2} km² ({detectionResult.model_version})
            </span>
          ) : detectionResult?.status === 'no_oil_detected' ? (
            <span className="chip chip-ok" style={{ fontSize: 9 }}>
              ✓ CLEAN WATER · NO HYDROCARBON SIGNATURE IN PASS
            </span>
          ) : detectionResult?.status === 'error' ? (
            <span className="chip chip-c" style={{ fontSize: 9 }}>
              ⚠ DETECTION API OFFLINE
            </span>
          ) : null}

          <button
            className="btn btn-primary"
            onClick={executeDetection}
            disabled={isDetecting}
            style={{ padding: '3px 10px', fontSize: 11, gap: 5 }}
            title="Search CDSE catalogue for the latest Sentinel-1 pass and run U-Net inference"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
              {isDetecting ? 'sync' : 'refresh'}
            </span>
            {isDetecting ? 'Analyzing...' : 'Refresh Latest Pass'}
          </button>
        </div>
      </div>

      {/* REAL GIS TOOLBAR HEADER */}
      <div className="map-header">
        <div className="flex items-center gap-2">
          <span className="panel-title">
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#0284C7' }}>radar</span>
            Sentinel-1 C-SAR IW GRD Pipeline
          </span>
          <span className="chip" style={{ background: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1', fontSize: 9 }}>
            10m Ground Resolution
          </span>
        </div>

        {/* Real GIS Layer & Dimension Controls */}
        <div className="flex items-center gap-2">
          {/* Dimension Mode Toggle (2D / 3D) */}
          <div className="map-base-selector">
            <button
              className={`base-btn ${dimensionMode === '2D' ? 'active' : ''}`}
              onClick={() => {
                setDimensionMode('2D');
                setTimeout(() => leafletMapRef.current?.invalidateSize(), 100);
              }}
              title="2D Multispectral Earth Observation Chart"
            >
              2D GIS Map
            </button>
            <button
              className={`base-btn ${dimensionMode === '3D' ? 'active' : ''}`}
              onClick={() => {
                setDimensionMode('3D');
                setTimeout(() => handleFocusSpill(), 150);
              }}
              title="3D Virtual Globe View"
            >
              3D Globe
            </button>
          </div>

          {/* 2D Real Basemap Selector */}
          {dimensionMode === '2D' && (
            <div className="map-base-selector">
              <button
                className={`base-btn ${baseLayer2D === 'satellite' ? 'active' : ''}`}
                onClick={() => handleSelectBasemap('satellite')}
                title="Esri World Imagery / Copernicus Natural Satellite"
              >
                Satellite (True Color)
              </button>
              <button
                className={`base-btn ${baseLayer2D === 'sar' ? 'active' : ''}`}
                onClick={() => handleSelectBasemap('sar')}
                title="Sentinel-1 C-SAR IW GRD Calibrated Radar Backscatter"
              >
                SAR-1 (VV Radar)
              </button>
              <button
                className={`base-btn ${baseLayer2D === 'carto-voyager' || baseLayer2D === 'opensea' ? 'active' : ''}`}
                onClick={() => handleSelectBasemap('carto-voyager')}
                title="CartoDB Voyager Bathymetry & Nautical Topo"
              >
                Nautical Topo
              </button>
              <button
                className={`base-btn ${baseLayer2D === 'carto-dark' || baseLayer2D === 'dark' ? 'active' : ''}`}
                onClick={() => handleSelectBasemap('carto-dark')}
                title="CartoDB Dark Matter S-57 ECDIS Night"
              >
                Dark ECDIS
              </button>
            </div>
          )}

          {/* 3D Globe Basemaps */}
          {dimensionMode === '3D' && (
            <div className="map-base-selector">
              <button
                className={`base-btn ${baseLayer3D === 'google' ? 'active' : ''}`}
                onClick={() => setBaseLayer3D('google')}
              >
                Photorealistic 3D
              </button>
              <button
                className={`base-btn ${baseLayer3D === 'esri' ? 'active' : ''}`}
                onClick={() => setBaseLayer3D('esri')}
              >
                Esri World 3D
              </button>
            </div>
          )}

          {/* Focus Spill Camera Re-center */}
          <button
            className="btn btn-secondary"
            onClick={handleFocusSpill}
            title="Recenter viewport to detected oil spill"
            style={{ padding: '3px 9px', fontSize: 11, gap: 4 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--accent)' }}>my_location</span>
            Center Spill
          </button>

          {/* Seamarks Toggle */}
          {dimensionMode === '2D' && (
            <button
              className={`toggle-btn ${showSeamarks ? 'active' : ''}`}
              onClick={() => setShowSeamarks(!showSeamarks)}
              title="Toggle OpenSeaMap Buoys, Beacons & TSS"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>anchor</span>
              Seamarks
            </button>
          )}
        </div>
      </div>

      {/* MAP CANVAS & COPERNICUS BROWSER PANEL */}
      <div style={{ position: 'relative', flex: 1, display: 'flex', minHeight: 520, overflow: 'hidden' }}>
        {/* COPERNICUS BROWSER SIDE LAYER PANEL */}
        {dimensionMode === '2D' && (
          <div className={`copernicus-side-panel ${isSideLayersOpen ? '' : 'collapsed'}`}>
            <div className="copernicus-header">
              <div className="copernicus-brand">
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#38BDF8' }}>public</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.03em' }}>Copernicus Browser</div>
                  <div style={{ fontSize: 9, color: '#94A3B8' }}>Data Space Ecosystem</div>
                </div>
              </div>
              <button
                className="btn-icon"
                onClick={() => setIsSideLayersOpen(false)}
                title="Collapse Copernicus Layers"
                style={{ color: '#FFFFFF', padding: 2, width: 26, height: 26 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span>
              </button>
            </div>

            {/* Date Strip */}
            <div style={{ padding: '8px 12px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button className="btn btn-secondary" onClick={() => handleStepDate(-1)} style={{ padding: '2px 6px', fontSize: 10 }}>◀</button>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                    }}
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
            <div className="copernicus-config">
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
            <div className="copernicus-layers-list">
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

            {/* Layer Opacity Slider */}
            <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border-default)', background: 'var(--bg-raised)' }}>
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
                style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
            </div>
          </div>
        )}

        {/* Collapse / Expand Tab Button */}
        {dimensionMode === '2D' && !isSideLayersOpen && (
          <button
            className="panel-toggle-btn"
            onClick={() => setIsSideLayersOpen(true)}
            title="Open Copernicus Layers"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>layers</span>
            Layers
          </button>
        )}

        {/* Neutral State Banner when no oil is detected */}
        {detectionResult?.status === 'no_oil_detected' && (
          <div
            style={{
              position: 'absolute',
              top: 14,
              left: isSideLayersOpen ? 336 : 14,
              zIndex: 420,
              background: 'rgba(15, 23, 42, 0.90)',
              border: '1px solid #334155',
              borderRadius: 6,
              padding: '8px 14px',
              color: '#F8FAFC',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#22C55E' }}>check_circle</span>
            <div>
              <div style={{ fontWeight: 700 }}>Clean Ocean Water Verified</div>
              <div style={{ fontSize: 10, color: '#94A3B8' }}>{detectionResult.message}</div>
            </div>
          </div>
        )}

        {/* Real Leaflet Map Viewport */}
        {dimensionMode === '2D' ? (
          <LeafletMap
            scenario={scenario}
            baseLayer={baseLayer2D}
            showSeamarks={showSeamarks}
            selectedCopernicusLayer={selectedCopernicusLayer}
            layerOpacity={layerOpacity}
            detectionResult={detectionResult}
            onUpdateCoords={onUpdateCoords}
            mapRef={leafletMapRef}
          />
        ) : (
          <CesiumGlobe
            scenario={scenario}
            cesiumBaseLayer={baseLayer3D}
            visible={dimensionMode === '3D'}
            cesiumViewerRef={cesiumViewerRef}
          />
        )}

        {/* Cartographic Legend */}
        <div className="map-overlay-hud" style={{ right: 14, left: 'auto', top: 14 }}>
          <div className="hud-title">Cartographic Layers</div>
          
          <div className="hud-row">
            <div
              className="lswatch"
              style={{
                background:
                  selectedCopernicusLayer === 'sar-vv'
                    ? '#0891B2'
                    : selectedCopernicusLayer === 'swir-oil'
                    ? '#B45309'
                    : '#0369A1',
                borderRadius: 2,
              }}
            ></div>
            <span>
              {detectionResult?.status === 'detected'
                ? `Detected Slick (${detectionResult.total_detected_area_km2} km²)`
                : 'No Slick Detected'}
            </span>
          </div>

          {detectionResult?.status === 'detected' && (
            <>
              <div className="hud-row">
                <div className="lswatch" style={{ background: '#92400E', borderRadius: 2 }}></div>
                <span>50% Core Origin Envelope</span>
              </div>
              <div className="hud-row">
                <div className="lswatch" style={{ background: 'rgba(180, 83, 9, 0.25)', border: '1px dashed #B45309', borderRadius: 2 }}></div>
                <span>75% / 90% Probability Isobars</span>
              </div>
              <div className="hud-row">
                <div className="lswatch" style={{ background: '#D97706', borderRadius: 2 }}></div>
                <span>Reverse Drift Trajectory</span>
              </div>
            </>
          )}

          <div className="hud-row">
            <div className="lswatch" style={{ background: '#64748B', borderRadius: 2 }}></div>
            <span>AIS Vessel Track</span>
          </div>

          <div style={{ borderTop: '1px solid var(--border-default)', margin: '6px 0 4px', paddingTop: 4 }}>
            <div className="hud-title" style={{ marginBottom: 2 }}>Model Engine</div>
            <div style={{ fontSize: 10, color: 'var(--text-primary)', fontWeight: 700 }}>
              {detectionResult?.model_version || 'unet-s1-sar-sos-v2.4-cdse'}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
              SOS Benchmark (Krestenitis et al.)
            </div>
          </div>
        </div>
      </div>

      <TimeScrubber />
    </div>
  );
};

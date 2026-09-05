import React, { useState, useRef, useEffect } from 'react';
import type { Scenario, TabType } from '../../types/dashboard';

interface InvestigationViewProps {
  onSelectTab: (tab: TabType) => void;
  onOpenForensicModal: () => void;
  currentScenario?: Scenario | null;
  currentScenarioKey?: string;
}

interface CopernicusLayer {
  id: string;
  label: string;
  badge: string;
  desc: string;
}

const COPERNICUS_LAYERS_DATA: Record<string, CopernicusLayer[]> = {
  S1: [
    { id: 'sar-vv', label: 'SAR Backscatter (VV dB)', badge: 'Capillary Damping', desc: 'Primary detection channel. Measures surface tension depression (Δσ0 = -8.4 dB).' },
    { id: 'sar-vh', label: 'SAR Cross-Pol (VH dB)', badge: 'Vessel Scattering', desc: 'Cross-polarization for vessel hull metallic Bragg reflections.' },
    { id: 'sar-wind', label: 'Sentinel-1 OCN (In-Situ Wind)', badge: 'In-Situ 4.2 m/s', desc: 'Instantaneous 10m neutral ocean wind speed (3.0–12.0 m/s validity window).' },
    { id: 'swir', label: 'SWIR Hydrocarbon Index', badge: 'Emulsified Oil', desc: 'Identifies heavy hydrocarbon absorption overtones at 1610nm & 2190nm.' },
    { id: 'fai', label: 'Floating Algae Index (FAI)', badge: 'Look-Alike Filter', desc: 'Floating Algae Index to reject biogenic phytoplankton and Sargassum.' },
  ],
  S2: [
    { id: 's2-rgb', label: 'True Color (RGB B4, B3, B2)', badge: '10m Optical', desc: 'Natural color visualization of surface sheen and coastal waters.' },
    { id: 's2-false', label: 'False Color Infrared (B8, B4, B3)', badge: '10m NIR', desc: 'Near-Infrared band separates organic vegetation from mineral oil films.' },
    { id: 'swir', label: 'SWIR Hydrocarbon Emulsion', badge: 'Hydrocarbon Bands', desc: 'High contrast for weathered crude and "chocolate mousse" emulsions.' },
    { id: 'fai', label: 'Floating Algae Index (FAI)', badge: 'Biogenic Rejection', desc: 'FAI thresholding (> 0.04) discards false algae look-alikes.' },
  ],
  S3: [
    { id: 's3-chl', label: 'OLCI Chlorophyll-a (CHL_NN)', badge: '300m Resolution', desc: 'Detects large-scale dinoflagellate and red tide blooms.' },
    { id: 's3-sst', label: 'SLSTR Sea Surface Temp (SST)', badge: '0.1K Radiometry', desc: 'Maps cold thermal upwelling ocean fronts that trap natural surfactants.' },
  ],
  S6: [
    { id: 's6-alt', label: 'Poseidon-4 Radar Altimetry', badge: 'Geostrophic Current', desc: 'Validates surface geostrophic current vectors (ug, vg) for drift modeling.' },
  ],
};

export const InvestigationView: React.FC<InvestigationViewProps> = ({
  onSelectTab,
  onOpenForensicModal,
  currentScenario,
  currentScenarioKey,
}) => {
  const [activeMission, setActiveMission] = useState<string>('S1');
  const [activeLayer, setActiveLayer] = useState<string>('sar-vv');
  const [cloudCoverage, setCloudCoverage] = useState<number>(15);
  const [splitPercent, setSplitPercent] = useState<number>(50);
  const [customImageSrc, setCustomImageSrc] = useState<string | null>(null);
  const [selectedChipName, setSelectedChipName] = useState<string>('Incident SAR Scene (Mumbai High)');

  const splitViewerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDraggingRef = useRef<boolean>(false);

  const scenarioKey = currentScenarioKey || 'INC-001';
  const incidentTitle = currentScenario?.title || 'Mumbai High Offshore Basin';
  const incidentArea = currentScenario?.area || '4.82 km²';
  const incidentCoords = currentScenario ? `${currentScenario.lat.toFixed(3)}°N, ${currentScenario.lng.toFixed(3)}°E` : '18.743°N, 71.218°E';

  // Compute active real satellite photo source
  let activeImageSrc = `/imagery/sar_${scenarioKey}.png`;
  if (customImageSrc) {
    activeImageSrc = customImageSrc;
  } else if (activeMission === 'S1') {
    if (activeLayer === 'sar-vh') {
      activeImageSrc = `/imagery/vh_${scenarioKey}.png`;
    } else {
      activeImageSrc = `/imagery/sar_${scenarioKey}.png`;
    }
  } else if (activeMission === 'S2') {
    if (activeLayer === 's2-false') {
      activeImageSrc = `/imagery/cir_${scenarioKey}.png`;
    } else if (activeLayer === 'swir') {
      activeImageSrc = `/imagery/swir_${scenarioKey}.png`;
    } else {
      activeImageSrc = `/imagery/tc_${scenarioKey}.png`;
    }
  } else if (activeMission === 'S3') {
    activeImageSrc = `/imagery/eos04_${scenarioKey}.png`;
  } else if (activeMission === 'S6') {
    activeImageSrc = `/imagery/nisar_${scenarioKey}.png`;
  }

  // Split slider mouse/touch drag handler
  useEffect(() => {
    const handleMove = (clientX: number) => {
      if (!isDraggingRef.current || !splitViewerRef.current) return;
      const rect = splitViewerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      setSplitPercent((x / rect.width) * 100);
    };

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handleMove(e.touches[0].clientX);
    };
    const onEnd = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, []);

  const getMissionBadge = () => {
    if (activeMission === 'S1') return 'SENTINEL-1 C-SAR (VARUNA NETRA)';
    if (activeMission === 'S2') return 'SENTINEL-2 MSI OPTICAL (DIVYA DRISHTI)';
    if (activeMission === 'S3') return 'SENTINEL-3 / EOS-04 (SAMUDRA DRISHTI)';
    if (activeMission === 'S6') return 'SENTINEL-6 / NISAR (ALTIMETRY)';
    return 'VARUNA MULTI-MISSION OBSERVATORY';
  };

  const getTelemetryChip = () => {
    if (activeMission === 'S1') return 'Sentinel-1A IW GRD · C-SAR 5.4 GHz · Descending Orbit · 10m Res';
    if (activeMission === 'S2') return 'Sentinel-2B MSI L2A · 13 Spectral Bands · BOA Reflectance · 10m Res';
    if (activeMission === 'S3') return 'ISRO EOS-04 / Sentinel-3 · 300m Ocean Colour · Daily Marine Revisit';
    if (activeMission === 'S6') return 'NASA-ISRO NISAR / S6 · Dual-Freq L+S Radar · Geostrophic Currents';
    return '';
  };

  const launchSatellitePortal = () => {
    window.open('https://browser.dataspace.copernicus.eu/', '_blank');
  };

  return (
    <div id="tab-investigation" className="tab-content visible">
      {/* PAGE HEADER */}
      <div className="page-header" style={{ paddingTop: 'var(--sp-4)' }}>
        <div>
          <div className="flex items-center gap-3">
            <div className="page-title">Varuna-Drishti Satellite Studio &amp; SAR Look-Alike Validation</div>
            <span className="id-tag">{getMissionBadge()}</span>
            <span className="chip chip-c">VARUNA SPACE ENGINE · SAMUDRA-NETRA</span>
          </div>
          <div className="page-subtitle">
            Vedic maritime surveillance · {incidentTitle} ({incidentCoords}) · Calibrated SAR backscatter cross-sections &amp; look-alike suppression
          </div>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-secondary flex items-center gap-1"
            onClick={launchSatellitePortal}
            title="Launch Space Agency Data Portal"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
            Copernicus Browser
          </button>
          <button className="btn btn-secondary" onClick={onOpenForensicModal}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>verified</span>
            Generate Dossier
          </button>
          <button className="btn btn-primary" onClick={() => onSelectTab('drift')}>
            Drift Analysis
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
          </button>
        </div>
      </div>

      {/* SATELLITE MISSION SELECTOR BAR */}
      <div
        style={{
          margin: '0 var(--sp-6) var(--sp-3)',
          padding: '8px 12px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Mission:
          </span>
          <div className="map-base-selector">
            <button
              className={`base-btn ${activeMission === 'S1' ? 'active' : ''}`}
              onClick={() => {
                setActiveMission('S1');
                setActiveLayer('sar-vv');
                setCustomImageSrc(null);
                setSelectedChipName(`Incident ${scenarioKey} SAR Scene`);
              }}
            >
              Sentinel-1 (SAR)
            </button>
            <button
              className={`base-btn ${activeMission === 'S2' ? 'active' : ''}`}
              onClick={() => {
                setActiveMission('S2');
                setActiveLayer('s2-rgb');
                setCustomImageSrc(null);
                setSelectedChipName(`Incident ${scenarioKey} Optical True Color`);
              }}
            >
              Sentinel-2 (Optical)
            </button>
            <button
              className={`base-btn ${activeMission === 'S3' ? 'active' : ''}`}
              onClick={() => {
                setActiveMission('S3');
                setActiveLayer('s3-chl');
                setCustomImageSrc(null);
                setSelectedChipName(`ISRO EOS-04 / S3 Ocean Scene`);
              }}
            >
              Sentinel-3 / EOS-04
            </button>
            <button
              className={`base-btn ${activeMission === 'S6' ? 'active' : ''}`}
              onClick={() => {
                setActiveMission('S6');
                setActiveLayer('s6-alt');
                setCustomImageSrc(null);
                setSelectedChipName(`NISAR / S6 Altimetry`);
              }}
            >
              Sentinel-6 / NISAR
            </button>
          </div>
        </div>

        {/* Optical Cloud Filter (only shown for S2 / S3) */}
        {(activeMission === 'S2' || activeMission === 'S3') && (
          <div className="flex items-center gap-2" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            <span>Max Cloud Cover:</span>
            <input
              type="range"
              min="0"
              max="100"
              value={cloudCoverage}
              onChange={(e) => setCloudCoverage(parseInt(e.target.value, 10))}
              style={{ width: 80, height: 4 }}
            />
            <span className="mono fw-700">{cloudCoverage}%</span>
          </div>
        )}

        <div className="mono text-xs text-muted" style={{ fontSize: 11 }}>
          {getTelemetryChip()}
        </div>
      </div>

      {/* SPECTRAL LAYER PRESETS BAR */}
      <div
        style={{
          margin: '0 var(--sp-6) var(--sp-3)',
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginRight: 4 }}>
          Spectral Layer:
        </span>
        {COPERNICUS_LAYERS_DATA[activeMission]?.map((lyr) => (
          <button
            key={lyr.id}
            className={`toggle-btn ${activeLayer === lyr.id && !customImageSrc ? 'active' : ''}`}
            onClick={() => {
              setActiveLayer(lyr.id);
              setCustomImageSrc(null);
              setSelectedChipName(`${scenarioKey} - ${lyr.label}`);
            }}
            title={lyr.desc}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#06B6D4', display: 'inline-block' }}></span>
            {lyr.label}
            <span
              style={{
                fontSize: 9,
                padding: '1px 4px',
                borderRadius: 2,
                background: 'rgba(0,0,0,0.15)',
                marginLeft: 4,
              }}
            >
              {lyr.badge}
            </span>
          </button>
        ))}
      </div>

      <div className="inv-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          {/* DUAL-PANE REAL SATELLITE PHOTO SPLIT SLIDER */}
          <div className="panel">
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>compare</span>
                Dual-Pane Split: Raw Real Satellite Photo (Left) vs AI U-Net Detection (Right)
              </span>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 11, color: '#06B6D4', background: 'rgba(6,182,212,0.15)', padding: '2px 8px', borderRadius: 4, fontFamily: 'var(--font-mono)' }}>
                  {selectedChipName}
                </span>
                <span className="text-xs text-muted">Drag handle to inspect</span>
              </div>
            </div>

            {/* QUICK REAL-IMAGE CHIPS & UPLOAD BAR */}
            <div
              style={{
                padding: '8px 12px',
                background: 'rgba(0, 0, 0, 0.2)',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Real SAR Photo Chips:
                </span>
                <button
                  className={`btn btn-xs ${!customImageSrc ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: 11, padding: '2px 8px' }}
                  onClick={() => {
                    setCustomImageSrc(null);
                    setSelectedChipName(`${scenarioKey} Full Satellite Scene`);
                  }}
                >
                  🛰️ {scenarioKey} Full Scene
                </button>
                <button
                  className={`btn btn-xs ${customImageSrc === '/demo-sar/class_1_01.jpg' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: 11, padding: '2px 8px' }}
                  onClick={() => {
                    setCustomImageSrc('/demo-sar/class_1_01.jpg');
                    setSelectedChipName('Slick Chip 1 (Sentinel-1 SAR)');
                  }}
                >
                  🛢️ Slick Chip 1
                </button>
                <button
                  className={`btn btn-xs ${customImageSrc === '/demo-sar/class_1_02.jpg' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: 11, padding: '2px 8px' }}
                  onClick={() => {
                    setCustomImageSrc('/demo-sar/class_1_02.jpg');
                    setSelectedChipName('Slick Chip 2 (Sentinel-1 SAR)');
                  }}
                >
                  🛢️ Slick Chip 2
                </button>
                <button
                  className={`btn btn-xs ${customImageSrc === '/demo-sar/class_0_01.jpg' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: 11, padding: '2px 8px' }}
                  onClick={() => {
                    setCustomImageSrc('/demo-sar/class_0_01.jpg');
                    setSelectedChipName('Look-Alike 1 (Low Wind Clutter)');
                  }}
                >
                  🌊 Look-Alike 1
                </button>
                <button
                  className={`btn btn-xs ${customImageSrc === '/demo-sar/class_0_02.jpg' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: 11, padding: '2px 8px' }}
                  onClick={() => {
                    setCustomImageSrc('/demo-sar/class_0_02.jpg');
                    setSelectedChipName('Look-Alike 2 (Calm Sea)');
                  }}
                >
                  🌊 Look-Alike 2
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  className="btn btn-xs btn-secondary flex items-center gap-1"
                  style={{ fontSize: 11, padding: '2px 8px' }}
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload any real satellite / SAR photo (.png, .jpg, .tif)"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>upload_file</span>
                  Upload Real Photo
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept=".png,.jpg,.jpeg,.tif,.tiff"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const url = URL.createObjectURL(file);
                      setCustomImageSrc(url);
                      setSelectedChipName(`Custom: ${file.name}`);
                    }
                  }}
                />
              </div>
            </div>

            <div className="panel-body" style={{ padding: 'var(--sp-3)' }}>
              <div
                className="split-viewer"
                ref={splitViewerRef}
                style={{ height: 280, position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius)', cursor: 'ew-resize' }}
                onMouseDown={() => {
                  isDraggingRef.current = true;
                }}
              >
                {/* Under Pane (Right: Real Satellite Photo + AI Segmented Mask + Tactical HUD) */}
                <div className="split-pane left" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                  <img
                    src={activeImageSrc}
                    alt="Real Satellite AI Overlay"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = '/imagery/sar_vv_damping.png';
                    }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {/* AI U-Net Mask Draped Directly Over the Real Photo */}
                  <svg
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                    viewBox="0 0 600 280"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3.5" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                    </defs>

                    {/* Detected Slick Polygon with Neon Cyan Glow */}
                    <path
                      d="M 220 110 Q 250 85 300 95 Q 350 75 400 100 Q 430 90 450 118 Q 420 155 370 150 Q 310 160 260 145 Z"
                      fill="rgba(0, 229, 255, 0.42)"
                      stroke="#00E5FF"
                      strokeWidth="2.5"
                      filter="url(#glow-cyan)"
                    />

                    {/* Tactical Target Reticle & HUD */}
                    <rect x="210" y="70" width="250" height="95" fill="none" stroke="rgba(0, 229, 255, 0.45)" strokeWidth="1" strokeDasharray="4,4" />
                    <circle cx="340" cy="120" r="4" fill="#00E5FF" />
                    <line x1="330" y1="120" x2="350" y2="120" stroke="#00E5FF" strokeWidth="1.5" />
                    <line x1="340" y1="110" x2="340" y2="130" stroke="#00E5FF" strokeWidth="1.5" />

                    <rect x="355" y="108" width="215" height="20" rx="3" fill="rgba(0, 20, 40, 0.85)" stroke="#00E5FF" strokeWidth="1" />
                    <text x="362" y="122" fontFamily="JetBrains Mono" fontSize="9.5" fill="#00E5FF" fontWeight="700">
                      U-NET DETECTED SLICK: {incidentArea}
                    </text>

                    {/* Low-wind Lookalike Rejection Zone */}
                    <path
                      d="M 50 30 Q 90 20 120 50 L 110 100 L 40 80 Z"
                      fill="rgba(239,68,68,0.22)"
                      stroke="#EF4444"
                      strokeWidth="1.5"
                      strokeDasharray="3,3"
                    />
                    <rect x="45" y="48" width="165" height="18" rx="2" fill="rgba(20, 0, 0, 0.8)" />
                    <text x="50" y="61" fontFamily="JetBrains Mono" fontSize="8.5" fill="#EF4444" fontWeight="600">
                      Low-wind Lookalike (Rejected)
                    </text>
                  </svg>
                  <span className="split-label left-lbl" style={{ background: 'rgba(0,20,40,0.85)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.4)' }}>
                    Real Photo + AI U-Net Detection Mask
                  </span>
                </div>

                {/* Over Pane (Left: Real Satellite Photo Raw Backscatter) */}
                <div
                  className="split-pane right"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: `${splitPercent}%`,
                    height: '100%',
                    overflow: 'hidden',
                    borderRight: '2px solid #00E5FF',
                    boxShadow: '2px 0 10px rgba(0,229,255,0.5)',
                  }}
                >
                  <div style={{ width: 600, height: '100%', position: 'relative' }}>
                    <img
                      src={activeImageSrc}
                      alt="Real Satellite Raw Sensor"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/imagery/sar_vv_damping.png';
                      }}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {/* Measurement Callout on Raw Photo */}
                    <svg
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                      viewBox="0 0 600 280"
                      preserveAspectRatio="none"
                    >
                      <circle cx="230" cy="120" r="4" fill="#F59E0B" />
                      <line x1="230" y1="120" x2="260" y2="90" stroke="#F59E0B" strokeWidth="1.5" />
                      <rect x="260" y="80" width="145" height="18" rx="3" fill="rgba(0,0,0,0.85)" stroke="#F59E0B" strokeWidth="1" />
                      <text x="265" y="93" fontFamily="JetBrains Mono" fontSize="9" fill="#FDE68A" fontWeight="700">
                        σ0 Damping: -8.4 dB
                      </text>
                    </svg>
                  </div>
                  <span className="split-label right-lbl" style={{ background: 'rgba(0,0,0,0.85)', color: '#F1F5F9', border: '1px solid rgba(255,255,255,0.2)' }}>
                    Raw Real Satellite Photo (σ0 Backscatter)
                  </span>
                </div>

                {/* Draggable Handle */}
                <div
                  className="split-handle"
                  style={{ left: `${splitPercent}%` }}
                  title="Drag to compare"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>drag_indicator</span>
                </div>
              </div>
            </div>
          </div>

          {/* SPECTRAL BACKSCATTER DEPRESSION GRAPH */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>show_chart</span>
                Radar Cross-Section Transect (NRCS σ0 dB Profile)
              </span>
              <span className="text-xs text-muted">Demonstrating Capillary Wave Damping</span>
            </div>
            <div className="panel-body">
              <svg viewBox="0 0 500 120" width="100%" xmlns="http://www.w3.org/2000/svg">
                <line x1="40" y1="10" x2="40" y2="100" stroke="var(--border-default)" strokeWidth="1" />
                <line x1="40" y1="100" x2="480" y2="100" stroke="var(--border-default)" strokeWidth="1" />
                <text x="8" y="20" fontFamily="JetBrains Mono" fontSize="8" fill="var(--text-muted)">-10 dB</text>
                <text x="8" y="55" fontFamily="JetBrains Mono" fontSize="8" fill="var(--text-muted)">-18 dB</text>
                <text x="8" y="95" fontFamily="JetBrains Mono" fontSize="8" fill="var(--text-muted)">-26 dB</text>

                <path
                  d="M 40 30 Q 120 28 180 32 L 210 40 L 250 85 L 290 90 L 330 80 L 360 38 Q 420 32 480 30"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2"
                />
                <line x1="270" y1="30" x2="270" y2="85" stroke="#EF4444" strokeWidth="1" strokeDasharray="2,2" />
                <text x="278" y="58" fontFamily="JetBrains Mono" fontSize="9" fill="#EF4444" fontWeight="700">
                  Δσ0 = -8.4 dB (Oil Film Damping)
                </text>
              </svg>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>verified_user</span>
                Multi-Factor Confidence Assessment
              </span>
            </div>
            <div className="panel-body" style={{ paddingTop: 'var(--sp-2)' }}>
              <div style={{ marginBottom: 12 }}>
                <div className="flex justify-between items-center" style={{ fontSize: 11, marginBottom: 3 }}>
                  <span className="font-medium">U-Net ResNet-50 AI Segment</span>
                  <span className="mono font-bold" style={{ color: '#16A34A' }}>0.87</span>
                </div>
                <div style={{ height: 5, background: 'var(--bg-overlay)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: '87%', height: '100%', background: 'var(--sev-low)' }}></div>
                </div>
                <div className="text-xs text-muted" style={{ marginTop: 2 }}>Val IoU 0.83 on Sentinel-1 SAR benchmarks</div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div className="flex justify-between items-center" style={{ fontSize: 11, marginBottom: 3 }}>
                  <span className="font-medium">ERA5 Wind Speed Window</span>
                  <span className="mono font-bold" style={{ color: '#16A34A' }}>0.91</span>
                </div>
                <div style={{ height: 5, background: 'var(--bg-overlay)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: '91%', height: '100%', background: 'var(--sev-low)' }}></div>
                </div>
                <div className="text-xs text-muted" style={{ marginTop: 2 }}>4.2 m/s: strictly inside [3.0, 12.0] m/s validity window</div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div className="flex justify-between items-center" style={{ fontSize: 11, marginBottom: 3 }}>
                  <span className="font-medium">Biogenic Algal Exclusion</span>
                  <span className="mono font-bold" style={{ color: '#16A34A' }}>0.78</span>
                </div>
                <div style={{ height: 5, background: 'var(--bg-overlay)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: '78%', height: '100%', background: '#65A30D' }}></div>
                </div>
                <div className="text-xs text-muted" style={{ marginTop: 2 }}>Chlorophyll-a below bloom threshold (MODIS check)</div>
              </div>

              <div style={{ paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
                <div className="flex justify-between items-center" style={{ fontSize: 12, marginBottom: 4 }}>
                  <span className="font-bold">Composite Probability</span>
                  <span className="mono font-bold" style={{ color: '#16A34A', fontSize: 16 }}>0.82</span>
                </div>
                <div style={{ height: 8, background: 'var(--bg-overlay)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: '82%', height: '100%', background: 'linear-gradient(90deg, var(--sev-low), #65A30D)' }}></div>
                </div>
                <div className="text-xs text-muted" style={{ marginTop: 3 }}>Classified: Highly Likely Mineral Oil Slick</div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>history</span>
                Processing Pipeline Timeline
              </span>
            </div>
            <div className="panel-body" style={{ paddingTop: 'var(--sp-2)' }}>
              <div className="tl-row">
                <div className="tl-dot done"></div>
                <div>
                  <div className="tl-event">Varuna-SAR Ingestion &amp; SHA-256 Registered</div>
                  <div className="tl-time">2024-11-14 04:22 UTC (+18s)</div>
                </div>
              </div>
              <div className="tl-row">
                <div className="tl-dot done"></div>
                <div>
                  <div className="tl-event">Lee 5x5 Speckle Filter &amp; Calibration</div>
                  <div className="tl-time">2024-11-14 04:23 UTC (+38s)</div>
                </div>
              </div>
              <div className="tl-row">
                <div className="tl-dot done"></div>
                <div>
                  <div className="tl-event">U-Net Segmentation: Sentinel-1 SAR Mask Extracted</div>
                  <div className="tl-time">2024-11-14 04:25 UTC (+2m 11s)</div>
                </div>
              </div>
              <div className="tl-row">
                <div className="tl-dot done"></div>
                <div>
                  <div className="tl-event">Backward Lagrangian Drift (N=1000, 72h)</div>
                  <div className="tl-time">2024-11-14 04:29 UTC (+6m 52s)</div>
                </div>
              </div>
              <div className="tl-row">
                <div className="tl-dot done"></div>
                <div>
                  <div className="tl-event">AIS Correlation: 3 Candidates Ranked</div>
                  <div className="tl-time">2024-11-14 04:33 UTC (+10m 59s)</div>
                </div>
              </div>
              <div className="tl-row" style={{ paddingBottom: 0 }}>
                <div className="tl-dot run"></div>
                <div>
                  <div className="tl-event" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                    Dossier Sealed with SHA-256 Hash
                  </div>
                  <div className="tl-time">2024-11-14 04:34 UTC (+11m 47s)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

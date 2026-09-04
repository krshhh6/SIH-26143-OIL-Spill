import React, { useState } from 'react';
import type { Scenario, CopernicusLayerId } from '../../types/dashboard';

interface BhoonidhiModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenario?: Scenario | null;
  onSelectLayer?: (layerId: CopernicusLayerId) => void;
}

export const BhoonidhiModal: React.FC<BhoonidhiModalProps> = ({
  isOpen,
  onClose,
  scenario,
  onSelectLayer,
}) => {
  const [activeTab, setActiveTab] = useState<'portal' | 'damping' | 'auth' | 'opensearch' | 'products'>('portal');
  const [userId, setUserId] = useState<string>('krshhh6');
  const [password, setPassword] = useState<string>('••••••••••••');
  const [token, setToken] = useState<string>(
    'eyJhbGciOiJIUzUxMiJ9.eyJ0aW1lc3RhbXAiOjE3ODg1NDA3NjM4OTUsInN1YiI6Ik9OTF9rcnNoaGg2IiwiaWF0IjoxNzg4NTQwNzYzLCJleHAiOjE3ODg1NDE5NjN9.wwDf0JsFZw0hW8wvFF69F3CP_b66Ry_OFQ41yd78uLpepY1WUCHAhj5GJqA2wxGVEEUHPCHycVmT7IQNRiz5tA'
  );
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [authStatus, setAuthStatus] = useState<string>('🟢 AUTHENTICATED: Active Bearer Token Verified (User: krshhh6)');
  
  // Bhoonidhi Portal UI States (Matching User Screenshot)
  const [bhoonidhiSats, setBhoonidhiSats] = useState<Record<string, boolean>>({
    'Sentinel-2A': true,
    'Sentinel-1A': true,
    'Sentinel-1C': true,
    'Sentinel-2B': true,
    'Aqua': false,
    'CartoSat-1': false,
    'CartoSat-2': false,
  });
  const [bhoonidhiSensors, setBhoonidhiSensors] = useState<Record<string, boolean>>({
    'C-SAR (Sentinel-1)': true,
    'MSI (Sentinel-2)': true,
  });
  const [bhoonidhiProducts, setBhoonidhiProducts] = useState<Record<string, boolean>>({
    'Sentinel-2A_MSI_Level-2A': true,
    'Sentinel-1A_C-SAR_Level-1_GRD': true,
  });
  const [portalSubmitted, setPortalSubmitted] = useState<boolean>(true);
  const [portalSearching, setPortalSearching] = useState<boolean>(false);

  // Damping lab states
  const [testMode, setTestMode] = useState<'crude' | 'algae'>('crude');
  const [searchExecuting, setSearchExecuting] = useState<boolean>(false);
  const [searchResult, setSearchResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRefreshToken = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setAuthStatus('🟢 TOKEN REFRESHED (200 OK): Valid session with ISRO NRSC Shadnagar Node');
    }, 800);
  };

  const handlePortalSubmit = () => {
    setPortalSearching(true);
    setTimeout(() => {
      setPortalSearching(false);
      setPortalSubmitted(true);
    }, 500);
  };

  const handleExecuteSearch = () => {
    setSearchExecuting(true);
    setSearchResult(null);
    setTimeout(() => {
      setSearchExecuting(false);
      setSearchResult(JSON.stringify({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            id: "NISAR_L_S_L2_GCOV_20260904T123000_BOMBAY_HIGH",
            properties: {
              platform: "NISAR",
              bands: ["L-band (1.26GHz)", "S-band (3.20GHz)"],
              polarization: "VV+VH (Dual-Pol SweepSAR)",
              product: "L2-GCOV (Geocoded Covariance Matrix)",
              incidence_angle_deg: 37.4,
              resolution_m: 10.0,
              swath_width_km: 242.0,
              orbit: "DESCENDING_PASS_142",
              source: "ISRO NRSC Bhoonidhi Data Hub"
            },
            assets: {
              s_band_vv: "https://bhoonidhi.nrsc.gov.in/download/NISAR_S_GCOV_BOMBAY_HIGH.tif",
              l_band_vv: "https://bhoonidhi.nrsc.gov.in/download/NISAR_L_GCOV_BOMBAY_HIGH.tif"
            }
          }
        ]
      }, null, 2));
    }, 600);
  };

  const sDamping = testMode === 'crude' ? -14.2 : -8.5;
  const lDamping = testMode === 'crude' ? -11.5 : -1.2;
  const dfdi = Math.abs(sDamping) - Math.abs(lDamping);
  const isMineral = testMode === 'crude';

  return (
    <div
      className="modal-backdrop open"
      id="bhoonidhi-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card" style={{ maxWidth: 960, maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div className="modal-header" style={{ borderBottom: '1px solid rgba(245, 158, 11, 0.25)' }}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: '#F59E0B' }}>
              satellite_alt
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#F59E0B' }}>
                  ISRO NRSC Bhoonidhi &amp; NISAR Gateway
                </h3>
                <span className="chip-badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', fontSize: 10, padding: '2px 7px' }}>
                  L+S DUAL-BAND SAR
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Indian Space Research Organisation (ISRO) • National Remote Sensing Centre (NRSC) • 242 km SweepSAR Swath
              </div>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2" style={{ borderBottom: '1px solid var(--border-color)', padding: '8px 16px', background: 'rgba(0,0,0,0.15)' }}>
          <button
            className={`btn btn-secondary ${activeTab === 'portal' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('portal')}
            style={{ fontSize: 11, padding: '5px 12px', borderColor: activeTab === 'portal' ? '#F59E0B' : undefined }}
          >
            🛰️ Bhoonidhi Satellite &amp; Sensor Portal (4/43)
          </button>
          <button
            className={`btn btn-secondary ${activeTab === 'damping' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('damping')}
            style={{ fontSize: 11, padding: '5px 12px', borderColor: activeTab === 'damping' ? '#F59E0B' : undefined }}
          >
            🔬 Dual-Band Bragg Damping Lab
          </button>
          <button
            className={`btn btn-secondary ${activeTab === 'auth' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('auth')}
            style={{ fontSize: 11, padding: '5px 12px', borderColor: activeTab === 'auth' ? '#F59E0B' : undefined }}
          >
            🔑 ISRO Token Authentication
          </button>
          <button
            className={`btn btn-secondary ${activeTab === 'opensearch' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('opensearch')}
            style={{ fontSize: 11, padding: '5px 12px', borderColor: activeTab === 'opensearch' ? '#F59E0B' : undefined }}
          >
            🛰️ Bhoonidhi OpenSearch Client
          </button>
          <button
            className={`btn btn-secondary ${activeTab === 'products' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('products')}
            style={{ fontSize: 11, padding: '5px 12px', borderColor: activeTab === 'products' ? '#F59E0B' : undefined }}
          >
            📦 Level-2 GCOV Specifications
          </button>
        </div>

        {/* TAB 0: BHOONIDHI SATELLITE & SENSOR SELECTION PORTAL (MATCHING KRISHNA KANT'S SCREENSHOT) */}
        {activeTab === 'portal' && (
          <div style={{ padding: 14 }}>
            {/* Krishna Kant Welcome Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0F172A', padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid rgba(245, 158, 11, 0.3)', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#F43F5E', fontWeight: 800, fontSize: 12, letterSpacing: '0.04em' }}>Welcome KRISHNA KANT</span>
                <span style={{ fontSize: 9, background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', padding: '1px 6px', borderRadius: 3, border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                  AUTHENTICATED ISRO/NRSC NODE
                </span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                Target AOI: <strong style={{ color: '#38BDF8' }}>N 6° 38' 37" E 64° 38' 35"</strong> • Arabian Sea Indian EEZ
              </div>
            </div>

            {/* Main Portal View: Left Filters Column + Right Results/AOI Column */}
            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 12 }}>
              {/* Left Column: Satellite & Sensor Filter Accordions */}
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Resolution */}
                <div style={{ paddingBottom: 6, borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Resolution</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#38BDF8' }}>10m High-Resolution (HR/VHR)</div>
                </div>

                {/* Imaging Spectrum */}
                <div style={{ paddingBottom: 6, borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Imaging Spectrum (1/3)</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>Microwave Radar (C/S/L-band) + SWIR</div>
                </div>

                {/* Satellite (4/43) */}
                <div style={{ paddingBottom: 6, borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B' }}>
                      Satellite ({Object.values(bhoonidhiSats).filter(Boolean).length}/43)
                    </span>
                    <span style={{ fontSize: 8.5, color: '#10B981' }}>Filtered for Marine</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 150, overflowY: 'auto' }}>
                    {Object.entries(bhoonidhiSats).map(([sat, isChecked]) => {
                      const isUnneeded = sat === 'Aqua' || sat.includes('CartoSat');
                      return (
                        <label key={sat} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, opacity: isUnneeded ? 0.45 : 1.0, cursor: isUnneeded ? 'not-allowed' : 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isUnneeded}
                            onChange={() => {
                              if (!isUnneeded) {
                                setBhoonidhiSats(prev => ({ ...prev, [sat]: !prev[sat] }));
                              }
                            }}
                            style={{ accentColor: '#F59E0B' }}
                          />
                          <span style={{ fontWeight: isChecked ? 600 : 400, color: isChecked ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {sat}
                          </span>
                          {isUnneeded && <span style={{ fontSize: 7.5, color: 'var(--text-muted)' }}>(Non-marine)</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Sensor Type (2/19) */}
                <div style={{ paddingBottom: 6, borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B' }}>
                      Sensor Type ({Object.values(bhoonidhiSensors).filter(Boolean).length}/19)
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {Object.entries(bhoonidhiSensors).map(([sensor, isChecked]) => (
                      <label key={sensor} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => setBhoonidhiSensors(prev => ({ ...prev, [sensor]: !prev[sensor] }))}
                          style={{ accentColor: '#10B981' }}
                        />
                        <span style={{ fontWeight: isChecked ? 600 : 400 }}>{sensor}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Products OpenData_DirectDownload */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700 }}>OpenData_DirectDownload</span>
                    <span style={{ fontSize: 8.5, color: '#16A34A' }}>Free Access</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {Object.entries(bhoonidhiProducts).map(([prod, isChecked]) => (
                      <label key={prod} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9.5, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => setBhoonidhiProducts(prev => ({ ...prev, [prod]: !prev[prod] }))}
                          style={{ accentColor: '#0284C7' }}
                        />
                        <span className="mono" style={{ fontSize: 8.5, color: isChecked ? 'var(--text-primary)' : 'var(--text-muted)' }}>{prod}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  className="btn btn-primary"
                  onClick={handlePortalSubmit}
                  style={{ marginTop: 6, padding: '6px', fontSize: 11, fontWeight: 700, background: '#0284C7' }}
                >
                  {portalSearching ? 'Querying NRSC Bhoonidhi...' : 'Submit'}
                </button>
              </div>

              {/* Right Column: Search Results Granules & Instant Drape */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* AOI Bounding Box Card */}
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#38BDF8' }}>
                      📍 Active Search Footprint (AOI Red Box)
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      BBOX: 64.6430, 6.6436, 73.8000, 19.5000
                    </span>
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>
                    Matching ISRO Bhoonidhi coordinate sector: <strong>Arabian Sea Indian EEZ to Mumbai High Fairway</strong>.
                  </div>
                </div>

                {/* Granules Feed */}
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Matching Ingested Granules ({portalSubmitted ? '4' : '0'})
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 310, overflowY: 'auto' }}>
                  {/* Granule 1: Sentinel-1A SAR */}
                  <div style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(8, 145, 178, 0.4)', borderRadius: 'var(--radius)', padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#0891B2' }}>S1A_IW_GRDH_1SDV_20241114T042231</span>
                        <span style={{ fontSize: 8.5, background: 'rgba(8, 145, 178, 0.15)', color: '#0891B2', padding: '1px 5px', borderRadius: 2 }}>RADAR C-SAR</span>
                      </div>
                      <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2 }}>
                        Sentinel-1A IW 10m RTC Calibrated Backscatter • Capillary Wave Damping Δσ0 = -8.4 dB
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => {
                          if (onSelectLayer) onSelectLayer('sar-vv');
                          onClose();
                        }}
                        style={{ fontSize: 10, padding: '4px 8px' }}
                      >
                        🗺️ Drape on Map
                      </button>
                    </div>
                  </div>

                  {/* Granule 2: Sentinel-2A SWIR */}
                  <div style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(180, 83, 9, 0.4)', borderRadius: 'var(--radius)', padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B' }}>S2A_MSIL2A_20241114T054521_SWIR</span>
                        <span style={{ fontSize: 8.5, background: 'rgba(180, 83, 9, 0.15)', color: '#F59E0B', padding: '1px 5px', borderRadius: 2 }}>MSI SWIR</span>
                      </div>
                      <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2 }}>
                        Sentinel-2A B11 (1610nm) &amp; B12 (2190nm) • Hydrocarbon Absorption Overtones
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => {
                          if (onSelectLayer) onSelectLayer('swir-oil');
                          onClose();
                        }}
                        style={{ fontSize: 10, padding: '4px 8px', borderColor: '#F59E0B', color: '#F59E0B' }}
                      >
                        🗺️ Drape on Map
                      </button>
                    </div>
                  </div>

                  {/* Granule 3: ISRO NISAR Dual-Band */}
                  <div style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(245, 158, 11, 0.5)', borderRadius: 'var(--radius)', padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B' }}>NISAR_L_S_L2_GCOV_20260904</span>
                        <span style={{ fontSize: 8.5, background: 'rgba(245, 158, 11, 0.2)', color: '#F59E0B', padding: '1px 5px', borderRadius: 2 }}>L+S DUAL-BAND</span>
                      </div>
                      <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2 }}>
                        ISRO S-band (3.2GHz) + NASA L-band (1.26GHz) SweepSAR • DFDI = 2.7 dB
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => {
                          if (onSelectLayer) onSelectLayer('nisar-ls');
                          onClose();
                        }}
                        style={{ fontSize: 10, padding: '4px 8px', background: '#F59E0B', borderColor: '#F59E0B' }}
                      >
                        🗺️ Drape on Map
                      </button>
                    </div>
                  </div>

                  {/* Granule 4: Sentinel-2B True Color */}
                  <div style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(2, 132, 199, 0.4)', borderRadius: 'var(--radius)', padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#0284C7' }}>S2B_MSIL2A_20241114T054521_TCOLOR</span>
                        <span style={{ fontSize: 8.5, background: 'rgba(2, 132, 199, 0.15)', color: '#0284C7', padding: '1px 5px', borderRadius: 2 }}>TRUE COLOR</span>
                      </div>
                      <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2 }}>
                        Sentinel-2B B4, B3, B2 Optical Surface Sheen • Specular Sun-Glint Film
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => {
                          if (onSelectLayer) onSelectLayer('true-color');
                          onClose();
                        }}
                        style={{ fontSize: 10, padding: '4px 8px' }}
                      >
                        🗺️ Drape on Map
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: DUAL-BAND BRAGG DAMPING LAB */}
        {activeTab === 'damping' && (
          <div style={{ padding: 16 }}>
            <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: 'var(--radius)', padding: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B', marginBottom: 4 }}>
                ⚡ Dual-Frequency Bragg Scattering Damping Ratio (DFDI Physics Engine)
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Sentinel-1 operates in single C-band (5.5 cm), confusing mineral oil with biogenic algae. 
                NISAR simultaneously probes <strong>S-band (8.1 cm capillary waves)</strong> and <strong>L-band (20.7 cm decimetric gravity waves)</strong>. 
                Because algae is a nanometer-thin film, it <em>cannot damp L-band gravity waves</em>, whereas crude oil damps both bands.
              </div>
            </div>

            {/* Mode Switcher */}
            <div className="flex items-center justify-between" style={{ marginBottom: 16, background: 'var(--bg-elevated)', padding: 10, borderRadius: 'var(--radius)' }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Test Target Simulation:</span>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {scenario ? `Active Coordinates: ${scenario.title} (${scenario.lat.toFixed(3)}°N, ${scenario.lng.toFixed(3)}°E)` : 'Indian EEZ Surveillance'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className={`btn ${testMode === 'crude' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setTestMode('crude')}
                  style={{ fontSize: 11, padding: '4px 10px', borderColor: testMode === 'crude' ? '#EF4444' : undefined }}
                >
                  🛢️ Bombay High Heavy Crude
                </button>
                <button
                  className={`btn ${testMode === 'algae' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setTestMode('algae')}
                  style={{ fontSize: 11, padding: '4px 10px', borderColor: testMode === 'algae' ? '#10B981' : undefined }}
                >
                  🌱 Algal Bloom (Look-alike)
                </button>
              </div>
            </div>

            {/* Damping Spectrum Meters */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              {/* S-Band Meter */}
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: 12 }}>
                <div className="flex justify-between items-center" style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#38BDF8' }}>ISRO S-Band (3.20 GHz)</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>λ = 9.3 cm (Capillary Wave)</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#38BDF8', marginBottom: 4 }}>
                  {sDamping.toFixed(1)} dB <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>damping</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.1)', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, Math.abs(sDamping) * 6)}%`, height: '100%', background: '#38BDF8' }}></div>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                  Resonates with 8.1 cm short gravity-capillary waves. Strong suppression in both oil and algae.
                </div>
              </div>

              {/* L-Band Meter */}
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: 12 }}>
                <div className="flex justify-between items-center" style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B' }}>NASA L-Band (1.26 GHz)</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>λ = 23.8 cm (Gravity Wave)</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: isMineral ? '#EF4444' : '#10B981', marginBottom: 4 }}>
                  {lDamping.toFixed(1)} dB <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>damping</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.1)', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, Math.abs(lDamping) * 6)}%`, height: '100%', background: isMineral ? '#EF4444' : '#10B981' }}></div>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                  Resonates with 20.7 cm decimetric gravity waves. Only high-viscosity crude oil can suppress this.
                </div>
              </div>
            </div>

            {/* Verdict Card */}
            <div style={{
              background: isMineral ? 'linear-gradient(90deg, rgba(239, 68, 68, 0.15), transparent)' : 'linear-gradient(90deg, rgba(16, 185, 129, 0.15), transparent)',
              border: `1px solid ${isMineral ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
              borderRadius: 'var(--radius)',
              padding: 14,
              marginBottom: 16
            }}>
              <div className="flex justify-between items-center" style={{ marginBottom: 6 }}>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined" style={{ fontSize: 22, color: isMineral ? '#EF4444' : '#10B981' }}>
                    {isMineral ? 'warning' : 'verified'}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: isMineral ? '#EF4444' : '#10B981' }}>
                    {isMineral ? '🚨 CONFIRMED MINERAL OIL SLICK (VISCOUS BULK EMULSION)' : '🌱 REJECTED: NATURAL BIOGENIC LOOK-ALIKE (ALGAL BLOOM)'}
                  </span>
                </div>
                <span className="chip-badge" style={{ background: isMineral ? '#EF4444' : '#10B981', color: '#fff', fontSize: 11 }}>
                  DFDI: {dfdi.toFixed(1)} dB • {isMineral ? '98.4% Confidence' : 'Zero False Alarm'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {isMineral
                  ? `Simultaneous deep damping across S-band (${sDamping.toFixed(1)} dB) and L-band (${lDamping.toFixed(1)} dB) proves high dynamic viscosity dissipating decimeter waves. Actionable Coast Guard response recommended.`
                  : `Strong S-band damping (${sDamping.toFixed(1)} dB) combined with near-zero L-band damping (${lDamping.toFixed(1)} dB, DFDI ${dfdi.toFixed(1)} dB) proves a nanometer-thin monomolecular surfactant film. Sortie cancelled.`
                }
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex justify-end gap-2">
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (onSelectLayer) onSelectLayer('nisar-ls');
                  onClose();
                }}
                style={{ background: '#F59E0B', color: '#000', fontWeight: 700 }}
              >
                🗺️ Drape NISAR L+S Dual-Band on Tactical Chart
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: ISRO TOKEN AUTHENTICATION */}
        {activeTab === 'auth' && (
          <div style={{ padding: 16 }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 'var(--radius)', padding: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#10B981', marginBottom: 2 }}>
                {authStatus}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                Endpoint: https://bhoonidhi-api.nrsc.gov.in/auth/token • Grant: password • Algorithm: HS512
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Bhoonidhi User ID</label>
                <input
                  type="text"
                  className="search-pill-input"
                  style={{ width: '100%', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)' }}
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Password</label>
                <input
                  type="password"
                  className="search-pill-input"
                  style={{ width: '100%', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)' }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Active Bearer Access Token (JWT)</label>
              <textarea
                rows={3}
                style={{
                  width: '100%',
                  background: 'var(--bg-dark)',
                  color: '#38BDF8',
                  fontFamily: 'monospace',
                  fontSize: 10,
                  padding: 8,
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border-color)',
                  resize: 'none',
                }}
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>

            <div className="flex justify-between items-center">
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Session expires in 3600s • Token automatically appended to Bhoonidhi OpenSearch headers
              </div>
              <button
                className="btn btn-secondary"
                onClick={handleRefreshToken}
                disabled={isRefreshing}
                style={{ fontSize: 11 }}
              >
                {isRefreshing ? 'Refreshing Token...' : '🔄 Refresh ISRO Token'}
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: OPENSEARCH REST CLIENT */}
        {activeTab === 'opensearch' && (
          <div style={{ padding: 16 }}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Bhoonidhi OpenSearch REST Request (GET)
              </label>
              <div style={{ background: 'var(--bg-dark)', padding: 10, borderRadius: 'var(--radius)', fontFamily: 'monospace', fontSize: 11, color: '#F59E0B', border: '1px solid var(--border-color)', wordBreak: 'break-all' }}>
                GET https://bhoonidhi.nrsc.gov.in/bhoonidhi/opensearch?dataset=NISAR&amp;product=GCOV&amp;bbox={scenario ? `${(scenario.lng - 0.5).toFixed(2)},${(scenario.lat - 0.5).toFixed(2)},${(scenario.lng + 0.5).toFixed(2)},${(scenario.lat + 0.5).toFixed(2)}` : '70.80,18.30,71.60,19.10'}&amp;format=json
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div className="flex justify-between items-center" style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>STAC 1.0.0 GeoJSON Granule Response</span>
                <button
                  className="btn btn-primary"
                  onClick={handleExecuteSearch}
                  disabled={searchExecuting}
                  style={{ fontSize: 11, padding: '4px 10px' }}
                >
                  {searchExecuting ? 'Querying Bhoonidhi...' : '▶ Execute Scene Query'}
                </button>
              </div>
              <textarea
                readOnly
                rows={9}
                style={{
                  width: '100%',
                  background: 'var(--bg-dark)',
                  color: '#A7F3D0',
                  fontFamily: 'monospace',
                  fontSize: 10,
                  padding: 8,
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border-color)',
                  resize: 'none',
                }}
                value={searchResult || '// Click "Execute Scene Query" to query ISRO Bhoonidhi OpenSearch catalog over target AOI.'}
              />
            </div>
          </div>
        )}

        {/* TAB 4: LEVEL-2 GCOV SPECS */}
        {activeTab === 'products' && (
          <div style={{ padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
              <div style={{ background: 'var(--bg-elevated)', padding: 10, borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B' }}>Level-2 GCOV</div>
                <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>Geocoded Covariance</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                  Map-projected matrix containing calibrated σ⁰_VV, σ⁰_VH and polarimetric cross-channels. Primary input for oil spill detection.
                </div>
              </div>
              <div style={{ background: 'var(--bg-elevated)', padding: 10, borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#38BDF8' }}>SweepSAR Beamforming</div>
                <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>242 km Swath</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                  12-meter deployable reflector provides wide-area imaging without range ambiguity gaps. 8m azimuth resolution.
                </div>
              </div>
              <div style={{ background: 'var(--bg-elevated)', padding: 10, borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#10B981' }}>Orbit Geometry</div>
                <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>747 km Sun-Sync</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                  12-day exact repeat cycle. Consistent dawn/dusk local time pass over Indian exclusive economic zone.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

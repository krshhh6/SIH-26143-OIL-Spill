import React, { useState, useEffect } from 'react';
import type { TabType, Scenario } from '../../types/dashboard';
import { SCENARIOS } from '../../data/scenarios';

interface DriftViewProps {
  onSelectTab: (tab: TabType) => void;
  currentScenario?: Scenario | null;
  onSelectScenario?: (key: string) => void;
}

interface TimestepForecast {
  timeOffsetHours: number;
  label: string;
  timestamp: string;
  lat: number;
  lng: number;
  areaKm2: number;
  slickRadiusKm: number;
  driftSpeedKnots: number;
  headingDeg: number;
  distanceToCoastKm: number;
  evaporatedPct: number;
  emulsifiedPct: number;
  dispersedPct: number;
  remainingSurfacePct: number;
  viscosityCSt: number;
  waterContentPct: number;
  threatLevel: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  containmentRecommendation: string;
}

interface ScenarioDriftProfile {
  scenarioId: string;
  incidentName: string;
  seaBasin: string;
  oilType: string;
  apiGravity: string;
  initialObservedCoords: string;
  initialAreaKm2: number;
  currentVector: string;
  windVector: string;
  seaState: string;
  sstCelsius: number;
  // Origin Backtracking
  originCoords: string;
  originWindow: string;
  originAreaKm2: number;
  suspectVessel: string;
  backtrackConfidencePct: number;
  // Future Forecast Timesteps
  forecasts: TimestepForecast[];
  coastalZoneName: string;
  overallLandfallEta: string;
  vulnerableHabitats: string[];
}

const DRIFT_PROFILES: Record<string, ScenarioDriftProfile> = {
  'INC-001': {
    scenarioId: 'INC-2026-001',
    incidentName: 'Mumbai High Basin Crude Spill',
    seaBasin: 'Arabian Sea Offshore EEZ',
    oilType: 'Bombay High Heavy Crude',
    apiGravity: '33.4° API',
    initialObservedCoords: '18.743°N, 71.218°E',
    initialAreaKm2: 4.82,
    currentVector: '0.42 m/s @ 065° (ENE Surface Jet)',
    windVector: '6.8 m/s @ 245° (WSW Monsoon Wind)',
    seaState: 'Sea State 3 (Wave H_s: 1.4 m)',
    sstCelsius: 28.4,
    originCoords: '18.62°N, 71.18°E',
    originWindow: 'Discharge Window: T - 20h to - 24h',
    originAreaKm2: 68.4,
    suspectVessel: 'CRUDE ATLAS (MMSI 419001234)',
    backtrackConfidencePct: 88,
    coastalZoneName: 'Alibaug Coastline & Murud-Janjira Shelf',
    overallLandfallEta: '46h 30m (Critical Watch)',
    vulnerableHabitats: [
      'Alibaug Intertidal Mudflats & Mangrove Creeks (38 km ENE)',
      'Kihim Beach Artisanal Fisheries & Marine Protected Zone',
      'Mumbai Harbour Shipping Channel & Desalination Intakes',
    ],
    forecasts: [
      {
        timeOffsetHours: 6,
        label: 'T + 6 Hours',
        timestamp: 'T + 06:00 UTC',
        lat: 18.778,
        lng: 71.275,
        areaKm2: 9.4,
        slickRadiusKm: 1.73,
        driftSpeedKnots: 0.65,
        headingDeg: 68,
        distanceToCoastKm: 78.5,
        evaporatedPct: 15,
        emulsifiedPct: 8,
        dispersedPct: 5,
        remainingSurfacePct: 72,
        viscosityCSt: 42,
        waterContentPct: 18,
        threatLevel: 'LOW',
        containmentRecommendation: 'Deploy Tier-1 Fast-Response Ocean Boom (1,200m) at upstream leading edge.',
      },
      {
        timeOffsetHours: 12,
        label: 'T + 12 Hours',
        timestamp: 'T + 12:00 UTC',
        lat: 18.815,
        lng: 71.342,
        areaKm2: 17.8,
        slickRadiusKm: 2.38,
        driftSpeedKnots: 0.68,
        headingDeg: 66,
        distanceToCoastKm: 64.2,
        evaporatedPct: 24,
        emulsifiedPct: 19,
        dispersedPct: 9,
        remainingSurfacePct: 48,
        viscosityCSt: 165,
        waterContentPct: 35,
        threatLevel: 'MODERATE',
        containmentRecommendation: 'Chemical dispersant application window optimal before emulsification exceeds 30%.',
      },
      {
        timeOffsetHours: 24,
        label: 'T + 24 Hours',
        timestamp: 'T + 24:00 UTC',
        lat: 18.892,
        lng: 71.488,
        areaKm2: 34.6,
        slickRadiusKm: 3.32,
        driftSpeedKnots: 0.72,
        headingDeg: 64,
        distanceToCoastKm: 47.1,
        evaporatedPct: 32,
        emulsifiedPct: 31,
        dispersedPct: 14,
        remainingSurfacePct: 23,
        viscosityCSt: 580,
        waterContentPct: 52,
        threatLevel: 'HIGH',
        containmentRecommendation: 'Position offshore skimmer vessels (ICGS Samudra Prahari) along 71.48°E interception meridian.',
      },
      {
        timeOffsetHours: 36,
        label: 'T + 36 Hours',
        timestamp: 'T + 36:00 UTC',
        lat: 18.968,
        lng: 71.632,
        areaKm2: 52.1,
        slickRadiusKm: 4.07,
        driftSpeedKnots: 0.70,
        headingDeg: 65,
        distanceToCoastKm: 31.8,
        evaporatedPct: 36,
        emulsifiedPct: 38,
        dispersedPct: 17,
        remainingSurfacePct: 9,
        viscosityCSt: 1150,
        waterContentPct: 65,
        threatLevel: 'CRITICAL',
        containmentRecommendation: 'Establish nearshore containment barriers across Alibaug creek entrances.',
      },
      {
        timeOffsetHours: 48,
        label: 'T + 48 Hours',
        timestamp: 'T + 48:00 UTC',
        lat: 19.042,
        lng: 71.775,
        areaKm2: 68.5,
        slickRadiusKm: 4.67,
        driftSpeedKnots: 0.67,
        headingDeg: 67,
        distanceToCoastKm: 18.4,
        evaporatedPct: 38,
        emulsifiedPct: 41,
        dispersedPct: 18,
        remainingSurfacePct: 3,
        viscosityCSt: 1850,
        waterContentPct: 72,
        threatLevel: 'CRITICAL',
        containmentRecommendation: 'Shoreline pre-impact shoreline protection crews deployed with sorbent booms.',
      },
    ],
  },
  'INC-002': {
    scenarioId: 'INC-2026-002',
    incidentName: 'Chennai–Ennore Corridor Fuel Spill',
    seaBasin: 'Bay of Bengal EEZ',
    oilType: 'Heavy Bunker Fuel (IFO-380)',
    apiGravity: '12.8° API (High Viscosity)',
    initialObservedCoords: '13.250°N, 80.460°E',
    initialAreaKm2: 2.40,
    currentVector: '0.58 m/s @ 340° (NNW Coastal Current)',
    windVector: '8.2 m/s @ 120° (SE Sea Breeze)',
    seaState: 'Sea State 4 (Wave H_s: 1.8 m)',
    sstCelsius: 29.1,
    originCoords: '13.150°N, 80.420°E',
    originWindow: 'Discharge Window: T - 18h to - 22h',
    originAreaKm2: 42.1,
    suspectVessel: 'PACIFIC GLORY (MMSI 419009988)',
    backtrackConfidencePct: 78,
    coastalZoneName: 'Pulicat Lake Estuary & Ennore Shoals',
    overallLandfallEta: '18h 45m (IMMINENT THREAT)',
    vulnerableHabitats: [
      'Pulicat Lagoon Saltwater Barrier Sandbars (9.5 km NNW)',
      'Ennore Thermal Power Plant Cooling Water Intakes (12 km WNW)',
      'Kattupalli Port Marina & Coromandel Mangroves',
    ],
    forecasts: [
      {
        timeOffsetHours: 6,
        label: 'T + 6 Hours',
        timestamp: 'T + 06:00 UTC',
        lat: 13.295,
        lng: 80.430,
        areaKm2: 5.2,
        slickRadiusKm: 1.29,
        driftSpeedKnots: 0.85,
        headingDeg: 338,
        distanceToCoastKm: 14.2,
        evaporatedPct: 8,
        emulsifiedPct: 15,
        dispersedPct: 3,
        remainingSurfacePct: 74,
        viscosityCSt: 1450,
        waterContentPct: 28,
        threatLevel: 'MODERATE',
        containmentRecommendation: 'Dispatch high-buoyancy ocean booms to enclose Ennore Outer Channel.',
      },
      {
        timeOffsetHours: 12,
        label: 'T + 12 Hours',
        timestamp: 'T + 12:00 UTC',
        lat: 13.345,
        lng: 80.398,
        areaKm2: 10.8,
        slickRadiusKm: 1.85,
        driftSpeedKnots: 0.88,
        headingDeg: 335,
        distanceToCoastKm: 8.6,
        evaporatedPct: 12,
        emulsifiedPct: 32,
        dispersedPct: 6,
        remainingSurfacePct: 50,
        viscosityCSt: 3800,
        waterContentPct: 48,
        threatLevel: 'HIGH',
        containmentRecommendation: 'Heavy fuel oil emulsifying rapidly. Dispersants ineffective; switch to mechanical skimming.',
      },
      {
        timeOffsetHours: 24,
        label: 'T + 24 Hours',
        timestamp: 'T + 24:00 UTC',
        lat: 13.438,
        lng: 80.335,
        areaKm2: 21.4,
        slickRadiusKm: 2.61,
        driftSpeedKnots: 0.84,
        headingDeg: 332,
        distanceToCoastKm: 2.4,
        evaporatedPct: 15,
        emulsifiedPct: 48,
        dispersedPct: 8,
        remainingSurfacePct: 29,
        viscosityCSt: 8200,
        waterContentPct: 68,
        threatLevel: 'CRITICAL',
        containmentRecommendation: 'Urgent shore defense: seal Pulicat tidal inlet with bubble barrier and sorbent curtains.',
      },
      {
        timeOffsetHours: 36,
        label: 'T + 36 Hours',
        timestamp: 'T + 36:00 UTC',
        lat: 13.520,
        lng: 80.285,
        areaKm2: 32.5,
        slickRadiusKm: 3.22,
        driftSpeedKnots: 0.80,
        headingDeg: 330,
        distanceToCoastKm: 0.0,
        evaporatedPct: 17,
        emulsifiedPct: 54,
        dispersedPct: 9,
        remainingSurfacePct: 20,
        viscosityCSt: 14500,
        waterContentPct: 75,
        threatLevel: 'CRITICAL',
        containmentRecommendation: 'Beach cleanup protocol activated; coastal tar-ball collection teams mobilized.',
      },
      {
        timeOffsetHours: 48,
        label: 'T + 48 Hours',
        timestamp: 'T + 48:00 UTC',
        lat: 13.590,
        lng: 80.245,
        areaKm2: 41.0,
        slickRadiusKm: 3.61,
        driftSpeedKnots: 0.75,
        headingDeg: 328,
        distanceToCoastKm: 0.0,
        evaporatedPct: 18,
        emulsifiedPct: 58,
        dispersedPct: 10,
        remainingSurfacePct: 14,
        viscosityCSt: 18200,
        waterContentPct: 80,
        threatLevel: 'CRITICAL',
        containmentRecommendation: 'Subsurface net retrieval for dense weathered bitumen residue.',
      },
    ],
  },
  'INC-003': {
    scenarioId: 'INC-2026-003',
    incidentName: 'Andaman Sea Bilge Discharge',
    seaBasin: 'Andaman Sea Malacca Approach',
    oilType: 'Oily Bilge Water / Light Fuel Mixture',
    apiGravity: '38.0° API',
    initialObservedCoords: '10.456°N, 93.123°E',
    initialAreaKm2: 0.95,
    currentVector: '0.32 m/s @ 315° (NW Monsoon Drift)',
    windVector: '5.4 m/s @ 210° (SSW Breeze)',
    seaState: 'Sea State 2 (Wave H_s: 0.9 m)',
    sstCelsius: 29.8,
    originCoords: '10.380°N, 93.080°E',
    originWindow: 'Discharge Window: T - 12h to - 16h',
    originAreaKm2: 24.5,
    suspectVessel: 'UNKNOWN (DARK VESSEL / SAR DETECTED)',
    backtrackConfidencePct: 74,
    coastalZoneName: 'Little Andaman Sea Corridor',
    overallLandfallEta: '> 72h (Deep Ocean Drift)',
    vulnerableHabitats: [
      'Little Andaman Coral Reef Enclave (62 km West)',
      'International Commercial Shipping Channel 7',
    ],
    forecasts: [
      {
        timeOffsetHours: 6,
        label: 'T + 6 Hours',
        timestamp: 'T + 06:00 UTC',
        lat: 10.485,
        lng: 93.148,
        areaKm2: 2.1,
        slickRadiusKm: 0.82,
        driftSpeedKnots: 0.52,
        headingDeg: 322,
        distanceToCoastKm: 68.2,
        evaporatedPct: 32,
        emulsifiedPct: 5,
        dispersedPct: 14,
        remainingSurfacePct: 49,
        viscosityCSt: 12,
        waterContentPct: 10,
        threatLevel: 'LOW',
        containmentRecommendation: 'High natural evaporation rate; monitor via satellite SAR passes.',
      },
      {
        timeOffsetHours: 12,
        label: 'T + 12 Hours',
        timestamp: 'T + 12:00 UTC',
        lat: 10.520,
        lng: 93.175,
        areaKm2: 4.2,
        slickRadiusKm: 1.16,
        driftSpeedKnots: 0.55,
        headingDeg: 320,
        distanceToCoastKm: 64.0,
        evaporatedPct: 48,
        emulsifiedPct: 8,
        dispersedPct: 22,
        remainingSurfacePct: 22,
        viscosityCSt: 25,
        waterContentPct: 15,
        threatLevel: 'LOW',
        containmentRecommendation: 'Thin rainbow sheen rapidly dissipating under tropical insolation.',
      },
      {
        timeOffsetHours: 24,
        label: 'T + 24 Hours',
        timestamp: 'T + 24:00 UTC',
        lat: 10.590,
        lng: 93.220,
        areaKm2: 7.8,
        slickRadiusKm: 1.58,
        driftSpeedKnots: 0.58,
        headingDeg: 318,
        distanceToCoastKm: 58.5,
        evaporatedPct: 58,
        emulsifiedPct: 10,
        dispersedPct: 26,
        remainingSurfacePct: 6,
        viscosityCSt: 45,
        waterContentPct: 20,
        threatLevel: 'LOW',
        containmentRecommendation: 'Residual sheen below MARPOL regulatory threshold within 30 hours.',
      },
      {
        timeOffsetHours: 36,
        label: 'T + 36 Hours',
        timestamp: 'T + 36:00 UTC',
        lat: 10.655,
        lng: 93.265,
        areaKm2: 9.5,
        slickRadiusKm: 1.74,
        driftSpeedKnots: 0.54,
        headingDeg: 315,
        distanceToCoastKm: 53.0,
        evaporatedPct: 64,
        emulsifiedPct: 11,
        dispersedPct: 23,
        remainingSurfacePct: 2,
        viscosityCSt: 60,
        waterContentPct: 22,
        threatLevel: 'LOW',
        containmentRecommendation: 'Dispersed background baseline level.',
      },
      {
        timeOffsetHours: 48,
        label: 'T + 48 Hours',
        timestamp: 'T + 48:00 UTC',
        lat: 10.720,
        lng: 93.310,
        areaKm2: 10.2,
        slickRadiusKm: 1.80,
        driftSpeedKnots: 0.51,
        headingDeg: 312,
        distanceToCoastKm: 48.0,
        evaporatedPct: 67,
        emulsifiedPct: 12,
        dispersedPct: 20,
        remainingSurfacePct: 1,
        viscosityCSt: 75,
        waterContentPct: 24,
        threatLevel: 'LOW',
        containmentRecommendation: 'No active shoreline risk detected.',
      },
    ],
  },
  'INC-004': {
    scenarioId: 'INC-2026-004',
    incidentName: 'Goa Coastal Bunkering Sheen',
    seaBasin: 'Goa Coastal Waters',
    oilType: 'Marine Gas Oil (MGO)',
    apiGravity: '36.5° API',
    initialObservedCoords: '15.420°N, 73.650°E',
    initialAreaKm2: 1.75,
    currentVector: '0.28 m/s @ 165° (SSE Nearshore Tidal)',
    windVector: '4.8 m/s @ 280° (Westerly Onshore Breeze)',
    seaState: 'Sea State 2 (Wave H_s: 0.8 m)',
    sstCelsius: 28.7,
    originCoords: '15.460°N, 73.610°E',
    originWindow: 'Discharge Window: T - 08h to - 12h',
    originAreaKm2: 18.2,
    suspectVessel: 'SEA PEARL (MMSI 419003322)',
    backtrackConfidencePct: 82,
    coastalZoneName: 'Mormugao Port Outer Anchorage & Baina Beach',
    overallLandfallEta: '32h 10m',
    vulnerableHabitats: [
      'Baina Beach Coastal Tourism & Fishing Staging Area (11 km ESE)',
      'Zuari River Estuarine Mangrove Complex',
    ],
    forecasts: [
      {
        timeOffsetHours: 6,
        label: 'T + 6 Hours',
        timestamp: 'T + 06:00 UTC',
        lat: 15.395,
        lng: 73.675,
        areaKm2: 3.4,
        slickRadiusKm: 1.04,
        driftSpeedKnots: 0.48,
        headingDeg: 155,
        distanceToCoastKm: 9.8,
        evaporatedPct: 22,
        emulsifiedPct: 4,
        dispersedPct: 8,
        remainingSurfacePct: 66,
        viscosityCSt: 18,
        waterContentPct: 12,
        threatLevel: 'LOW',
        containmentRecommendation: 'Port authority tug with containment sweep deployed in anchorage fairway.',
      },
      {
        timeOffsetHours: 12,
        label: 'T + 12 Hours',
        timestamp: 'T + 12:00 UTC',
        lat: 15.365,
        lng: 73.705,
        areaKm2: 6.2,
        slickRadiusKm: 1.40,
        driftSpeedKnots: 0.50,
        headingDeg: 152,
        distanceToCoastKm: 7.2,
        evaporatedPct: 34,
        emulsifiedPct: 8,
        dispersedPct: 14,
        remainingSurfacePct: 44,
        viscosityCSt: 32,
        waterContentPct: 22,
        threatLevel: 'MODERATE',
        containmentRecommendation: 'Deploy sorbent boom line across Zuari river mouth approach.',
      },
      {
        timeOffsetHours: 24,
        label: 'T + 24 Hours',
        timestamp: 'T + 24:00 UTC',
        lat: 15.310,
        lng: 73.748,
        areaKm2: 11.8,
        slickRadiusKm: 1.94,
        driftSpeedKnots: 0.52,
        headingDeg: 150,
        distanceToCoastKm: 3.9,
        evaporatedPct: 46,
        emulsifiedPct: 14,
        dispersedPct: 18,
        remainingSurfacePct: 22,
        viscosityCSt: 58,
        waterContentPct: 35,
        threatLevel: 'HIGH',
        containmentRecommendation: 'Mobilize Coast Guard District HQ 11 response craft with disc skimmers.',
      },
      {
        timeOffsetHours: 36,
        label: 'T + 36 Hours',
        timestamp: 'T + 36:00 UTC',
        lat: 15.250,
        lng: 73.785,
        areaKm2: 17.5,
        slickRadiusKm: 2.36,
        driftSpeedKnots: 0.49,
        headingDeg: 148,
        distanceToCoastKm: 1.1,
        evaporatedPct: 52,
        emulsifiedPct: 18,
        dispersedPct: 20,
        remainingSurfacePct: 10,
        viscosityCSt: 95,
        waterContentPct: 45,
        threatLevel: 'CRITICAL',
        containmentRecommendation: 'Shoreline boom defense active along Baina Beach shorelines.',
      },
      {
        timeOffsetHours: 48,
        label: 'T + 48 Hours',
        timestamp: 'T + 48:00 UTC',
        lat: 15.195,
        lng: 73.820,
        areaKm2: 21.0,
        slickRadiusKm: 2.59,
        driftSpeedKnots: 0.45,
        headingDeg: 145,
        distanceToCoastKm: 0.0,
        evaporatedPct: 55,
        emulsifiedPct: 20,
        dispersedPct: 21,
        remainingSurfacePct: 4,
        viscosityCSt: 140,
        waterContentPct: 50,
        threatLevel: 'CRITICAL',
        containmentRecommendation: 'Post-landfall recovery and environmental remediation monitoring.',
      },
    ],
  },
};

export const DriftView: React.FC<DriftViewProps> = ({ onSelectTab, currentScenario, onSelectScenario }) => {
  // Determine active scenario key
  const defaultKey = currentScenario?.id.includes('002')
    ? 'INC-002'
    : currentScenario?.id.includes('003')
    ? 'INC-003'
    : currentScenario?.id.includes('004')
    ? 'INC-004'
    : 'INC-001';

  const [selectedKey, setSelectedKey] = useState<string>(defaultKey);
  const [activeMode, setActiveMode] = useState<'forward' | 'backward' | 'unified'>('forward');
  const [selectedStepIndex, setSelectedStepIndex] = useState<number>(2); // T+24h by default
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simProgress, setSimProgress] = useState<number>(100);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Sync when currentScenario changes
  useEffect(() => {
    if (currentScenario?.id) {
      const matchedKey = Object.keys(SCENARIOS).find(
        (k) => SCENARIOS[k].id === currentScenario.id || currentScenario.id.includes(k.replace('INC-', ''))
      );
      if (matchedKey) setSelectedKey(matchedKey);
    }
  }, [currentScenario]);

  const profile = DRIFT_PROFILES[selectedKey] || DRIFT_PROFILES['INC-001'];
  const currentForecast = profile.forecasts[selectedStepIndex] || profile.forecasts[2];

  const handleRunSimulation = () => {
    setIsSimulating(true);
    setSimProgress(0);
    const interval = setInterval(() => {
      setSimProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsSimulating(false);
          return 100;
        }
        return prev + 25;
      });
    }, 250);
  };

  const handleExportGeoJSON = () => {
    const geojson = {
      type: 'FeatureCollection',
      incident: profile.incidentName,
      scenarioId: profile.scenarioId,
      exportedAt: new Date().toISOString(),
      features: profile.forecasts.map((f) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [f.lng, f.lat],
        },
        properties: {
          timestep: f.label,
          timestamp: f.timestamp,
          area_km2: f.areaKm2,
          slick_radius_km: f.slickRadiusKm,
          drift_speed_knots: f.driftSpeedKnots,
          heading_deg: f.headingDeg,
          distance_to_coast_km: f.distanceToCoastKm,
          evaporated_pct: f.evaporatedPct,
          emulsified_pct: f.emulsifiedPct,
          dispersed_pct: f.dispersedPct,
          remaining_surface_pct: f.remainingSurfacePct,
          viscosity_cst: f.viscosityCSt,
          threat_level: f.threatLevel,
          recommendation: f.containmentRecommendation,
        },
      })),
    };

    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `future_drift_trajectory_${profile.scenarioId}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
    setExportNotice('Exported GeoJSON trajectory package.');
    setTimeout(() => setExportNotice(null), 3500);
  };

  return (
    <div id="tab-drift" className="tab-content visible">
      {/* PAGE HEADER */}
      <div className="page-header" style={{ paddingTop: 'var(--sp-4)' }}>
        <div>
          <div className="flex items-center gap-3">
            <div className="page-title">Lagrangian Hydrodynamic Drift Simulation</div>
            <span className="id-tag">OpenDrift / OpenOil</span>
            <span
              className="chip"
              style={{
                background: 'rgba(56, 189, 248, 0.15)',
                color: 'var(--accent)',
                borderColor: 'rgba(56, 189, 248, 0.3)',
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              CMEMS &amp; ERA5 10m FORCING
            </span>
          </div>
          <div className="page-subtitle">
            Bidirectional Monte Carlo Dispersion (N=1,000 particles) · Reverse Origin Backtracking &amp; Forward Future Impact Projection
          </div>
        </div>

        <div className="page-actions" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          {/* SCENARIO SELECTOR */}
          <select
            value={selectedKey}
            onChange={(e) => {
              const k = e.target.value;
              setSelectedKey(k);
              setSelectedStepIndex(2);
              if (SCENARIOS[k]) {
                onSelectScenario?.(k);
              }
            }}
            className="input-select"
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
            }}
          >
            {Object.entries(SCENARIOS).map(([key, sc]) => (
              <option key={key} value={key}>
                {sc.id} · {sc.title}
              </option>
            ))}
          </select>

          <button
            className="btn btn-secondary"
            onClick={handleRunSimulation}
            disabled={isSimulating}
            style={{ gap: 6, fontSize: 12 }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 16,
                animation: isSimulating ? 'spin 1s linear infinite' : 'none',
              }}
            >
              {isSimulating ? 'sync' : 'play_circle'}
            </span>
            {isSimulating ? `Calculating (${simProgress}%)` : 'Run OpenDrift'}
          </button>

          <button
            className="btn btn-primary"
            onClick={() => onSelectTab('attribution')}
            style={{ gap: 6, fontSize: 12 }}
          >
            Vessel Attribution
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              arrow_forward
            </span>
          </button>
        </div>
      </div>

      {exportNotice && (
        <div
          style={{
            padding: '8px 14px',
            marginBottom: 'var(--sp-3)',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 12,
            color: '#10b981',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>
          {exportNotice}
        </div>
      )}

      {/* SIMULATION MODE TOGGLE */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-2)',
          marginBottom: 'var(--sp-4)',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: 'var(--sp-2)',
        }}
      >
        <button
          onClick={() => setActiveMode('forward')}
          style={{
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: 700,
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: activeMode === 'forward' ? 'var(--accent)' : 'var(--bg-raised)',
            color: activeMode === 'forward' ? '#fff' : 'var(--text-muted)',
            transition: 'all 0.15s ease',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>trending_up</span>
          Future Drift &amp; Shoreline Forecast (T0 → T+48h)
        </button>

        <button
          onClick={() => setActiveMode('backward')}
          style={{
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: 700,
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: activeMode === 'backward' ? 'var(--drift-color)' : 'var(--bg-raised)',
            color: activeMode === 'backward' ? '#fff' : 'var(--text-muted)',
            transition: 'all 0.15s ease',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>history</span>
          Origin Probability Backtracking (T-24h → T0)
        </button>

        <button
          onClick={() => setActiveMode('unified')}
          style={{
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: 700,
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: activeMode === 'unified' ? 'var(--text-primary)' : 'var(--bg-raised)',
            color: activeMode === 'unified' ? 'var(--bg-base)' : 'var(--text-muted)',
            transition: 'all 0.15s ease',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>alt_route</span>
          Unified Spatiotemporal Lifecycle (T-24h → T+48h)
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={handleExportGeoJSON}
            style={{ padding: '4px 10px', fontSize: 11, gap: 5 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>download</span>
            Export GeoJSON Trajectory
          </button>
        </div>
      </div>

      {/* MAIN TWO-COLUMN CONTENT AREA */}
      <div className="content-area" style={{ alignItems: 'start' }}>
        {/* LEFT COLUMN: ACTIVE MODE INTELLIGENCE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          {/* ========================================================================= */}
          {/* MODE: FORWARD FUTURE FORECAST RESULTS (REQUESTED FEATURE)                 */}
          {/* ========================================================================= */}
          {(activeMode === 'forward' || activeMode === 'unified') && (
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--accent)' }}>
                    radar
                  </span>
                  Future Slick Dispersion &amp; Trajectory Forecast (Forward Time)
                </span>
                <span
                  className="chip"
                  style={{
                    background:
                      currentForecast.threatLevel === 'CRITICAL'
                        ? 'rgba(239, 68, 68, 0.15)'
                        : 'rgba(245, 158, 11, 0.15)',
                    color: currentForecast.threatLevel === 'CRITICAL' ? '#ef4444' : '#f59e0b',
                    borderColor:
                      currentForecast.threatLevel === 'CRITICAL'
                        ? 'rgba(239, 68, 68, 0.3)'
                        : 'rgba(245, 158, 11, 0.3)',
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  LANDFALL THREAT: {currentForecast.threatLevel}
                </span>
              </div>

              <div className="panel-body">
                {/* TIMESTEP STEP SELECTOR / SCRUBBER */}
                <div style={{ marginBottom: 'var(--sp-4)' }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      marginBottom: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>Forecast Horizon Timeline (Forward Hydrodynamic Steps)</span>
                    <span style={{ color: 'var(--accent)' }}>Active: {currentForecast.label} ({currentForecast.timestamp})</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--sp-2)' }}>
                    {profile.forecasts.map((f, idx) => {
                      const isSelected = selectedStepIndex === idx;
                      return (
                        <button
                          key={f.label}
                          onClick={() => setSelectedStepIndex(idx)}
                          style={{
                            padding: '10px 8px',
                            borderRadius: 'var(--radius-sm)',
                            border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                            background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'var(--bg-raised)',
                            cursor: 'pointer',
                            textAlign: 'center',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 700, color: isSelected ? 'var(--accent)' : 'var(--text-primary)' }}>
                            {f.label}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                            {f.areaKm2} km² · {f.distanceToCoastKm > 0 ? `${f.distanceToCoastKm} km` : 'Coast'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* CRITICAL FUTURE SUMMARY METRICS */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 'var(--sp-3)',
                    marginBottom: 'var(--sp-4)',
                  }}
                >
                  <div
                    style={{
                      background: 'var(--bg-raised)',
                      padding: 12,
                      borderRadius: 4,
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div className="text-xs text-muted fw-600">Projected Centroid ({currentForecast.label})</div>
                    <div className="text-base fw-700" style={{ color: 'var(--accent)', marginTop: 2 }}>
                      {currentForecast.lat.toFixed(3)}°N, {currentForecast.lng.toFixed(3)}°E
                    </div>
                    <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                      Drift: {currentForecast.driftSpeedKnots} kn @ {currentForecast.headingDeg}° (ENE)
                    </div>
                  </div>

                  <div
                    style={{
                      background: 'var(--bg-raised)',
                      padding: 12,
                      borderRadius: 4,
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div className="text-xs text-muted fw-600">Fay Spreading Area Expansion</div>
                    <div className="text-base fw-700" style={{ marginTop: 2 }}>
                      {currentForecast.areaKm2} km²
                      <span style={{ fontSize: 11, color: '#ef4444', marginLeft: 6, fontWeight: 600 }}>
                        (+{((currentForecast.areaKm2 / profile.initialAreaKm2 - 1) * 100).toFixed(0)}%)
                      </span>
                    </div>
                    <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                      Equiv. Slick Radius: {currentForecast.slickRadiusKm} km
                    </div>
                  </div>

                  <div
                    style={{
                      background: 'var(--bg-raised)',
                      padding: 12,
                      borderRadius: 4,
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div className="text-xs text-muted fw-600">Shoreline Distance &amp; ETA</div>
                    <div
                      className="text-base fw-700"
                      style={{
                        marginTop: 2,
                        color: currentForecast.distanceToCoastKm < 15 ? '#ef4444' : 'var(--text-primary)',
                      }}
                    >
                      {currentForecast.distanceToCoastKm > 0 ? `${currentForecast.distanceToCoastKm} km to coast` : 'SHORELINE LANDFALL'}
                    </div>
                    <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                      Target: {profile.coastalZoneName}
                    </div>
                  </div>
                </div>

                {/* COASTAL THREAT & HABITAT IMPACT BANNER */}
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background:
                      currentForecast.threatLevel === 'CRITICAL'
                        ? 'rgba(239, 68, 68, 0.08)'
                        : 'rgba(245, 158, 11, 0.08)',
                    borderLeft: `4px solid ${
                      currentForecast.threatLevel === 'CRITICAL' ? '#ef4444' : '#f59e0b'
                    }`,
                    marginBottom: 'var(--sp-4)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                      Coastal Threat Assessment · Landfall ETA: {profile.overallLandfallEta}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: currentForecast.threatLevel === 'CRITICAL' ? '#ef4444' : '#f59e0b',
                      }}
                    >
                      COASTAL VULNERABILITY INDEX: HIGH
                    </span>
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 8 }}>
                    Slick advection driven by combined CMEMS current ({profile.currentVector}) and ERA5 Stokes windage ({profile.windVector}).
                    Targeting sensitive coastal shelf zone: <strong>{profile.coastalZoneName}</strong>.
                  </div>

                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                    Vulnerable Marine Receptors in Projected Cone:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    {profile.vulnerableHabitats.map((hab, idx) => (
                      <li key={idx}>{hab}</li>
                    ))}
                  </ul>
                </div>

                {/* OIL WEATHERING & MASS BALANCE (OPENOIL MODEL) */}
                <div style={{ marginBottom: 'var(--sp-3)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                    <span>OpenOil Weathering &amp; Mass Balance at {currentForecast.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>
                      Viscosity: {currentForecast.viscosityCSt} cSt (Initial: 15 cSt) · Water Content: {currentForecast.waterContentPct}%
                    </span>
                  </div>

                  {/* MULTI-SEGMENT PROGRESS BAR */}
                  <div
                    style={{
                      height: 18,
                      borderRadius: 4,
                      overflow: 'hidden',
                      display: 'flex',
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border-subtle)',
                      marginBottom: 8,
                    }}
                  >
                    <div
                      title="Evaporated"
                      style={{
                        width: `${currentForecast.evaporatedPct}%`,
                        background: '#38bdf8',
                      }}
                    />
                    <div
                      title="Emulsified Mousse"
                      style={{
                        width: `${currentForecast.emulsifiedPct}%`,
                        background: '#d97706',
                      }}
                    />
                    <div
                      title="Naturally Dispersed"
                      style={{
                        width: `${currentForecast.dispersedPct}%`,
                        background: '#10b981',
                      }}
                    />
                    <div
                      title="Persistent Surface Slick"
                      style={{
                        width: `${currentForecast.remainingSurfacePct}%`,
                        background: '#ef4444',
                      }}
                    />
                  </div>

                  {/* LEGEND */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, fontSize: 11 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: '#38bdf8', display: 'inline-block' }} />
                      <span className="text-muted">Evaporated:</span>
                      <strong className="mono">{currentForecast.evaporatedPct}%</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: '#d97706', display: 'inline-block' }} />
                      <span className="text-muted">Emulsified:</span>
                      <strong className="mono">{currentForecast.emulsifiedPct}%</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: '#10b981', display: 'inline-block' }} />
                      <span className="text-muted">Dispersed:</span>
                      <strong className="mono">{currentForecast.dispersedPct}%</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: '#ef4444', display: 'inline-block' }} />
                      <span className="text-muted">Surface Slick:</span>
                      <strong className="mono">{currentForecast.remainingSurfacePct}%</strong>
                    </div>
                  </div>
                </div>

                {/* TACTICAL COUNTERMEASURE RECOMMENDATION */}
                <div
                  style={{
                    background: 'var(--bg-raised)',
                    padding: '10px 12px',
                    borderRadius: 4,
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--accent)' }}>
                    shield
                  </span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
                      Tactical Containment Directive:
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {currentForecast.containmentRecommendation}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODE: BACKWARD ORIGIN ENVELOPE ANALYSIS (ORIGINAL IMAGE 1 FIDELITY)      */}
          {/* ========================================================================= */}
          {(activeMode === 'backward' || activeMode === 'unified') && (
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>cyclone</span>
                  Origin Probability Envelope Analysis (Reverse Time)
                </span>
                <span
                  className="chip"
                  style={{
                    background: 'rgba(217,119,6,.10)',
                    color: 'var(--drift-color)',
                    borderColor: 'rgba(217,119,6,.25)',
                    fontSize: 9,
                  }}
                >
                  PHYSICS BACKTRACKING
                </span>
              </div>
              <div className="panel-body">
                <div className="prob-note" style={{ marginBottom: 'var(--sp-4)' }}>
                  <strong>Operational Hydrodynamic Rule:</strong> Because sea surface currents and wind drift constantly
                  transport oil films, a detected slick position is NEVER the discharge point. OpenDrift reverses the
                  advection-diffusion equation to isolate the exact space-time envelope where discharge statistically occurred.
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 'var(--sp-3)',
                    marginBottom: 'var(--sp-4)',
                  }}
                >
                  <div
                    style={{
                      background: 'var(--bg-raised)',
                      padding: 10,
                      borderRadius: 4,
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div className="text-xs text-muted fw-600">50% Core Probability</div>
                    <div className="text-base fw-700" style={{ color: 'var(--drift-color)' }}>
                      {profile.originCoords}
                    </div>
                    <div className="text-xs text-muted">{profile.originWindow}</div>
                  </div>
                  <div
                    style={{
                      background: 'var(--bg-raised)',
                      padding: 10,
                      borderRadius: 4,
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div className="text-xs text-muted fw-600">75% Probability Area</div>
                    <div className="text-base fw-700">{profile.originAreaKm2} km²</div>
                    <div className="text-xs text-muted">Spatiotemporal uncertainty radius</div>
                  </div>
                  <div
                    style={{
                      background: 'var(--bg-raised)',
                      padding: 10,
                      borderRadius: 4,
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div className="text-xs text-muted fw-600">Total Particles Trailed</div>
                    <div className="text-base fw-700">1,000 Lagrangian</div>
                    <div className="text-xs text-muted">Runge-Kutta 4th Order Integrator</div>
                  </div>
                </div>

                {/* ATTRIBUTED SUSPECT VESSEL MATCH CARD */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: 'var(--bg-raised)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#ef4444' }}>
                      directions_boat
                    </span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                        Attributed Discharge Suspect: {profile.suspectVessel}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Backtrack Intersection Confidence: {profile.backtrackConfidencePct}% · Spatiotemporal correlation confirmed
                      </div>
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary"
                    onClick={() => onSelectTab('attribution')}
                    style={{ padding: '4px 10px', fontSize: 11, gap: 4 }}
                  >
                    View AIS Track
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: HYDRODYNAMIC ENGINE PARAMETERS & OCEAN FORCING */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          {/* HYDRODYNAMIC ENGINE PARAMETERS (IMAGE 1 FIDELITY) */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>tune</span>
                Hydrodynamic Engine Parameters
              </span>
              <span className="id-tag">ODE SOLVER: RK4</span>
            </div>
            <div className="panel-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)', marginBottom: 'var(--sp-3)' }}>
                <div>
                  <div className="text-xs text-muted">Integration Time Step</div>
                  <div className="mono fw-700">15 minutes</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Wind Drag Coefficient</div>
                  <div className="mono fw-700">3.5% (Stokes Drift)</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Horizontal Diffusivity</div>
                  <div className="mono fw-700">10 m²/s</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Current Layer Depth</div>
                  <div className="mono fw-700">0.0 – 1.0 m (Ekman)</div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--sp-3)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Active Environmental Forcing:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted">CMEMS Current:</span>
                    <span className="mono fw-600">{profile.currentVector}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted">ERA5 10m Wind:</span>
                    <span className="mono fw-600">{profile.windVector}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted">Sea Surface Temp:</span>
                    <span className="mono fw-600">{profile.sstCelsius}°C ({profile.seaState})</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted">Oil Hydrocarbon Grade:</span>
                    <span className="mono fw-600">{profile.oilType} ({profile.apiGravity})</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SPATIOTEMPORAL WAYPOINT TABLE */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>route</span>
                Simulation Trajectory Table
              </span>
              <span className="text-xs text-muted">5 Timesteps</span>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-raised)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px' }}>Step</th>
                      <th style={{ padding: '8px 10px' }}>Coordinates</th>
                      <th style={{ padding: '8px 10px' }}>Area</th>
                      <th style={{ padding: '8px 10px' }}>Coast Dist</th>
                      <th style={{ padding: '8px 10px' }}>Threat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.forecasts.map((f, idx) => (
                      <tr
                        key={f.label}
                        onClick={() => setSelectedStepIndex(idx)}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          background: selectedStepIndex === idx ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--accent)' }}>{f.label}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>
                          {f.lat.toFixed(2)}°, {f.lng.toFixed(2)}°
                        </td>
                        <td style={{ padding: '8px 10px' }}>{f.areaKm2} km²</td>
                        <td style={{ padding: '8px 10px' }}>{f.distanceToCoastKm > 0 ? `${f.distanceToCoastKm} km` : '0 km (Landfall)'}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <span
                            className="chip"
                            style={{
                              fontSize: 9,
                              padding: '2px 6px',
                              background:
                                f.threatLevel === 'CRITICAL'
                                  ? 'rgba(239, 68, 68, 0.15)'
                                  : 'rgba(245, 158, 11, 0.15)',
                              color: f.threatLevel === 'CRITICAL' ? '#ef4444' : '#f59e0b',
                            }}
                          >
                            {f.threatLevel}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

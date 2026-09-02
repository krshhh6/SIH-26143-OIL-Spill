import type { Scenario, CandidateVessel } from '../types/dashboard';

export const SCENARIOS: Record<string, Scenario> = {
  'INC-001': {
    id: 'INC-2026-001',
    title: 'Mumbai High Offshore Basin',
    sub: 'Mumbai High Offshore Basin · Arabian Sea EEZ · 18.743°N, 71.218°E',
    lat: 18.743,
    lng: 71.218,
    oilType: 'Crude Oil',
    oilColor: '#B45309',
    oilFill: 'rgba(180, 83, 9, 0.45)',
    sev: 'CRITICAL SEVERITY',
    sevClass: 'chip-c',

    topVessel: 'CRUDE ATLAS',
    diagVessel: 'CRUDE ATLAS · MMSI 419001234',
    diagDetails: 'Transponder Silent: 04:17–08:52 UTC (4h 35m) · Speed drop: 13.2kn → 4.1kn in origin envelope',
    scores: [0.82, 0.61, 0.34]
  },
  'INC-002': {
    id: 'INC-2026-002',
    title: 'Chennai–Ennore Coastal Corridor',
    sub: 'Chennai–Ennore Coastal Corridor · Bay of Bengal · 13.234°N, 80.345°E',
    lat: 13.234,
    lng: 80.345,
    oilType: 'Heavy Bunker Fuel',
    oilColor: '#0D0D11',
    oilFill: 'rgba(13, 13, 17, 0.70)',
    sev: 'HIGH SEVERITY',
    sevClass: 'chip-h',
    topVessel: 'PACIFIC GLORY',
    diagVessel: 'PACIFIC GLORY · MMSI 419009988',
    diagDetails: 'Bunker fuel collision trail · AIS intermittent 02:10–05:40 UTC',
    scores: [0.68, 0.54, 0.28]
  },
  'INC-003': {
    id: 'INC-2026-003',
    title: 'Andaman Sea Shipping Lane 7',
    sub: 'Andaman Sea SL-7 · Malacca Route Approach · 10.456°N, 93.123°E',
    lat: 10.456,
    lng: 93.123,
    oilType: 'Oil Bilge Water',
    oilColor: '#38BDF8',
    oilFill: 'rgba(56, 189, 248, 0.45)',
    sev: 'MEDIUM SEVERITY',
    sevClass: 'chip-m',
    topVessel: 'UNKNOWN (DARK VESSEL)',
    diagVessel: 'TRANSPONDER BLACKOUT · SAR IDENTIFIED',
    diagDetails: 'Metallic SAR return detected in slick centroid with NO matching AIS transmission',
    scores: [0.74, 0.42, 0.19]
  },
  'INC-004': {
    id: 'INC-2026-004',
    title: 'Goa Coastal Waters (Bunkering Leak)',
    sub: 'Goa Coastal Waters · 15.421°N, 73.682°E · Coastal Fisheries Zone',
    lat: 15.421,
    lng: 73.682,
    oilType: 'Diesel / Marine Gas Oil',
    oilColor: '#EAB308',
    oilFill: 'rgba(234, 179, 8, 0.45)',
    sev: 'LOW SEVERITY',
    sevClass: 'chip-l',
    topVessel: 'SEA PEARL',
    diagVessel: 'SEA PEARL · MMSI 419003322',
    diagDetails: 'Marine Gas Oil sheen from bunkering hose failure · Continuous AIS broadcast',
    scores: [0.55, 0.38, 0.21]
  }
};

export const INITIAL_CANDIDATE_VESSELS: CandidateVessel[] = [
  {
    name: 'CRUDE ATLAS',
    mmsi: '419001234',
    flag: 'India',
    type: 'Crude Oil Tanker',
    score: 0.82,
    distScore: 0.92,
    timeScore: 0.88,
    gapScore: 0.75,
    typeScore: 0.90,
    aisStatus: 'CPA: 1.2 nm from envelope centroid · Speed: 4.1 kn · AIS Gap: 4h 35m (suspicious)',
    risk: 'CRITICAL'
  },
  {
    name: 'MARITIME KOHISTAN',
    mmsi: '419005678',
    flag: 'India',
    type: 'Product Tanker',
    score: 0.61,
    distScore: 0.65,
    timeScore: 0.70,
    gapScore: 0.50,
    typeScore: 0.80,
    aisStatus: 'CPA: 3.8 nm from centroid · Speed: 12.4 kn · AIS Gap: 3h 33m',
    risk: 'HIGH'
  },
  {
    name: 'GULF NAVIGATOR',
    mmsi: '419007890',
    flag: 'Panama',
    type: 'Chemical Tanker',
    score: 0.34,
    distScore: 0.30,
    timeScore: 0.40,
    gapScore: 0.25,
    typeScore: 0.70,
    aisStatus: 'CPA: 7.1 nm from centroid · Speed: 13.7 kn · AIS Gap: 1h 22m (normal shadow)',
    risk: 'LOW'
  }
];

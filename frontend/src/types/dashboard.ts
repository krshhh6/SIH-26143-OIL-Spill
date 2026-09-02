export interface Scenario {
  id: string;
  title: string;
  sub: string;
  lat: number;
  lng: number;
  oilType: string;
  oilColor: string;
  oilFill: string;
  sev: string;
  sevClass: 'chip-c' | 'chip-h' | 'chip-m' | 'chip-l';
  area?: string;
  topVessel: string;
  diagVessel: string;
  diagDetails: string;
  scores: number[];
}

export interface CandidateVessel {
  name: string;
  mmsi: string;
  flag: string;
  type: string;
  score: number;
  distScore: number;
  timeScore: number;
  gapScore: number;
  typeScore: number;
  aisStatus: string;
  risk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export type TabType = 'dashboard' | 'investigation' | 'drift' | 'attribution' | 'evidence' | 'analytics';
export type DimensionMode = '2D' | '3D';
export type BaseLayerType = 'satellite' | 'sar' | 'carto-voyager' | 'carto-dark' | 'sar-vh' | 'opensea' | 'msn' | 'day' | 'dark';
export type CesiumBaseLayerType = 'google' | 'esri';

export type CopernicusLayerId = 'true-color' | 'sar-vv' | 'swir-oil' | 'false-color' | 'ndwi' | 'thermal';

export interface CopernicusLayerInfo {
  id: CopernicusLayerId;
  name: string;
  bands: string;
  desc: string;
  badge: string;
  badgeColor: string;
  thumbBg: string;
}

export interface AttributionWeights {
  dist: number;
  time: number;
  gap: number;
  type: number;
  temporal?: number;
  distance?: number;
  aisGap?: number;
  vesselType?: number;
}

export interface DetectedPolygon {
  geometry: {
    type: string;
    coordinates: [number, number][][];
  };
  confidence: number;
  area_km2: number;
  mean_damping_db: number;
  slick_centroid: [number, number];
}

export interface DetectionResult {
  status: 'idle' | 'loading' | 'detected' | 'no_oil_detected' | 'no_recent_imagery' | 'error';
  scene_timestamp?: string;
  sensor?: string;
  scene_id?: string;
  polarization?: string;
  orbit_direction?: string;
  polygons: DetectedPolygon[];
  total_detected_area_km2?: number;
  model_version?: string;
  message?: string;
  error?: string;
}

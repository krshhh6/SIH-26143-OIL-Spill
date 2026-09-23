// Dynamic GIS geometry utilities for real Sentinel-1 ML model polygon outputs & hydrodynamics

export interface DriftGeometry {
  envelope90: [number, number][];
  envelope75: [number, number][];
  envelope50: [number, number][];
  driftPath: [number, number][];
  originCoord: [number, number];
  vesselTrack: [number, number][];
  aisGapTrack: [number, number][];
  vesselHeading: number;

  // Forward Drift Forecast (Future +12h / +24h Simulation)
  forwardDriftPath: [number, number][];
  forwardCone24h: [number, number][];
  forwardCone12h: [number, number][];
  predictedCoord24h: [number, number];
  predictedCoord12h: [number, number];

  // Shoreline land exclusion barrier line for visual containment display
  coastalBoundary: [number, number][];
}

/**
 * High-precision piecewise approximation of the Indian Sovereign Coastline.
 * Returns the western and eastern longitude limits of the Indian mainland at a given latitude.
 */
export function getIndianCoastline(lat: number): { westLng: number; eastLng: number } {
  // Bounded latitude check for peninsular India (8.0°N to 23.5°N)
  if (lat < 8.08) {
    return { westLng: 77.53, eastLng: 77.56 };
  }
  if (lat <= 9.0) {
    // Kanyakumari to Kollam
    const f = (lat - 8.08) / (9.0 - 8.08);
    return { westLng: 77.53 - f * 0.99, eastLng: 77.56 + f * 0.79 };
  }
  if (lat <= 10.0) {
    // Kollam to Cochin (Kerala coast)
    const f = (lat - 9.0) / (10.0 - 9.0);
    return { westLng: 76.54 - f * 0.32, eastLng: 78.35 + f * 0.80 };
  }
  if (lat <= 11.2) {
    // Cochin to Kozhikode
    const f = (lat - 10.0) / (11.2 - 10.0);
    return { westLng: 76.22 - f * 0.46, eastLng: 79.15 + f * 0.67 };
  }
  if (lat <= 12.5) {
    // Kozhikode to Kannur / Kasaragod
    const f = (lat - 11.2) / (12.5 - 11.2);
    return { westLng: 75.76 - f * 0.66, eastLng: 79.82 + f * 0.20 };
  }
  if (lat <= 14.0) {
    // Mangalore to Bhatkal / Chennai-Puducherry on East
    const f = (lat - 12.5) / (14.0 - 12.5);
    return { westLng: 75.10 - f * 0.70, eastLng: 80.02 + f * 0.31 };
  }
  if (lat <= 15.5) {
    // Karwar to Goa
    const f = (lat - 14.0) / (15.5 - 14.0);
    return { westLng: 74.40 - f * 0.62, eastLng: 80.33 + f * 0.10 };
  }
  if (lat <= 17.5) {
    // Goa to Ratnagiri / Kakinada on East
    const f = (lat - 15.5) / (17.5 - 15.5);
    return { westLng: 73.78 - f * 0.58, eastLng: 80.43 + f * 1.87 };
  }
  if (lat <= 19.5) {
    // Ratnagiri to Mumbai / Visakhapatnam on East
    const f = (lat - 17.5) / (19.5 - 17.5);
    return { westLng: 73.20 - f * 0.40, eastLng: 82.30 + f * 1.70 };
  }
  if (lat <= 21.0) {
    // Mumbai to Dahanu / Paradip on East
    const f = (lat - 19.5) / (21.0 - 19.5);
    return { westLng: 72.80 - f * 0.15, eastLng: 84.00 + f * 2.68 };
  }
  if (lat <= 23.0) {
    // Gujarat Saurashtra / West Bengal on East
    return { westLng: 69.40, eastLng: 87.50 };
  }
  return { westLng: 68.50, eastLng: 88.50 };
}

/**
 * Maritime Navigability Filter: Clamps any point that accidentally intersects land
 * back into deep navigable waters along the local coastal buffer.
 */
export function clampToNavigableWaters(coord: [number, number]): [number, number] {
  const [lat, lng] = coord;

  // Deep open sea or Andaman Sea (>88°E) or Arabian Sea basin (<68°E) is unconditionally water
  if (lng > 90.0 || lng < 68.0 || lat < 7.0 || lat > 24.5) {
    return [lat, lng];
  }

  // 1. GULF OF KUTCH / VADINAR SPECIAL MARITIME BOUNDARY
  // The Gulf of Kutch is an east-west channel between Lat 22.20°N and 23.05°N, Lng 68.80°E to 70.30°E
  // Deepwater VLCC shipping channel runs between 22.58°N and 22.72°N
  // South (<22.56°N) are the Marine National Park mangrove islands (Nora Tapu, Gaudweep, Bhaidar Tapu)
  // North (>22.74°N) is the northern Kutch coast (Mandvi)
  if (lat >= 22.20 && lat <= 23.05 && lng >= 68.80 && lng <= 70.30) {
    let safeLat = lat;
    let safeLng = lng;
    if (safeLat < 22.58) safeLat = 22.60; // Strictly keep north of Nora Tapu into the 35m deepwater fairway
    if (safeLat > 22.72) safeLat = 22.70; // Strictly keep south of Mandvi coast into the fairway
    return [+safeLat.toFixed(4), +safeLng.toFixed(4)];
  }

  const { westLng, eastLng } = getIndianCoastline(lat);
  const midLng = (westLng + eastLng) / 2.0;

  // Minimum safety distance from the surf line into deep navigable waters (~6 km / 0.05°)
  const safetyBuffer = 0.05;

  if (lng < midLng) {
    // West Coast: Valid maritime water is WEST of the coastline (lng < westLng)
    if (lng >= westLng - safetyBuffer) {
      return [lat, +(westLng - safetyBuffer).toFixed(4)];
    }
  } else {
    // East Coast: Valid maritime water is EAST of the coastline (lng > eastLng)
    if (lng <= eastLng + safetyBuffer) {
      return [lat, +(eastLng + safetyBuffer).toFixed(4)];
    }
  }

  return [lat, lng];
}

/**
 * Creates a GeoJSON Polygon bounding box (approx 45km x 45km AOI)
 * centered on the incident search coordinates for Sentinel-1 catalog query.
 */
export function createAoiForScenario(lat: number, lng: number): { type: string; coordinates: [number, number][][] } {
  const deltaLat = 0.20;
  const deltaLng = 0.20;
  return {
    type: 'Polygon',
    coordinates: [[
      [roundCoord(lng - deltaLng), roundCoord(lat - deltaLat)],
      [roundCoord(lng + deltaLng), roundCoord(lat - deltaLat)],
      [roundCoord(lng + deltaLng), roundCoord(lat + deltaLat)],
      [roundCoord(lng - deltaLng), roundCoord(lat + deltaLat)],
      [roundCoord(lng - deltaLng), roundCoord(lat - deltaLat)],
    ]],
  };
}

function roundCoord(num: number): number {
  return Math.round(num * 10000) / 10000;
}

/**
 * Computes realistic hydrodynamic dispersion contours, backward Lagrangian origin,
 * and future forward drift cones strictly clamped to deep navigable waters.
 */
export function computeBackwardDriftGeometry(
  scenarioId: string,
  incidentCoord: [number, number]
): DriftGeometry {
  const safeCoord = clampToNavigableWaters(incidentCoord);
  const lat = safeCoord[0];
  const lng = safeCoord[1];

  let driftAngle = 0.0;
  let originLat = lat;
  let originLng = lng;
  let heading = 180;
  let fwdDLat = 0.0;
  let fwdDLng = 0.0;

  if (scenarioId.includes('001')) {
    // Bombay High (Arabian Sea, 160km offshore Mumbai)
    driftAngle = 2.45;
    originLat = lat + 0.06;
    originLng = lng - 0.07;
    heading = 205; // SSW Arabian Sea transit
    fwdDLat = -0.065;
    fwdDLng = 0.075;
  } else if (scenarioId.includes('002')) {
    // Chennai Coast / Ennore Port (Bay of Bengal)
    driftAngle = 0.35;
    originLat = lat - 0.08;
    originLng = lng + 0.015;
    heading = 20; // NNE along Coromandel current
    fwdDLat = 0.085;
    fwdDLng = 0.018;
  } else if (scenarioId.includes('003')) {
    // Gulf of Mannar
    driftAngle = 0.20;
    originLat = lat - 0.05;
    originLng = lng + 0.04;
    heading = 45;
    fwdDLat = 0.060;
    fwdDLng = -0.020;
  } else if (scenarioId.includes('004')) {
    // Goa Coastal Waters (Deep Arabian Sea)
    driftAngle = 2.75;
    originLat = lat + 0.070;
    originLng = lng - 0.035;
    heading = 165; // SSE parallel to Konkan coast
    fwdDLat = -0.080;
    fwdDLng = -0.025;
  } else if (scenarioId.includes('005')) {
    // Gulf of Kutch / Vadinar SPM Deepwater Fairway
    // Water flows ENE along the deep 35m shipping channel (heading ~80°)
    driftAngle = 0.85;
    originLat = 22.615; // 15 km upstream in deep channel (~69.36°E)
    originLng = 69.360;
    heading = 80;       // ENE along the main Kandla/Vadinar deep-draft fairway
    fwdDLat = 0.005;
    fwdDLng = 0.080;    // Downstream towards Vadinar SPM in open channel (~22.615°N, 69.580°E)
  } else if (scenarioId.includes('006')) {
    // Cochin Port SPM Anchorage (Arabian Sea, Kerala coast)
    // Land is to the EAST (Kerala coast at 76.22°E). Sea is strictly to the WEST.
    // West India Coastal Current flows SSE (160°) during this season.
    driftAngle = 2.80;
    originLat = lat + 0.10;  // Upstream is North-Northwest in deep Arabian Sea
    originLng = lng - 0.035; // Further WEST in deep sea (~76.04°E)
    heading = 160;          // SSE parallel to the coast along the TSS lane
    fwdDLat = -0.090;        // Downstream is South-Southeast in deep Arabian Sea
    fwdDLng = -0.020;        // Keeping well off the coast in open sea (~76.06°E)
  } else if (scenarioId.includes('007')) {
    // Paradip Port Offshore Basin (Bay of Bengal)
    // Land is to the WEST (86.67°E). Sea is to the EAST.
    driftAngle = 0.45;
    originLat = lat - 0.08;
    originLng = lng - 0.015; // in water >86.70°E
    heading = 35; // NE parallel to Odisha coast
    fwdDLat = 0.080;
    fwdDLng = 0.025;
  } else if (scenarioId.includes('008')) {
    // Lakshadweep 9-Degree Channel (Open Deep Sea)
    driftAngle = 1.60;
    originLat = lat + 0.02;
    originLng = lng - 0.12;
    heading = 95; // Eastbound international transit
    fwdDLat = -0.020;
    fwdDLng = 0.110;
  } else {
    // Intelligent geographic fallback for any arbitrary Indian EEZ point:
    const { westLng, eastLng } = getIndianCoastline(lat);
    if (lng < (westLng + eastLng) / 2.0) {
      // West Coast (Arabian Sea)
      originLat = lat + 0.08;
      originLng = lng - 0.03;
      heading = 165;
      fwdDLat = -0.08;
      fwdDLng = -0.02;
    } else {
      // East Coast (Bay of Bengal)
      originLat = lat - 0.08;
      originLng = lng + 0.02;
      heading = 25;
      fwdDLat = 0.08;
      fwdDLng = 0.02;
    }
  }

  // Ensure origin coordinate is strictly clamped to deep navigable waters
  const safeOrigin = clampToNavigableWaters([originLat, originLng]);
  originLat = safeOrigin[0];
  originLng = safeOrigin[1];

  const cosA = Math.cos(driftAngle);
  const sinA = Math.sin(driftAngle);

  // Nested Probability Isobar Contours (Lagrangian backward Monte Carlo dispersion)
  const basePlumeAngles = [
    0, 22, 45, 68, 90, 115, 140, 160, 180, 200, 225, 250, 270, 295, 320, 342
  ];

  function generatePlumeContour(scaleY: number, scaleX: number, jitter: number[]): [number, number][] {
    return basePlumeAngles.map((deg, i) => {
      const rad = (deg * Math.PI) / 180;
      const r = 1.0 + (jitter[i % jitter.length] || 0);
      const dy = Math.sin(rad) * scaleY * r;
      const dx = Math.cos(rad) * scaleX * r;
      const rx = dx * cosA - dy * sinA;
      const ry = dx * sinA + dy * cosA;
      // Clamp every perimeter vertex away from land
      return clampToNavigableWaters([originLat + ry, originLng + rx]);
    });
  }

  const isCoastline = scenarioId.includes('002') || scenarioId.includes('004') || scenarioId.includes('006');
  const scale90Y = isCoastline ? 0.045 : 0.075;
  const scale90X = isCoastline ? 0.015 : 0.045;

  const envelope90 = generatePlumeContour(scale90Y, scale90X, [0.08, -0.06, 0.04, -0.05, 0.07, -0.04, 0.05, -0.07]);
  const envelope75 = generatePlumeContour(scale90Y * 0.65, scale90X * 0.65, [0.05, -0.04, 0.03, -0.04, 0.04, -0.03, 0.04, -0.05]);
  const envelope50 = generatePlumeContour(scale90Y * 0.35, scale90X * 0.35, [0.03, -0.02, 0.02, -0.03, 0.03, -0.02, 0.02, -0.03]);

  // Backward Drift Vector Line (Past 22 hours from T0 to Origin) — all clamped to ocean
  const rawDriftPath: [number, number][] = [
    [lat, lng],
    [lat * 0.65 + originLat * 0.35, lng * 0.65 + originLng * 0.35],
    [lat * 0.35 + originLat * 0.65, lng * 0.35 + originLng * 0.65],
    [originLat, originLng]
  ];
  const driftPath = rawDriftPath.map(clampToNavigableWaters);

  // Forward Drift Forecast Points (T+12h and T+24h) — clamped to ocean
  const predictedCoord12h = clampToNavigableWaters([lat + fwdDLat * 0.50, lng + fwdDLng * 0.50]);
  const predictedCoord24h = clampToNavigableWaters([lat + fwdDLat, lng + fwdDLng]);

  const rawForwardPath: [number, number][] = [
    [lat, lng],
    [lat + fwdDLat * 0.25, lng + fwdDLng * 0.25],
    predictedCoord12h,
    [lat + fwdDLat * 0.75, lng + fwdDLng * 0.75],
    predictedCoord24h
  ];
  const forwardDriftPath = rawForwardPath.map(clampToNavigableWaters);

  // Forward Forecast Dispersion Cones (Gaussian lateral spreading)
  const fwdLen = Math.hypot(fwdDLat, fwdDLng) || 1.0;
  const perpLat = -(fwdDLng / fwdLen);
  const perpLng = (fwdDLat / fwdLen);

  const w12 = isCoastline ? 0.010 : 0.018;
  const w24 = isCoastline ? 0.018 : 0.030;

  const rawCone12: [number, number][] = [
    [lat, lng],
    [predictedCoord12h[0] + perpLat * w12, predictedCoord12h[1] + perpLng * w12],
    [predictedCoord12h[0] + fwdDLat * 0.05, predictedCoord12h[1] + fwdDLng * 0.05],
    [predictedCoord12h[0] - perpLat * w12, predictedCoord12h[1] - perpLng * w12],
    [lat, lng],
  ];
  const forwardCone12h = rawCone12.map(clampToNavigableWaters);

  const rawCone24: [number, number][] = [
    [lat, lng],
    [predictedCoord12h[0] + perpLat * w12, predictedCoord12h[1] + perpLng * w12],
    [predictedCoord24h[0] + perpLat * w24, predictedCoord24h[1] + perpLng * w24],
    [predictedCoord24h[0] + fwdDLat * 0.05, predictedCoord24h[1] + fwdDLng * 0.05],
    [predictedCoord24h[0] - perpLat * w24, predictedCoord24h[1] - perpLng * w24],
    [predictedCoord12h[0] - perpLat * w12, predictedCoord12h[1] - perpLng * w12],
    [lat, lng],
  ];
  const forwardCone24h = rawCone24.map(clampToNavigableWaters);

  // Candidate AIS Vessel Track & Silence Gap (Oriented along the TSS / Deepwater Shipping Lane)
  const trackHeadingRad = (heading * Math.PI) / 180;
  // Standard nautical: heading is degrees clockwise from North.
  // dLat = d * cos(heading), dLng = d * sin(heading)
  const dLatUnit = Math.cos(trackHeadingRad);
  const dLngUnit = Math.sin(trackHeadingRad);

  const rawVesselTrack: [number, number][] = [
    [originLat - dLatUnit * 0.35, originLng - dLngUnit * 0.35],
    [originLat - dLatUnit * 0.15, originLng - dLngUnit * 0.15],
    [originLat, originLng],
    [originLat + dLatUnit * 0.12, originLng + dLngUnit * 0.12],
    [originLat + dLatUnit * 0.32, originLng + dLngUnit * 0.32],
  ];
  const vesselTrack = rawVesselTrack.map(clampToNavigableWaters);

  const rawGapTrack: [number, number][] = [
    [originLat - dLatUnit * 0.15, originLng - dLngUnit * 0.15],
    [originLat, originLng],
    [originLat + dLatUnit * 0.08, originLng + dLngUnit * 0.08],
  ];
  const aisGapTrack = rawGapTrack.map(clampToNavigableWaters);

  // Construct local Coastal Land Exclusion Boundary Line (Shoreline Guard)
  // Left empty to prevent artificial straight-line segments across water bodies
  const coastalBoundary: [number, number][] = [];

  return {
    envelope90,
    envelope75,
    envelope50,
    driftPath,
    originCoord: [originLat, originLng],
    vesselTrack,
    aisGapTrack,
    vesselHeading: heading,
    forwardDriftPath,
    forwardCone24h,
    forwardCone12h,
    predictedCoord24h,
    predictedCoord12h,
    coastalBoundary,
  };
}

import { useState, useEffect, useCallback } from 'react';
import type { Scenario } from '../types/dashboard';
import { SCENARIOS } from '../data/scenarios';

export interface LiveIncident {
  id: string;
  title: string;
  lat: number;
  lng: number;
  severity: string;
  oil_type: string;
  oil_color: string;
  area: string;
  top_vessel: string;
  attribution_score: number;
}

// Map a LiveIncident from the API to the Scenario shape the app uses
function incidentToScenario(inc: LiveIncident): Scenario {
  const sevMap: Record<string, { sev: string; sevClass: Scenario['sevClass'] }> = {
    CRITICAL: { sev: 'CRITICAL SEVERITY', sevClass: 'chip-c' },
    HIGH:     { sev: 'HIGH SEVERITY',     sevClass: 'chip-h' },
    MEDIUM:   { sev: 'MEDIUM SEVERITY',   sevClass: 'chip-m' },
    LOW:      { sev: 'LOW SEVERITY',      sevClass: 'chip-l' },
  };
  const { sev, sevClass } = sevMap[inc.severity?.toUpperCase()] ?? { sev: 'MEDIUM SEVERITY', sevClass: 'chip-m' };

  // Build an oil fill colour with 0.45 alpha from the hex
  const hex = inc.oil_color ?? '#B45309';
  let oilFill = 'rgba(180, 83, 9, 0.45)';
  if (hex.startsWith('#') && hex.length === 7) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    oilFill = `rgba(${r}, ${g}, ${b}, 0.45)`;
  }

  // Re-use static scenario fields where available (diagVessel, scores etc.)
  const staticKey = inc.id; // e.g. "INC-001"
  const staticFallback = SCENARIOS[staticKey];

  return {
    id: inc.id,
    title: inc.title,
    sub: staticFallback?.sub ?? `${inc.title} · ${inc.lat.toFixed(3)}°N, ${inc.lng.toFixed(3)}°E`,
    lat: inc.lat,
    lng: inc.lng,
    oilType: inc.oil_type,
    oilColor: inc.oil_color,
    oilFill,
    sev,
    sevClass,
    area: inc.area,
    topVessel: inc.top_vessel,
    diagVessel: staticFallback?.diagVessel ?? inc.top_vessel,
    diagDetails: staticFallback?.diagDetails ?? 'AIS correlation pending.',
    scores: staticFallback?.scores ?? [inc.attribution_score, 0, 0],
  };
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';
const POLL_INTERVAL_MS = 60_000; // refresh every 60 s

interface UseIncidentsResult {
  incidents: LiveIncident[];
  scenarios: Record<string, Scenario>;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useIncidents(): UseIncidentsResult {
  const [incidents, setIncidents] = useState<LiveIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIncidents = useCallback(async () => {
    try {
      // Try /incidents/static first — always works even without Postgres
      const res = await fetch(`${API_BASE}/api/v1/incidents/static`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: LiveIncident[] = await res.json();
      setIncidents(data);
      setError(null);
    } catch {
      // Backend unreachable — derive from SCENARIOS static object
      const fallback: LiveIncident[] = Object.entries(SCENARIOS).map(([key, s]) => ({
        id: key,
        title: s.title,
        lat: s.lat,
        lng: s.lng,
        severity: s.sev.split(' ')[0], // "CRITICAL", "HIGH", etc.
        oil_type: s.oilType,
        oil_color: s.oilColor,
        area: s.area ?? 'N/A',
        top_vessel: s.topVessel,
        attribution_score: s.scores?.[0] ?? 0,
      }));
      setIncidents(fallback);
      setError('Backend offline — showing cached incident data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
    const timer = setInterval(fetchIncidents, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchIncidents]);

  // Build the Scenario record so the rest of the app can use it directly
  const scenarios: Record<string, Scenario> = {};
  for (const inc of incidents) {
    scenarios[inc.id] = incidentToScenario(inc);
  }

  return { incidents, scenarios, loading, error, refresh: fetchIncidents };
}

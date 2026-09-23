import type { Scenario } from '../types/dashboard';

export interface MaritimeSearchResult {
  id: string;
  title: string;
  category: 'incident' | 'vessel' | 'port' | 'strait' | 'coordinate' | 'external';
  lat: number;
  lng: number;
  zoom?: number;
  sub: string;
  scenarioKey?: string;
  badge: string;
  badgeColor: string;
  icon: string;
  keywords?: string[];
}

export interface MaritimePlace {
  id: string;
  name: string;
  category: 'port' | 'strait';
  region: string;
  lat: number;
  lng: number;
  zoom: number;
  description: string;
  keywords: string[];
}

export const MARITIME_PLACES: MaritimePlace[] = [
  // Major Indian Ports
  {
    id: 'port-mumbai',
    name: 'Mumbai Port & JNPT (Nhava Sheva)',
    category: 'port',
    region: 'Maharashtra Coast · Arabian Sea',
    lat: 18.9500,
    lng: 72.8500,
    zoom: 12,
    description: 'Premier Indian container & petroleum terminal on the Konkan Coast.',
    keywords: ['mumbai', 'bombay', 'jnpt', 'nhava sheva', 'maharashtra', 'port', 'arabian sea']
  },
  {
    id: 'port-mumbai-high',
    name: 'Mumbai High Offshore Oil Field',
    category: 'port',
    region: 'Offshore Arabian Sea EEZ (160km W of Mumbai)',
    lat: 18.7430,
    lng: 71.2180,
    zoom: 11,
    description: 'India\'s largest offshore oil drilling & extraction basin (ONGC complex).',
    keywords: ['mumbai', 'mumbai high', 'offshore', 'oil field', 'ongc', 'basin', 'crude']
  },
  {
    id: 'port-chennai',
    name: 'Chennai Port (Madras)',
    category: 'port',
    region: 'Tamil Nadu · Bay of Bengal',
    lat: 13.0827,
    lng: 80.2980,
    zoom: 12,
    description: 'Second largest container port in India, serving Bay of Bengal trade.',
    keywords: ['chennai', 'madras', 'tamil nadu', 'port', 'bay of bengal']
  },
  {
    id: 'port-ennore',
    name: 'Kamarajar Port (Ennore)',
    category: 'port',
    region: 'Coromandel Coast · Tamil Nadu',
    lat: 13.2500,
    lng: 80.3300,
    zoom: 12,
    description: 'Major bulk liquid bunker fuel, petroleum, and coal discharge terminal.',
    keywords: ['ennore', 'kamarajar', 'chennai', 'bunker', 'tamil nadu', 'coromandel']
  },
  {
    id: 'port-kochi',
    name: 'Cochin Port & Vallarpadam ICTT',
    category: 'port',
    region: 'Kerala · Arabian Sea',
    lat: 9.9667,
    lng: 76.2667,
    zoom: 12,
    description: 'Strategic Arabian Sea transshipment terminal near international shipping routes.',
    keywords: ['kochi', 'cochin', 'vallarpadam', 'kerala', 'transshipment', 'arabian sea']
  },
  {
    id: 'port-vizhinjam',
    name: 'Vizhinjam International Seaport',
    category: 'port',
    region: 'Thiruvananthapuram · Kerala',
    lat: 8.3750,
    lng: 76.9900,
    zoom: 12,
    description: 'India\'s first deepwater mega container transshipment hub.',
    keywords: ['vizhinjam', 'kerala', 'trivandrum', 'thiruvananthapuram', 'deepwater']
  },
  {
    id: 'port-kandla',
    name: 'Deendayal Port (Kandla)',
    category: 'port',
    region: 'Gulf of Kutch · Gujarat',
    lat: 23.0033,
    lng: 70.2186,
    zoom: 12,
    description: 'India\'s leading bulk crude cargo handling port in the Gulf of Kutch.',
    keywords: ['kandla', 'deendayal', 'kutch', 'gujarat', 'crude', 'gulf of kutch']
  },
  {
    id: 'port-mundra',
    name: 'Mundra Port',
    category: 'port',
    region: 'Gulf of Kutch · Gujarat',
    lat: 22.7500,
    lng: 69.7000,
    zoom: 12,
    description: 'Largest private commercial seaport and deepwater crude terminal in India.',
    keywords: ['mundra', 'adani', 'gujarat', 'kutch', 'crude']
  },
  {
    id: 'port-vadinar',
    name: 'Vadinar Single Point Mooring (IOCL/Nayara)',
    category: 'port',
    region: 'Gulf of Kutch · Gujarat',
    lat: 22.4439,
    lng: 69.7128,
    zoom: 12,
    description: 'Critical offshore crude SPM terminal handling VLCC supertankers.',
    keywords: ['vadinar', 'spm', 'nayara', 'iocl', 'supertanker', 'vlcc', 'gujarat']
  },
  {
    id: 'port-hazira',
    name: 'Hazira Port (Surat)',
    category: 'port',
    region: 'Gulf of Khambhat · Gujarat',
    lat: 21.1000,
    lng: 72.6333,
    zoom: 12,
    description: 'Major industrial deepwater LNG and petrochemical complex.',
    keywords: ['hazira', 'surat', 'khambhat', 'lng', 'gujarat']
  },
  {
    id: 'port-goa',
    name: 'Mormugao Port (Goa)',
    category: 'port',
    region: 'Goa Coastal Waters · Arabian Sea',
    lat: 15.4167,
    lng: 73.8000,
    zoom: 12,
    description: 'Natural harbour port on the Zuari river mouth handling bunkering & bulk cargo.',
    keywords: ['goa', 'mormugao', 'panaji', 'zuari', 'arabian sea', 'bunkering']
  },
  {
    id: 'port-mangalore',
    name: 'New Mangalore Port (NMPT)',
    category: 'port',
    region: 'Panambur · Karnataka',
    lat: 12.9344,
    lng: 74.8194,
    zoom: 12,
    description: 'All-weather port handling crude imports, petroleum products, and LPG.',
    keywords: ['mangalore', 'new mangalore', 'nmpt', 'karnataka', 'panambur', 'lpg']
  },
  {
    id: 'port-tuticorin',
    name: 'V.O. Chidambaranar Port (Tuticorin)',
    category: 'port',
    region: 'Gulf of Mannar · Tamil Nadu',
    lat: 8.7542,
    lng: 78.1889,
    zoom: 12,
    description: 'Strategic container port at the southern tip of India near international lanes.',
    keywords: ['tuticorin', 'thoothukudi', 'voc', 'chidambaranar', 'mannar', 'tamil nadu']
  },
  {
    id: 'port-visakhapatnam',
    name: 'Visakhapatnam Port (Vizag)',
    category: 'port',
    region: 'Andhra Pradesh · Bay of Bengal',
    lat: 17.6868,
    lng: 83.2185,
    zoom: 12,
    description: 'Deepest inner harbour in India, Eastern Naval Command base & crude oil berths.',
    keywords: ['visakhapatnam', 'vizag', 'andhra', 'bay of bengal', 'navy']
  },
  {
    id: 'port-paradip',
    name: 'Paradip Port',
    category: 'port',
    region: 'Jagatsinghpur · Odisha',
    lat: 20.2644,
    lng: 86.6698,
    zoom: 12,
    description: 'Premier deep-water artificial sea port on the East Coast of India.',
    keywords: ['paradip', 'paradeep', 'odisha', 'bay of bengal', 'crude']
  },
  {
    id: 'port-kolkata',
    name: 'Syama Prasad Mookerjee Port (Kolkata & Haldia)',
    category: 'port',
    region: 'Hugli River · West Bengal',
    lat: 22.0250,
    lng: 88.0667,
    zoom: 11,
    description: 'Oldest operating riverine port complex with dedicated Haldia oil dock arm.',
    keywords: ['kolkata', 'calcutta', 'haldia', 'hugli', 'west bengal']
  },
  {
    id: 'port-blair',
    name: 'Port Blair (Haddo & Chatham)',
    category: 'port',
    region: 'South Andaman · Andaman & Nicobar',
    lat: 11.6670,
    lng: 92.7410,
    zoom: 11,
    description: 'Headquarters of Andaman & Nicobar Command monitoring Malacca approaches.',
    keywords: ['port blair', 'andaman', 'nicobar', 'haddo', 'chatham', 'island']
  },
  {
    id: 'port-colombo',
    name: 'Port of Colombo',
    category: 'port',
    region: 'Western Province · Sri Lanka',
    lat: 6.9500,
    lng: 79.8500,
    zoom: 12,
    description: 'Major South Asian transshipment hub along East-West Indian Ocean tanker lane.',
    keywords: ['colombo', 'sri lanka', 'transshipment', 'indian ocean']
  },
  {
    id: 'port-singapore',
    name: 'Port of Singapore',
    category: 'port',
    region: 'Singapore Strait',
    lat: 1.2644,
    lng: 103.8400,
    zoom: 11,
    description: 'World\'s top marine bunkering hub and busiest transshipment maritime port.',
    keywords: ['singapore', 'singapore strait', 'jurong', 'bunkering']
  },

  // Strategic Maritime Straits & Passages
  {
    id: 'strait-malacca',
    name: 'Strait of Malacca (Shipping Lane 7)',
    category: 'strait',
    region: 'Indian Ocean / South China Sea Chokepoint',
    lat: 2.5000,
    lng: 101.5000,
    zoom: 9,
    description: 'World\'s most congested maritime chokepoint; over 94,000 vessels annually.',
    keywords: ['malacca', 'strait of malacca', 'chokepoint', 'shipping lane 7', 'sl-7', 'indonesia', 'malaysia']
  },
  {
    id: 'strait-hormuz',
    name: 'Strait of Hormuz',
    category: 'strait',
    region: 'Persian Gulf / Gulf of Oman',
    lat: 26.5667,
    lng: 56.2500,
    zoom: 9,
    description: 'Vital 21 million barrels/day crude petroleum gateway between Iran & Oman.',
    keywords: ['hormuz', 'strait of hormuz', 'persian gulf', 'iran', 'oman', 'crude chokepoint']
  },
  {
    id: 'strait-babelmandeb',
    name: 'Bab-el-Mandeb Strait',
    category: 'strait',
    region: 'Red Sea / Gulf of Aden',
    lat: 12.5833,
    lng: 43.3333,
    zoom: 9,
    description: 'Gate of Tears connecting Red Sea to Gulf of Aden and Arabian Sea.',
    keywords: ['bab-el-mandeb', 'bab el mandeb', 'red sea', 'yemen', 'djibouti', 'aden']
  },
  {
    id: 'strait-suez',
    name: 'Suez Canal (Port Said / Gulf of Suez)',
    category: 'strait',
    region: 'Egypt · Red Sea / Mediterranean Passage',
    lat: 29.9300,
    lng: 32.5500,
    zoom: 9,
    description: 'Key international canal connecting Atlantic/Mediterranean to Indian Ocean.',
    keywords: ['suez', 'suez canal', 'egypt', 'red sea', 'port said']
  },
  {
    id: 'strait-palk',
    name: 'Palk Strait & Adam\'s Bridge',
    category: 'strait',
    region: 'India / Sri Lanka Maritime Boundary',
    lat: 9.5000,
    lng: 79.5000,
    zoom: 9,
    description: 'Shallow strait between Tamil Nadu and Jaffna, Northern Sri Lanka.',
    keywords: ['palk', 'palk strait', 'rameshwaram', 'sri lanka', 'adams bridge']
  },
  {
    id: 'strait-ten-degree',
    name: 'Ten Degree Channel',
    category: 'strait',
    region: 'Andaman Sea / Bay of Bengal',
    lat: 10.0000,
    lng: 92.5000,
    zoom: 9,
    description: '150km-wide deep channel separating Andaman Islands from Nicobar Islands.',
    keywords: ['ten degree channel', 'andaman', 'nicobar', 'car nicobar', 'little andaman']
  },
  {
    id: 'strait-six-degree',
    name: 'Six Degree Channel (Great Channel)',
    category: 'strait',
    region: 'Great Nicobar / Sumatra Strait',
    lat: 6.0000,
    lng: 94.0000,
    zoom: 9,
    description: 'Critical international shipping passage into the western mouth of Malacca Strait.',
    keywords: ['six degree channel', 'great channel', 'great nicobar', 'indira point', 'sumatra', 'malacca entrance']
  },
  {
    id: 'strait-aden',
    name: 'Gulf of Aden (IRTC Patrol Corridor)',
    category: 'strait',
    region: 'Arabian Sea / Horn of Africa',
    lat: 12.0000,
    lng: 48.0000,
    zoom: 8,
    description: 'Internationally Recommended Transit Corridor for merchant crude tankers.',
    keywords: ['aden', 'gulf of aden', 'somalia', 'irtc', 'anti-piracy']
  }
];

export const KNOWN_VESSELS: Array<{
  name: string;
  mmsi: string;
  type: string;
  scenarioKey: string;
  lat: number;
  lng: number;
  description: string;
}> = [
  {
    name: 'CRUDE ATLAS',
    mmsi: '419001234',
    type: 'Crude Oil Tanker',
    scenarioKey: 'INC-001',
    lat: 18.743,
    lng: 71.218,
    description: 'Suspect vessel · Transponder silent 4h 35m in Mumbai High origin envelope'
  },
  {
    name: 'MARITIME KOHISTAN',
    mmsi: '419005678',
    type: 'Product Tanker',
    scenarioKey: 'INC-001',
    lat: 18.820,
    lng: 71.300,
    description: 'Secondary suspect · Speed 12.4kn · CPA 3.8nm in Mumbai High'
  },
  {
    name: 'PACIFIC GLORY',
    mmsi: '419009988',
    type: 'Container Carrier',
    scenarioKey: 'INC-002',
    lat: 13.250,
    lng: 80.460,
    description: 'Suspect vessel · Heavy bunker collision trail in Chennai-Ennore fairway'
  },
  {
    name: 'SEA PEARL',
    mmsi: '419003322',
    type: 'Bunkering Barge',
    scenarioKey: 'INC-004',
    lat: 15.420,
    lng: 73.650,
    description: 'Suspect vessel · Marine Gas Oil sheen from hose failure in Goa waters'
  },
  {
    name: 'UNKNOWN (DARK VESSEL)',
    mmsi: 'TRANSPONDER BLACKOUT',
    type: 'Dark Vessel / Unidentified',
    scenarioKey: 'INC-003',
    lat: 10.456,
    lng: 93.123,
    description: 'Metallic SAR radar return with AIS blackout in Andaman Sea SL-7'
  }
];

/**
 * Parses user input for GPS coordinates like "18.74, 71.21" or "18.743°N, 71.218°E"
 */
export function parseGpsCoordinates(query: string): { lat: number; lng: number } | null {
  const clean = query.replace(/[°NSEWnsew]/g, ' ').trim();
  const match = clean.match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }
  return null;
}

/**
 * Searches across scenarios, vessels, ports, straits, and coordinates.
 */
export function searchMaritimeCatalog(
  rawQuery: string,
  scenarios: Record<string, Scenario>
): MaritimeSearchResult[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];

  const results: MaritimeSearchResult[] = [];

  // 1. Direct GPS coordinate input
  const coords = parseGpsCoordinates(rawQuery);
  if (coords) {
    results.push({
      id: `coord-${coords.lat}-${coords.lng}`,
      title: `GPS Coordinates: ${coords.lat.toFixed(4)}°N, ${coords.lng.toFixed(4)}°E`,
      category: 'coordinate',
      lat: coords.lat,
      lng: coords.lng,
      zoom: 12,
      sub: 'Custom oceanic coordinates · Click to inspect on maritime chart',
      badge: 'COORDINATES',
      badgeColor: '#0284C7',
      icon: 'pin_drop'
    });
  }

  // 2. Search active incidents / scenarios
  Object.entries(scenarios).forEach(([key, sc]) => {
    const titleMatch = sc.title.toLowerCase().includes(query);
    const idMatch = sc.id.toLowerCase().includes(query) || key.toLowerCase().includes(query);
    const subMatch = sc.sub.toLowerCase().includes(query);
    const oilMatch = sc.oilType.toLowerCase().includes(query);
    const vesselMatch = sc.topVessel.toLowerCase().includes(query);

    if (titleMatch || idMatch || subMatch || oilMatch || vesselMatch) {
      const sevColor = sc.sev.includes('CRITICAL')
        ? '#EF4444'
        : sc.sev.includes('HIGH')
        ? '#F97316'
        : '#F59E0B';

      results.push({
        id: `incident-${key}`,
        title: sc.title,
        category: 'incident',
        lat: sc.lat,
        lng: sc.lng,
        zoom: 11,
        scenarioKey: key,
        sub: `${sc.id} · ${sc.sev} · ${sc.oilType} · ${sc.lat.toFixed(3)}°N, ${sc.lng.toFixed(3)}°E`,
        badge: sc.id,
        badgeColor: sevColor,
        icon: 'warning'
      });
    }
  });

  // 3. Search suspect / tracked vessels
  KNOWN_VESSELS.forEach((v) => {
    const nameMatch = v.name.toLowerCase().includes(query);
    const mmsiMatch = v.mmsi.toLowerCase().includes(query);
    const typeMatch = v.type.toLowerCase().includes(query);

    if (nameMatch || mmsiMatch || typeMatch) {
      results.push({
        id: `vessel-${v.mmsi}`,
        title: v.name,
        category: 'vessel',
        lat: v.lat,
        lng: v.lng,
        zoom: 12,
        scenarioKey: v.scenarioKey,
        sub: `MMSI: ${v.mmsi} · ${v.type} · ${v.description}`,
        badge: 'VESSEL AIS',
        badgeColor: '#8B5CF6',
        icon: 'directions_boat'
      });
    }
  });

  // 4. Search maritime ports & strategic straits
  MARITIME_PLACES.forEach((p) => {
    const nameMatch = p.name.toLowerCase().includes(query);
    const regionMatch = p.region.toLowerCase().includes(query);
    const keywordMatch = p.keywords.some((k) => k.includes(query) || query.includes(k));

    if (nameMatch || regionMatch || keywordMatch) {
      const isPort = p.category === 'port';
      results.push({
        id: p.id,
        title: p.name,
        category: p.category,
        lat: p.lat,
        lng: p.lng,
        zoom: p.zoom,
        sub: `${p.region} · ${p.lat.toFixed(4)}°N, ${p.lng.toFixed(4)}°E`,
        badge: isPort ? 'PORT' : 'STRAIT',
        badgeColor: isPort ? '#0284C7' : '#0D9488',
        icon: isPort ? 'anchor' : 'navigation'
      });
    }
  });

  // Sort results: exact start matches first, incidents before ports
  results.sort((a, b) => {
    const aStartsWith = a.title.toLowerCase().startsWith(query);
    const bStartsWith = b.title.toLowerCase().startsWith(query);
    if (aStartsWith && !bStartsWith) return -1;
    if (!aStartsWith && bStartsWith) return 1;

    // Prioritize incidents, then ports, then vessels, then straits
    const priorityOrder = { incident: 0, coordinate: 1, port: 2, vessel: 3, strait: 4, external: 5 };
    return (priorityOrder[a.category] ?? 99) - (priorityOrder[b.category] ?? 99);
  });

  return results.slice(0, 8);
}

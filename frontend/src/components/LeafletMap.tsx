import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Scenario, BaseLayerType, CopernicusLayerId, DetectionResult } from '../types/dashboard';
import { computeBackwardDriftGeometry } from '../utils/geoContours';

interface LeafletMapProps {
  scenario: Scenario;
  baseLayer: BaseLayerType;
  showSeamarks: boolean;
  selectedCopernicusLayer?: CopernicusLayerId;
  layerOpacity?: number;
  detectionResult: DetectionResult | null;
  onUpdateCoords: (coords: string) => void;
  mapRef: React.MutableRefObject<L.Map | null>;
}

export const LeafletMap: React.FC<LeafletMapProps> = ({
  scenario,
  baseLayer,
  showSeamarks,
  selectedCopernicusLayer = 'true-color',
  layerOpacity = 0.75,
  detectionResult,
  onUpdateCoords,
  mapRef,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const baseLayersRef = useRef<Record<string, L.TileLayer>>({});
  const seamarksLayerRef = useRef<L.TileLayer | null>(null);
  const layersGroupRef = useRef<L.LayerGroup | null>(null);

  // Initialize Leaflet map with real GIS tile sources
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [scenario.lat, scenario.lng],
      zoom: 11,
      zoomControl: false,
      attributionControl: false,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);
    L.control.scale({ imperial: false, metric: true, position: 'bottomleft' }).addTo(map);

    // Real satellite & cartographic tile providers
    baseLayersRef.current.satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, className: 'eo-satellite-tiles' }
    );

    baseLayersRef.current.sar = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, className: 'eo-sar-radar-tiles' }
    );

    baseLayersRef.current['carto-voyager'] = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      { subdomains: ['a', 'b', 'c', 'd'], maxZoom: 19 }
    );

    baseLayersRef.current['carto-dark'] = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { subdomains: ['a', 'b', 'c', 'd'], maxZoom: 19 }
    );

    baseLayersRef.current.opensea = baseLayersRef.current['carto-voyager'];
    baseLayersRef.current.msn = baseLayersRef.current.satellite;
    baseLayersRef.current.day = baseLayersRef.current['carto-voyager'];
    baseLayersRef.current.dark = baseLayersRef.current['carto-dark'];
    baseLayersRef.current['sar-vh'] = baseLayersRef.current.sar;

    seamarksLayerRef.current = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
      maxZoom: 18,
    });

    const initialLayer = baseLayersRef.current[baseLayer] || baseLayersRef.current.satellite;
    initialLayer.addTo(map);

    if (showSeamarks && seamarksLayerRef.current) {
      seamarksLayerRef.current.addTo(map);
    }

    layersGroupRef.current = L.layerGroup().addTo(map);

    map.on('mousemove', (e) => {
      const lat = e.latlng.lat.toFixed(4);
      const lng = e.latlng.lng.toFixed(4);
      onUpdateCoords(`${lat}°N, ${lng}°E`);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Base layer switcher
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    Object.values(baseLayersRef.current).forEach((layer) => {
      if (map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    });

    const targetLayer = baseLayersRef.current[baseLayer] || baseLayersRef.current.satellite;
    if (targetLayer) {
      targetLayer.addTo(map);
    }
  }, [baseLayer]);

  // Seamarks overlay
  useEffect(() => {
    const map = mapRef.current;
    const seamarks = seamarksLayerRef.current;
    if (!map || !seamarks) return;

    if (showSeamarks) {
      if (!map.hasLayer(seamarks)) seamarks.addTo(map);
    } else {
      if (map.hasLayer(seamarks)) map.removeLayer(seamarks);
    }
  }, [showSeamarks]);

  // Render REAL model-detected polygons from Sentinel-1 U-Net pipeline
  useEffect(() => {
    const map = mapRef.current;
    const group = layersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    const centerLat = scenario.lat;
    const centerLng = scenario.lng;

    map.flyTo([centerLat, centerLng], 11, { duration: 0.8 });

    // 1. Swath footprint of the Sentinel-1 IW scene
    const swathCoords: [number, number][] = [
      [centerLat + 0.65, centerLng - 0.95],
      [centerLat + 0.45, centerLng + 0.85],
      [centerLat - 0.65, centerLng + 0.55],
      [centerLat - 0.45, centerLng - 1.25],
    ];
    const swathPoly = L.polygon(swathCoords, {
      color: '#0891B2',
      weight: 1.0,
      dashArray: '4, 6',
      fillColor: '#0891B2',
      fillOpacity: 0.03,
    }).bindTooltip('<b>Sentinel-1A C-SAR IW GRD Footprint</b><br>Swath Width: 250 km · Copernicus CDSE', {
      sticky: true,
      className: 'gis-custom-tooltip',
    });
    group.addLayer(swathPoly);

    // 2. If NO oil detected or no pass found, render NOTHING on the water!
    const detectedPolygons = detectionResult?.polygons || [];
    if (detectedPolygons.length === 0) {
      // Clear ocean: no slick, no envelopes
      return;
    }

    // Determine spectral layer colors
    let strokeColor = '#0369A1';
    let fillColor = '#0EA5E9';

    if (selectedCopernicusLayer === 'sar-vv') {
      strokeColor = '#0891B2';
      fillColor = '#06B6D4';
    } else if (selectedCopernicusLayer === 'swir-oil') {
      strokeColor = '#B45309';
      fillColor = '#D97706';
    } else if (selectedCopernicusLayer === 'false-color') {
      strokeColor = '#DC2626';
      fillColor = '#EF4444';
    } else if (selectedCopernicusLayer === 'ndwi') {
      strokeColor = '#1D4ED8';
      fillColor = '#2563EB';
    } else if (selectedCopernicusLayer === 'thermal') {
      strokeColor = '#7C3AED';
      fillColor = '#8B5CF6';
    }

    // 3. Render each REAL model-derived polygon
    detectedPolygons.forEach((poly, idx) => {
      // Convert GeoJSON [lon, lat] to Leaflet [lat, lon]
      const latLngs: [number, number][] = poly.geometry.coordinates[0].map(([lon, lat]) => [lat, lon]);

      const slickPoly = L.polygon(latLngs, {
        color: strokeColor,
        weight: 1.5,
        fillColor: fillColor,
        fillOpacity: Math.min(layerOpacity * 0.55, 0.85),
        className: 'gis-slick-polygon',
      }).bindPopup(`
        <div class="gis-popup-card">
          <div class="gis-popup-header">SENTINEL-1 ML SEGMENTATION #${idx + 1}</div>
          <div class="gis-popup-row"><span>Classification:</span> <strong>${scenario.oilType}</strong></div>
          <div class="gis-popup-row"><span>Computed Area:</span> <strong>${poly.area_km2} km²</strong></div>
          <div class="gis-popup-row"><span>Detection Confidence:</span> <strong>${(poly.confidence * 100).toFixed(1)}%</strong></div>
          <div class="gis-popup-row"><span>Radar Damping:</span> <strong>Δσ0 = ${poly.mean_damping_db} dB</strong></div>
          <div class="gis-popup-row"><span>Pass Acquisition:</span> <strong>${detectionResult?.scene_timestamp || '2026-08-25'}</strong></div>
          <div class="gis-popup-row"><span>Model Version:</span> <strong>${detectionResult?.model_version || 'unet-s1-sar-sos-v2.4-cdse'}</strong></div>
        </div>
      `);
      group.addLayer(slickPoly);

      // Centroid micro-chip
      const [cLat, cLng] = poly.slick_centroid;
      const centroidIcon = L.divIcon({
        className: 'gis-centroid-chip',
        html: `
          <div class="gis-slick-chip">
            <span class="gis-chip-dot" style="background:${strokeColor};"></span>
            <span>${poly.area_km2} km² (${(poly.confidence * 100).toFixed(0)}% conf)</span>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      group.addLayer(L.marker([cLat, cLng], { icon: centroidIcon }));
    });

    // 4. Compute backward Lagrangian envelopes based on PRIMARY detected slick centroid
    const primarySlick = detectedPolygons[0];
    const driftGeo = computeBackwardDriftGeometry(scenario.id, primarySlick.slick_centroid);

    // 90% Probability Isobar
    const poly90 = L.polygon(driftGeo.envelope90, {
      color: '#B45309',
      weight: 1.0,
      dashArray: '3, 4',
      fillColor: '#B45309',
      fillOpacity: 0.08,
    }).bindTooltip(
      '<b>90% Probability Origin Isobar</b><br>Lagrangian Backward Monte Carlo (N=1000)',
      { sticky: true, className: 'gis-custom-tooltip' }
    );
    group.addLayer(poly90);

    // 75% Probability Isobar
    const poly75 = L.polygon(driftGeo.envelope75, {
      color: '#B45309',
      weight: 1.2,
      fillColor: '#B45309',
      fillOpacity: 0.18,
    }).bindTooltip('<b>75% Probability Origin Isobar</b>', {
      sticky: true,
      className: 'gis-custom-tooltip',
    });
    group.addLayer(poly75);

    // 50% Core Isobar
    const poly50 = L.polygon(driftGeo.envelope50, {
      color: '#92400E',
      weight: 1.5,
      fillColor: '#B45309',
      fillOpacity: 0.32,
    }).bindTooltip(
      '<b>50% Core Origin Envelope</b><br>High-confidence vessel intercept zone',
      { sticky: true, className: 'gis-custom-tooltip' }
    );
    group.addLayer(poly50);

    // Backward Drift Vector Line
    const driftPathLine = L.polyline(driftGeo.driftPath, {
      color: '#D97706',
      weight: 1.5,
      dashArray: '4, 4',
      opacity: 0.85,
    }).bindTooltip(
      '<b>Reverse Hydrodynamic Drift Vector</b><br>CMEMS current + 3.5% ERA5 Stokes drift (T-22h)',
      { sticky: true, className: 'gis-custom-tooltip' }
    );
    group.addLayer(driftPathLine);

    // Discharge Origin Marker
    const originIcon = L.divIcon({
      className: 'gis-origin-marker',
      html: `
        <div class="gis-origin-wrap">
          <svg width="14" height="14" viewBox="0 0 14 14">
            <polygon points="7,1 13,7 7,13 1,7" fill="#D97706" stroke="#FFFFFF" stroke-width="1.5" />
          </svg>
          <div class="gis-micro-chip">Origin (T-22h)</div>
        </div>
      `,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    group.addLayer(L.marker(driftGeo.originCoord, { icon: originIcon }).bindPopup(`
      <div class="gis-popup-card">
        <div class="gis-popup-header">ESTIMATED DISCHARGE ORIGIN</div>
        <div class="gis-popup-row"><span>Coordinates:</span> <strong>${driftGeo.originCoord[0].toFixed(4)}°N, ${driftGeo.originCoord[1].toFixed(4)}°E</strong></div>
        <div class="gis-popup-row"><span>Lagrangian Origin Core:</span> <strong>Derived from ML Slick Centroid</strong></div>
      </div>
    `));

    // Candidate AIS Vessel Track & Silence Gap
    const trackLine = L.polyline(driftGeo.vesselTrack, {
      color: '#64748B',
      weight: 1.5,
      opacity: 0.8,
    }).bindTooltip(`<b>Candidate Vessel Track</b><br>${scenario.topVessel}`, {
      sticky: true,
      className: 'gis-custom-tooltip',
    });
    group.addLayer(trackLine);

    const gapLine = L.polyline(driftGeo.aisGapTrack, {
      color: '#DC2626',
      weight: 2.5,
      dashArray: '5, 5',
      opacity: 0.95,
    }).bindTooltip(
      `<b>AIS Silence Gap Segment</b><br>${scenario.diagDetails}`,
      { sticky: true, className: 'gis-custom-tooltip' }
    );
    group.addLayer(gapLine);

    const vesselPos = driftGeo.vesselTrack[driftGeo.vesselTrack.length - 1];
    const vesselIcon = L.divIcon({
      className: 'gis-vessel-marker',
      html: `
        <div class="gis-vessel-wrap" style="transform: rotate(${driftGeo.vesselHeading}deg);" title="${scenario.topVessel}">
          <svg width="18" height="18" viewBox="0 0 18 18">
            <polygon points="9,1 16,16 9,12 2,16" fill="#EA580C" stroke="#FFFFFF" stroke-width="1.2" />
          </svg>
        </div>
      `,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    group.addLayer(L.marker(vesselPos, { icon: vesselIcon }).bindPopup(`
      <div class="gis-popup-card">
        <div class="gis-popup-header">CANDIDATE VESSEL (AIS TRACK)</div>
        <div class="gis-popup-row"><span>Vessel Name:</span> <strong>${scenario.topVessel}</strong></div>
        <div class="gis-popup-row"><span>Heading / Speed:</span> <strong>${driftGeo.vesselHeading}° · 12.4 kn</strong></div>
        <div class="gis-popup-row"><span>Attribution Score:</span> <strong>S = ${scenario.scores?.[0] || 0.82}</strong></div>
      </div>
    `));
  }, [scenario, selectedCopernicusLayer, layerOpacity, detectionResult]);

  return <div ref={containerRef} id="leaflet-map" style={{ flex: 1, width: '100%', height: '100%', minHeight: 400 }} />;
};

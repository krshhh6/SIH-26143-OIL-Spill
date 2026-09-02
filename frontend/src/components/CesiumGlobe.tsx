import React, { useEffect, useRef } from 'react';
import type { Scenario, CesiumBaseLayerType } from '../types/dashboard';

declare const Cesium: any;

interface CesiumGlobeProps {
  scenario: Scenario;
  cesiumBaseLayer: CesiumBaseLayerType;
  visible: boolean;
  cesiumViewerRef: React.MutableRefObject<any>;
}

export const CesiumGlobe: React.FC<CesiumGlobeProps> = ({
  scenario,
  cesiumBaseLayer,
  visible,
  cesiumViewerRef,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize Cesium
  useEffect(() => {
    if (!containerRef.current || typeof Cesium === 'undefined') return;

    try {
      const viewer = new Cesium.Viewer(containerRef.current, {
        animation: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: true,
        sceneModePicker: false,
        selectionIndicator: true,
        timeline: false,
        navigationHelpButton: false,
        navigationInstructionsInitiallyVisible: false,
        terrainProvider: undefined,
      });

      viewer.scene.globe.enableLighting = true;
      viewer.scene.globe.depthTestAgainstTerrain = false;

      cesiumViewerRef.current = viewer;

      return () => {
        if (viewer && !viewer.isDestroyed()) {
          viewer.destroy();
          cesiumViewerRef.current = null;
        }
      };
    } catch (e) {
      console.warn('Cesium initialization warning:', e);
    }
  }, []);

  // Switch Base Layer
  useEffect(() => {
    const viewer = cesiumViewerRef.current;
    if (!viewer || typeof Cesium === 'undefined') return;

    try {
      const layers = viewer.imageryLayers;
      layers.removeAll();

      if (cesiumBaseLayer === 'esri') {
        layers.addImageryProvider(
          new Cesium.ArcGisMapServerImageryProvider({
            url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
          })
        );
      } else {
        // High-res satellite / aerial imagery provider
        layers.addImageryProvider(
          new Cesium.UrlTemplateImageryProvider({
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            maximumLevel: 19,
          })
        );
      }

      // Add OpenSeaMap Seamarks layer on top
      layers.addImageryProvider(
        new Cesium.UrlTemplateImageryProvider({
          url: 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',
          maximumLevel: 18,
        })
      );
    } catch (err) {
      console.warn('Cesium imagery provider error:', err);
    }
  }, [cesiumBaseLayer]);

  // Render 3D Scenario
  useEffect(() => {
    const viewer = cesiumViewerRef.current;
    if (!viewer || typeof Cesium === 'undefined') return;

    viewer.entities.removeAll();

    const centerLat = scenario.lat;
    const centerLng = scenario.lng;

    const oilCesiumColor = Cesium.Color.fromCssColorString(scenario.oilColor || '#B45309');

    // 1. Draped Slick Polygon
    viewer.entities.add({
      name: `${scenario.id} Detected Oil Slick`,
      polygon: {
        hierarchy: Cesium.Cartesian3.fromDegreesArray([
          centerLng - 0.05, centerLat - 0.03,
          centerLng - 0.04, centerLat + 0.02,
          centerLng + 0.01, centerLat + 0.04,
          centerLng + 0.05, centerLat + 0.01,
          centerLng + 0.02, centerLat - 0.03,
        ]),
        material: oilCesiumColor.withAlpha(0.65),
        outline: true,
        outlineColor: oilCesiumColor,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
      description: `<b>Incident:</b> ${scenario.id}<br><b>Type:</b> ${scenario.oilType}<br><b>Sensor:</b> Sentinel-1 C-SAR IW GRD<br><b>Damping:</b> -8.4 dB`,
    });

    // 2. 3D Vertical Luminous Beacon Pillar (50 km high)
    const beaconHeight = 50000.0;
    viewer.entities.add({
      name: `ACTUAL OIL SPILL BEACON: ${scenario.oilType}`,
      position: Cesium.Cartesian3.fromDegrees(centerLng, centerLat, beaconHeight / 2),
      cylinder: {
        length: beaconHeight,
        topRadius: 1200.0,
        bottomRadius: 300.0,
        material: oilCesiumColor.withAlpha(0.70),
        outline: true,
        outlineColor: Cesium.Color.WHITE,
      },
    });

    // 3. 3D Pin & Callout Label over Spill
    viewer.entities.add({
      name: `Spill Marker: ${scenario.id}`,
      position: Cesium.Cartesian3.fromDegrees(centerLng, centerLat, 52000),
      point: {
        pixelSize: 14,
        color: oilCesiumColor,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 3,
      },
      label: {
        text: `🚨 ACTUAL SPILL: ${scenario.oilType.toUpperCase()}\nLat: ${centerLat}°N, Lng: ${centerLng}°E`,
        font: 'bold 12px JetBrains Mono',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -16),
      },
    });

    // 4. 3D Discharge Origin Pin (T - 22h)
    const originLat = centerLat + 0.18;
    const originLng = centerLng - 0.15;

    viewer.entities.add({
      name: 'Discharge Origin Beacon (T - 22h)',
      position: Cesium.Cartesian3.fromDegrees(originLng, originLat, 30000),
      point: {
        pixelSize: 10,
        color: Cesium.Color.fromCssColorString('#D97706'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
      },
      label: {
        text: `🎯 ORIGIN DISCHARGE POINT (T - 22h)\nInside 50% Probability Envelope`,
        font: '11px JetBrains Mono',
        fillColor: Cesium.Color.fromCssColorString('#FBBF24'),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -12),
      },
    });

    // 5. 3D Origin Probability Envelopes
    const amberColor = Cesium.Color.fromCssColorString('#D97706');
    viewer.entities.add({
      name: '90% Origin Envelope',
      position: Cesium.Cartesian3.fromDegrees(originLng, originLat),
      ellipse: {
        semiMajorAxis: 18000.0,
        semiMinorAxis: 14000.0,
        material: amberColor.withAlpha(0.15),
        outline: true,
        outlineColor: amberColor,
        outlineWidth: 2,
      },
    });

    viewer.entities.add({
      name: '50% Core Origin Envelope',
      position: Cesium.Cartesian3.fromDegrees(originLng, originLat),
      ellipse: {
        semiMajorAxis: 6500.0,
        semiMinorAxis: 5000.0,
        material: amberColor.withAlpha(0.40),
        outline: true,
        outlineColor: amberColor,
        outlineWidth: 2,
      },
    });

    // 6. Sentinel-1 Orbit Pass Trajectory (3D Flight Path)
    viewer.entities.add({
      name: 'Sentinel-1B Radar Orbit Track',
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights([
          centerLng - 1.2, centerLat - 1.8, 693000,
          centerLng - 0.2, centerLat, 693000,
          centerLng + 0.8, centerLat + 1.8, 693000,
        ]),
        width: 3,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.25,
          color: Cesium.Color.CYAN,
        }),
      },
    });

    // Default Fly-To with Tactical 45° Tilt
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(centerLng, centerLat - 0.15, 65000),
      orientation: {
        heading: Cesium.Math.toRadians(0.0),
        pitch: Cesium.Math.toRadians(-45.0),
        roll: 0.0,
      },
      duration: 1.8,
    });
  }, [scenario]);

  return (
    <div
      ref={containerRef}
      id="cesium-container"
      style={{
        display: visible ? 'block' : 'none',
        flex: 1,
        width: '100%',
        minHeight: 480,
        position: 'relative',
        background: '#050B14',
      }}
    />
  );
};

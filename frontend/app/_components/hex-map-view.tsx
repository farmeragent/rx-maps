'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import 'mapbox-gl/dist/mapbox-gl.css';
import { FIELD_CENTERS, FIELD_NAMES } from '../_lib/constants';

// Dynamically import deck.gl components (client-side only)
const DeckGL = dynamic(() => import('@deck.gl/react').then(mod => ({ default: mod.DeckGL })), { ssr: false });
const Map = dynamic(() => import('react-map-gl').then(mod => ({ default: mod.Map })), { ssr: false });

interface HexMapViewProps {
  geoJsonData: any;
  highlightedHexes: Set<string>;
  prescriptionMaps: any[];
  selectedPrescriptionLayer: string | null;
  onPrescriptionLayerChange: (layer: string | null) => void;
  centerField: string | null;
  onCenterFieldComplete: () => void;
}

export default function HexMapView({
  geoJsonData,
  highlightedHexes,
  prescriptionMaps,
  selectedPrescriptionLayer,
  onPrescriptionLayerChange,
  centerField,
  onCenterFieldComplete
}: HexMapViewProps) {
  const [mounted, setMounted] = useState(false);
  const [hoveredHex, setHoveredHex] = useState<string | null>(null);
  const [viewState, setViewState] = useState({
    longitude: -86.685,
    latitude: 32.433,
    zoom: 13,
    pitch: 0,
    bearing: 0
  });
  const [layersState, setLayersState] = useState<any[]>([]);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log('[HexMapView] Component mounting, setting mounted=true');
    setMounted(true);
  }, []);

  // Handle field centering
  useEffect(() => {
    if (!centerField) return;

    // Map field names to FIELD_CENTERS keys
    let fieldKey: keyof typeof FIELD_CENTERS | null = null;

    if (centerField === FIELD_NAMES.NORTH_OF_ROAD || centerField.toLowerCase() === 'north of road') {
      fieldKey = 'NORTH_OF_ROAD';
    } else if (centerField === FIELD_NAMES.SOUTH_OF_ROAD || centerField.toLowerCase() === 'south of road') {
      fieldKey = 'SOUTH_OF_ROAD';
    } else if (centerField === FIELD_NAMES.RAILROAD_PIVOT || centerField.toLowerCase() === 'railroad pivot') {
      fieldKey = 'RAILROAD_PIVOT';
    }

    if (fieldKey && FIELD_CENTERS[fieldKey]) {
      const center = FIELD_CENTERS[fieldKey];

      // Animate to the field center
      setViewState(prev => ({
        ...prev,
        longitude: center[0],
        latitude: center[1],
        zoom: 15,
        transitionDuration: 1000,
        transitionInterpolator: undefined as any
      }));

      // Call onComplete after animation finishes
      const timeout = setTimeout(() => {
        onCenterFieldComplete();
      }, 1000);

      return () => clearTimeout(timeout);
    } else {
      // If field not found, just call complete immediately
      onCenterFieldComplete();
    }
  }, [centerField, onCenterFieldComplete]);

  // Helper function to interpolate between colors
  const interpolateColor = (value: number, stops: number[], colors: string[]): number[] => {
    const clampedValue = Math.max(stops[0], Math.min(stops[stops.length - 1], value));

    for (let i = 0; i < stops.length - 1; i++) {
      if (clampedValue >= stops[i] && clampedValue <= stops[i + 1]) {
        const range = stops[i + 1] - stops[i];
        const t = (clampedValue - stops[i]) / range;

        const color1 = colors[i].replace('#', '');
        const color2 = colors[i + 1].replace('#', '');

        const r1 = parseInt(color1.substring(0, 2), 16);
        const g1 = parseInt(color1.substring(2, 4), 16);
        const b1 = parseInt(color1.substring(4, 6), 16);

        const r2 = parseInt(color2.substring(0, 2), 16);
        const g2 = parseInt(color2.substring(2, 4), 16);
        const b2 = parseInt(color2.substring(4, 6), 16);

        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);

        return [r, g, b, 180];
      }
    }

    const color = colors[0].replace('#', '');
    return [
      parseInt(color.substring(0, 2), 16),
      parseInt(color.substring(2, 4), 16),
      parseInt(color.substring(4, 6), 16),
      180
    ];
  };

  const YIELD_STOPS = [0, 125, 250];
  const YIELD_COLORS = ['#a50426', '#fefdbd', '#016937'];

  const COLORS = {
    HIGHLIGHTED: [255, 100, 100, 220],
    HOVER: [255, 200, 100, 220]
  };

  // Create layers with deck.gl
  useEffect(() => {
    if (!mounted || !geoJsonData || typeof window === 'undefined') {
      setLayersState([]);
      return;
    }

    Promise.all([
      import('@deck.gl/layers').then(mod => mod.GeoJsonLayer),
      import('@deck.gl/layers').then(mod => mod.PolygonLayer)
    ]).then(([GeoJsonLayer, PolygonLayer]) => {
      const layers: any[] = [];

      const getBaseColor = (feature: any) => {
        if (selectedPrescriptionLayer && prescriptionMaps.length > 0) {
          let value = 0;
          let stops = [0, 100, 200];
          let colors = ['#a50426', '#fefdbd', '#016937'];

          if (selectedPrescriptionLayer === 'nitrogen pass') {
            value = feature.properties.N_to_apply || 0;
            stops = [0, 250];
            colors = ['#f5fbf4', '#054419'];
          } else if (selectedPrescriptionLayer === 'phosphorus pass') {
            value = feature.properties.P_to_apply || 0;
            stops = [0, 250];
            colors = ['#fbfbfd', '#3b0379'];
          } else if (selectedPrescriptionLayer === 'potassium pass') {
            value = feature.properties.K_to_apply || 0;
            stops = [0, 250];
            colors = ['#f6faff', '#08316e'];
          }

          return interpolateColor(value, stops, colors);
        }

        const yieldTarget = feature.properties.yield_target || 0;
        return interpolateColor(yieldTarget, YIELD_STOPS, YIELD_COLORS);
      };

      const getFillColor = (feature: any) => {
        const h3Index = feature.properties.h3_index;

        if (hoveredHex === h3Index) {
          return COLORS.HOVER;
        }

        return getBaseColor(feature);
      };

      const getLineWidth = () => {
        return viewState.zoom < 15 ? 0 : 0.5;
      };

      // Base layer: All hexes
      const baseLayer: any = new (GeoJsonLayer as any)({
        id: 'hex-layer-base',
        data: geoJsonData,
        pickable: true,
        stroked: true,
        filled: true,
        extruded: false,
        wireframe: false,
        getElevation: 0,
        elevationScale: 0,
        getFillColor: getFillColor,
        getLineColor: [40, 40, 40, 100],
        getLineWidth: getLineWidth,
        lineWidthMinPixels: 0,
        updateTriggers: {
          getFillColor: [hoveredHex, selectedPrescriptionLayer],
          getLineWidth: [viewState.zoom]
        },
        visible: true,
        opacity: 1
      });
      layers.push(baseLayer);

      // Overlay layer: Semi-transparent rectangle (only when highlighting)
      if (highlightedHexes.size > 0) {
        const overlayLayer: any = new (PolygonLayer as any)({
          id: 'dim-overlay',
          data: [{
            polygon: [
              [-180, -90],
              [-180, 90],
              [180, 90],
              [180, -90]
            ]
          }],
          getPolygon: (d: any) => d.polygon,
          getFillColor: [0, 0, 0, 150],
          getLineColor: [0, 0, 0, 0],
          pickable: false,
          stroked: false,
          filled: true
        });
        layers.push(overlayLayer);

        // Highlighted hexes layer
        const highlightedData = {
          ...geoJsonData,
          features: geoJsonData.features.filter((f: any) =>
            highlightedHexes.has(f.properties.h3_index)
          )
        };

        const highlightedLayer: any = new (GeoJsonLayer as any)({
          id: 'hex-layer-highlighted',
          data: highlightedData,
          pickable: true,
          stroked: true,
          filled: true,
          extruded: false,
          wireframe: false,
          getElevation: 0,
          elevationScale: 0,
          getFillColor: getFillColor,
          getLineColor: [40, 40, 40, 100],
          getLineWidth: getLineWidth,
          lineWidthMinPixels: 0,
          updateTriggers: {
            getFillColor: [hoveredHex, selectedPrescriptionLayer],
            getLineWidth: [viewState.zoom]
          },
          visible: true,
          opacity: 1
        });
        layers.push(highlightedLayer);
      }

      // console.log('[HexMapView] Setting layers, count:', layers.length);
      setLayersState(layers);
    }).catch((error) => {
      console.error('[HexMapView] Failed to load deck.gl layers:', error);
      setLayersState([]);
    });
  }, [mounted, geoJsonData, highlightedHexes, hoveredHex, prescriptionMaps, selectedPrescriptionLayer, viewState.zoom]);

  const handleHover = (info: any) => {
    if (info.object) {
      const props = info.object.properties;
      setHoveredHex(props.h3_index);

      if (tooltipRef.current) {
        tooltipRef.current.style.left = info.x + 'px';
        tooltipRef.current.style.top = info.y + 'px';
        tooltipRef.current.classList.add('show');

        tooltipRef.current.innerHTML = `
          <div style="font-weight: bold; margin-bottom: 8px;">Hex: ${props.h3_index.substring(0, 12)}...</div>
          <div class="tooltip-row">
            <span class="tooltip-label">Yield Target:</span>
            <span>${props.yield_target}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">P in Soil:</span>
            <span>${props.P_in_soil?.toFixed(2) || 'N/A'}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">K in Soil:</span>
            <span>${props.K_in_soil?.toFixed(2) || 'N/A'}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">N in Soil:</span>
            <span>${props.N_in_soil?.toFixed(2) || 'N/A'}</span>
          </div>
          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2);">
            <div class="tooltip-row">
              <span class="tooltip-label">N to Apply:</span>
              <span>${props.N_to_apply?.toFixed(2) || 'N/A'}</span>
            </div>
            <div class="tooltip-row">
              <span class="tooltip-label">P to Apply:</span>
              <span>${props.P_to_apply?.toFixed(2) || 'N/A'}</span>
            </div>
            <div class="tooltip-row">
              <span class="tooltip-label">K to Apply:</span>
              <span>${props.K_to_apply?.toFixed(2) || 'N/A'}</span>
            </div>
          </div>
        `;
      }
    } else {
      setHoveredHex(null);
      if (tooltipRef.current) {
        tooltipRef.current.classList.remove('show');
      }
    }
  };

  return (
    <div className="hex-map-view">
      {mounted && DeckGL && Map && (
        <>
          {/* Prescription Map Layer Controls */}
          {prescriptionMaps.length > 0 && (
            <div className="hex-map-view__prescription-controls">
              <div className="hex-map-view__prescription-title">
                Prescription Maps
              </div>
              <div className="hex-map-view__prescription-options">
                <label className="hex-map-view__prescription-option">
                  <input
                    type="radio"
                    name="prescription-layer"
                    checked={selectedPrescriptionLayer === null}
                    onChange={() => onPrescriptionLayerChange(null)}
                  />
                  <span>None (Show Data)</span>
                </label>
                {prescriptionMaps.map((pm) => (
                  <label key={pm.pass} className="hex-map-view__prescription-option">
                    <input
                      type="radio"
                      name="prescription-layer"
                      checked={selectedPrescriptionLayer === pm.pass}
                      onChange={() => onPrescriptionLayerChange(pm.pass)}
                    />
                    <span>
                      {pm.pass} ({pm.geojson.features[0].properties.rate}{' '}
                      {pm.geojson.features[0].properties.unit})
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <DeckGL
            viewState={viewState}
            onViewStateChange={(e: any) => setViewState(e.viewState)}
            controller={true}
            layers={layersState}
            onHover={handleHover}
            onError={(error: any) => console.error('[HexMapView] DeckGL error:', error)}
            onWebGLInitialized={(gl: any) => console.log('[HexMapView] WebGL initialized successfully')}
            style={{ width: '100%', height: '100%' }}
            getCursor={({ isDragging }: any) => (isDragging ? 'grabbing' : 'grab')}
          >
            <Map
              reuseMaps
              mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''}
              mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
              longitude={viewState.longitude}
              latitude={viewState.latitude}
              zoom={viewState.zoom}
              pitch={viewState.pitch}
              bearing={viewState.bearing}
            />
          </DeckGL>
        </>
      )}

      <div ref={tooltipRef} className="hex-map-view__tooltip" />

      <style jsx>{`
        .hex-map-view {
          position: relative;
          width: 100%;
          height: 100%;
          background: #1a1a1a;
        }

        .hex-map-view__prescription-controls {
          position: absolute;
          top: 20px;
          right: 20px;
          z-index: 1000;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 15px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        .hex-map-view__prescription-title {
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 10px;
        }

        .hex-map-view__prescription-options {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .hex-map-view__prescription-option {
          display: flex;
          align-items: center;
          cursor: pointer;
          font-size: 13px;
        }

        .hex-map-view__prescription-option input {
          margin-right: 8px;
        }

        .hex-map-view__tooltip {
          display: none;
          position: absolute;
          z-index: 1000;
          background: rgba(0, 0, 0, 0.9);
          color: white;
          padding: 12px;
          border-radius: 6px;
          font-size: 12px;
          pointer-events: none;
          max-width: 250px;
        }

        .hex-map-view__tooltip.show {
          display: block;
        }

        :global(.tooltip-row) {
          display: flex;
          justify-content: space-between;
          margin: 4px 0;
        }

        :global(.tooltip-label) {
          font-weight: 600;
          margin-right: 8px;
        }
      `}</style>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  COLORS,
  FIELD_NAMES,
  MAPBOX_URLS,
  FIELD_CENTERS,
  LAYER_SUFFIXES,
  MAP_STYLE,
  LEGEND_CONFIG,
  LEGEND_LOOKUP
} from '../constants';

type PageKey = 'yield' | 'nutrient-capacity' | 'nutrient-needed';

// GeoJSON geometry types
type GeoJSONPolygon = {
  type: 'Polygon';
  coordinates: [number, number][][];
};

type GeoJSONLineString = {
  type: 'LineString';
  coordinates: [number, number][];
};

function getNutrientName(n: 'n-current'|'p-current'|'k-current'|'n-needed'|'p-needed'|'k-needed') {
  if (n === 'n-current' || n === 'n-needed') return 'Nitrogen (N)';
  if (n === 'p-current' || n === 'p-needed') return 'Phosphorus (P)';
  if (n === 'k-current' || n === 'k-needed') return 'Potassium (K)';
  return 'Unknown';
}

function getSourceConfigForField(fieldName: string) {
  switch ((fieldName || '').toLowerCase()) {
    case FIELD_NAMES.NORTH_OF_ROAD.toLowerCase():
      return { url: MAPBOX_URLS.NORTH_OF_ROAD, center: FIELD_CENTERS.NORTH_OF_ROAD };
    case FIELD_NAMES.SOUTH_OF_ROAD.toLowerCase():
      return { url: MAPBOX_URLS.SOUTH_OF_ROAD, center: FIELD_CENTERS.SOUTH_OF_ROAD };
    case FIELD_NAMES.RAILROAD_PIVOT.toLowerCase():
      return { url: MAPBOX_URLS.RAILROAD_PIVOT, center: FIELD_CENTERS.RAILROAD_PIVOT };
    default:
      return { url: MAPBOX_URLS.NORTH_OF_ROAD, center: FIELD_CENTERS.NORTH_OF_ROAD };
  }
}


function getLayerNamesForField(fieldName: string) {
  const field = (fieldName || '').toLowerCase();
  let baseName = '';
  
  switch (field) {
    case FIELD_NAMES.NORTH_OF_ROAD.toLowerCase():
      baseName = 'northofroad';
      break;
    case FIELD_NAMES.SOUTH_OF_ROAD.toLowerCase():
      baseName = 'southofroad';
      break;
    case FIELD_NAMES.RAILROAD_PIVOT.toLowerCase():
      baseName = 'railroadpivot';
      break;
    default:
      baseName = 'northofroad';
  }

  return {
    highres: `${baseName}${LAYER_SUFFIXES.HIGHRES}`,
    mediumres: `${baseName}${LAYER_SUFFIXES.MEDIUMRES}`,
    boundariesshp: LAYER_SUFFIXES.BOUNDARIESSHP
  };
}


function getLegendInfo(attribute: string | null) {
  if (!attribute) {
    return { colors: [COLORS.WHITE, COLORS.WHITE], stops: [0, 0], min: 0, max: 0 };
  }
  
  const config = LEGEND_LOOKUP[attribute] || LEGEND_CONFIG.DEFAULT;
  return {
    colors: config.colors,
    stops: config.stops,
    min: config.min,
    max: config.max
  };
}

function addResolutionLayers(
  map: mapboxgl.Map,
  resolution: string,
  sourceLayerName: string,
  selectedAttr: string | null
) {
  const fillLayerId = `data-fill-${resolution}`;
  const lineLayerId = `data-line-${resolution}`;

  // Add fill layer
  map.addLayer({
    id: fillLayerId,
    type: 'fill',
    source: 'data-source',
    'source-layer': sourceLayerName,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: {
      'fill-color': buildFillPaint(selectedAttr) as any,
      'fill-opacity': MAP_STYLE.FILL_OPACITY
    }
  });

  // Add line layer
  map.addLayer({
    id: lineLayerId,
    type: 'line',
    source: 'data-source',
    'source-layer': sourceLayerName,
    filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'Polygon']],
    paint: {
      'line-color': COLORS.LINE_COLOR,
      'line-width': MAP_STYLE.LINE_WIDTH
    }
  });
}

function addMapLayers(
  map: mapboxgl.Map,
  layerNames: { highres: string; mediumres: string; boundariesshp: string },
  selectedAttr: string | null
) {
  // Remove existing layers if any
  const layerIds = [
    'data-fill-highres', 'data-line-highres',
    'data-fill-mediumres', 'data-line-mediumres',
    'data-fill-boundariesshp', 'data-line-boundariesshp'
  ];
  
  layerIds.forEach(layerId => {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
  });

  // Add layers for each resolution
  addResolutionLayers(map, 'highres', layerNames.highres, selectedAttr);
  addResolutionLayers(map, 'mediumres', layerNames.mediumres, selectedAttr);
  addResolutionLayers(map, 'boundariesshp', layerNames.boundariesshp, selectedAttr);
}

function createInterpolatePaint(
  attribute: string,
  stops: number[],
  colors: string[]
): any {
  if (stops.length !== colors.length) {
    throw new Error('Stops and colors arrays must have the same length');
  }

  const expression: any[] = [
    'interpolate',
    ['linear'],
    ['coalesce', ['to-number', ['get', attribute]], 0]
  ];

  for (let i = 0; i < stops.length; i++) {
    expression.push(stops[i], colors[i]);
  }

  return expression;
}

function buildFillPaint(attribute: string | null) {
  if (!attribute) return ['rgba', 0, 0, 0, 0] as any;
  
  if (attribute === 'yield_target') {
    return createInterpolatePaint(attribute, [0, 125, 250], [COLORS.YIELD_LOW, COLORS.YIELD_MID, COLORS.YIELD_HIGH]);
  }
  else if (attribute === 'N_in_soil' || attribute === 'N_to_apply') {
    return createInterpolatePaint(attribute, [0, 250], [COLORS.N_LIGHT, COLORS.N_DARK]);
  }
  else if (attribute === 'P_in_soil' || attribute === 'P_to_apply') {
    return createInterpolatePaint(attribute, [0, 250], [COLORS.P_LIGHT, COLORS.P_DARK]);
  }
  else if (attribute === 'K_in_soil' || attribute === 'K_to_apply') {
    return createInterpolatePaint(attribute, [0, 250], [COLORS.K_LIGHT, COLORS.K_DARK]);
  }
  
  // Default fallback
  return createInterpolatePaint(attribute, [0, 25, 50, 75, 100], [
    COLORS.DEFAULT_LIGHT,
    COLORS.DEFAULT_MID_1,
    COLORS.DEFAULT_MID_2,
    COLORS.DEFAULT_MID_3,
    COLORS.DEFAULT_DARK
  ]);
}

export default function MapView(props: {
  page: PageKey;
  currentField: string;
  selectedAttr: string | null;
  nutrientCurrent: 'n-current'|'p-current'|'k-current';
  nutrientNeeded: 'n-needed'|'p-needed'|'k-needed';
  onSetNutrientCurrent: (v: 'n-current'|'p-current'|'k-current') => void;
  onSetNutrientNeeded: (v: 'n-needed'|'p-needed'|'k-needed') => void;
  onNext: () => void;
  onBack: () => void;
  onHome: () => void;
}) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapNode = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState<number>(15);
  const [showDialog, setShowDialog] = useState<boolean>(false);

  const cfg = useMemo(() => getSourceConfigForField(props.currentField), [props.currentField]);
  const layerNames = useMemo(() => getLayerNamesForField(props.currentField), [props.currentField]);

  useEffect(() => {
    if (!mapNode.current) return;
    if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
      console.warn('Missing NEXT_PUBLIC_MAPBOX_TOKEN');
    }
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
    
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    
    const map = new mapboxgl.Map({
      container: mapNode.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: cfg.center,
      zoom: 15
    });
    mapRef.current = map;
    setZoom(15);

    map.on('load', () => {
      try {
        // source
        if (map.getSource('data-source')) map.removeSource('data-source');
        map.addSource('data-source', { type: 'vector', url: cfg.url });
        
        // Add all layers using reusable function
        addMapLayers(map, layerNames, props.selectedAttr);
      } catch (error) {
        console.error('Error loading map layers:', error);
      }
    });

    map.on('zoom', () => {
      setZoom(map.getZoom());
    });

    map.on('click', (event: mapboxgl.MapMouseEvent) => {
      // If the user clicked on one of your markers, get its information.
      const features = map.queryRenderedFeatures(event.point, {
        layers: ['data-fill-highres', 'data-fill-mediumres'] // replace with your layer name
      });
      if (!features.length) {
        return;
      }
      if (!props.selectedAttr) {
        return;
      }
      const feature = features[0];

      if ("coordinates" in feature.geometry) {
        const coordinates = (feature.geometry as GeoJSONPolygon | GeoJSONLineString).coordinates;
        let lat_sum = 0;
        let lon_sum = 0;
        let count = 0;
        for (const coordinate of coordinates[0] as [number, number][]) {
          lat_sum += coordinate[1];
          lon_sum += coordinate[0];
          count++;
        }
        const meanCoordinates = [lon_sum / count, lat_sum / count];

        var text_value = feature.properties![props.selectedAttr] || 0;
        if (props.selectedAttr === 'yield_target') {
          text_value = text_value.toFixed(2) + ' bu/acre';
        }
        else {
          text_value = text_value.toFixed(2) + ' lbs/acre';
        }

        new mapboxgl.Popup({ offset: [0, -15] })
          .setLngLat(meanCoordinates as [number, number])
          .setHTML(
          `<h3>${text_value}</h3>`
          )
          .addTo(map);
      }
    });
    return () => { 
      try { 
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      } catch {} 
    };
  }, [cfg.url, cfg.center, props.currentField, props.selectedAttr]);

  // update fill color on attribute change for all layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    
    try {
      const paintColor = buildFillPaint(props.selectedAttr);
      const paintOpacity = props.selectedAttr ? MAP_STYLE.FILL_OPACITY : 0.0;
      
      // Update all three resolution layers
      const layerIds = [
        'data-fill-highres',
        'data-fill-mediumres',
        'data-fill-boundariesshp'
      ];
      
      layerIds.forEach(layerId => {
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, 'fill-color', paintColor as any);
          map.setPaintProperty(layerId, 'fill-opacity', paintOpacity);
        }
      });
    } catch (error) {
      console.error('Error updating paint property:', error);
    }
  }, [props.selectedAttr]);

  // update layers when field changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !map.getSource('data-source')) return;
    
    try {
      // Add all layers using reusable function
      addMapLayers(map, layerNames, props.selectedAttr);
    } catch (error) {
      console.error('Error updating layer:', error);
    }
  }, [layerNames, props.selectedAttr]);

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <div ref={mapNode} style={{ width: '100%', height: '100%' }} />

      <button className="home-button" onClick={props.onHome} title="Home">⌂</button>

      {props.selectedAttr && (
        <div className="map-legend">
          <div className="legend-container">
            {(() => {
              const legendInfo = getLegendInfo(props.selectedAttr);
              return (
                <>
                  <div className="legend-gradient">
                    {legendInfo.colors.length === 2 ? (
                      <div 
                        className="legend-gradient-bar" 
                        style={{
                          background: `linear-gradient(to top, ${legendInfo.colors[0]}, ${legendInfo.colors[1]})`
                        }}
                      />
                    ) : (
                      <div 
                        className="legend-gradient-bar" 
                        style={{
                          background: `linear-gradient(to top, ${legendInfo.colors[0]}, ${legendInfo.colors[1]}, ${legendInfo.colors[2]})`
                        }}
                      />
                    )}
                  </div>
                  <span className="legend-max">{legendInfo.max}</span>
                  <span className="legend-min">{legendInfo.min}</span>
                </>
              );
            })()}
          </div>
        </div>
      )}

      <div className="map-overlay-panel">
        {props.page === 'yield' && (
          <div className="control-panel-title">
            Your current yield target:
            <div className="layer-selection">
              <div className="layer-option">
                <input type="radio" id="yield-target" name="yield-layer" defaultChecked />
                <label htmlFor="yield-target">Yield Target</label>
              </div>
            </div>
          </div>
        )}

        {props.page === 'nutrient-capacity' && (
          <div className="control-panel-title">
           Nutrients currently in soil: 
          <div className="layer-selection">
            {(['n-current','p-current','k-current'] as const).map(v => (
              <div className="layer-option" key={v}>
                <input type="radio" id={v} name="nutrient-current-layer" checked={props.nutrientCurrent===v} onChange={() => props.onSetNutrientCurrent(v)} />
                <label htmlFor={v}>{getNutrientName(v)}</label>
              </div>
            ))}
          </div>
          </div>
        )}

        {props.page === 'nutrient-needed' && (
          <div className="control-panel-title">
           Nutrients needed to reach yield target:
          <div className="layer-selection">
            {(['n-needed','p-needed','k-needed'] as const).map(v => (
              <div className="layer-option" key={v}>
                <input type="radio" id={v} name="nutrient-needed-layer" checked={props.nutrientNeeded===v} onChange={() => props.onSetNutrientNeeded(v)} />
                <label htmlFor={v}>{getNutrientName(v)}</label>
              </div>
            ))}
          </div>
          </div>
        )}

        <button className="panel-button" onClick={props.onBack}>← Back</button>
        {props.page !== 'nutrient-needed' && (
          <button className="panel-button" onClick={props.onNext}>Next →</button>
        )}
        {props.page === 'nutrient-needed' && (
          <button className="download-button" onClick={() => setShowDialog(true)}>Download Rx Map</button>
        )}
      </div>

      {showDialog && (
        <div className="dialog-overlay" onClick={() => setShowDialog(false)}>
          <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
            <p>This feature is a work in progress!</p>
            <button className="dialog-button" onClick={() => setShowDialog(false)}>Send to machine</button>
          </div>
        </div>
      )}
    </div>
  );
}


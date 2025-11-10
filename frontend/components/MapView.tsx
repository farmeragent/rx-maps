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

type PageKey = 'yield' | 'nutrient-capacity' | 'nutrient-needed' | 'yield-view' | 'nutrient-capacity-view';

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

/**
 * Calculate area of a polygon in acres using spherical geometry
 * Uses the spherical excess formula for accurate area calculation
 */
function calculateAcres(polygon: GeoJSONPolygon): number {
  const coordinates = polygon.coordinates[0]; // Outer ring
  if (coordinates.length < 3) return 0;
  
  const METERS_TO_ACRES = 0.000247105; // 1 square meter = 0.000247105 acres
  
  // Use shoelace formula with latitude correction for spherical coordinates
  // This is accurate for small polygons (agricultural fields)
  let area = 0;
  const n = coordinates.length;
  
  // Get average latitude for correction factor
  let avgLat = 0;
  for (let i = 0; i < n - 1; i++) {
    avgLat += coordinates[i][1];
  }
  avgLat /= (n - 1);
  const latCorrection = Math.cos(avgLat * Math.PI / 180);
  
  // Shoelace formula
  for (let i = 0; i < n - 1; i++) {
    const [lon1, lat1] = coordinates[i];
    const [lon2, lat2] = coordinates[i + 1];
    area += (lon2 - lon1) * (lat2 + lat1);
  }
  
  // Calculate area in square meters
  // Convert degrees to meters (approximate: 1 degree lat ≈ 111,320m, 1 degree lon ≈ 111,320m * cos(lat))
  const DEG_TO_M_LAT = 111320; // meters per degree latitude
  const DEG_TO_M_LON = DEG_TO_M_LAT * latCorrection; // meters per degree longitude at this latitude
  const areaM2 = Math.abs(area * 0.5 * DEG_TO_M_LAT * DEG_TO_M_LON);
  
  // Convert to acres
  return areaM2 * METERS_TO_ACRES;
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
  hideNavigation?: boolean;
  hideNextBack?: boolean;
}) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapNode = useRef<HTMLDivElement | null>(null);
  const [showDialog, setShowDialog] = useState<boolean>(false);
  const selectedAttrRef = useRef<string | null>(null);
  const [paintMode, setPaintMode] = useState<boolean>(false);
  const [selectedYieldValue, setSelectedYieldValue] = useState<number>(125);
  const [editedFeatures, setEditedFeatures] = useState<Map<string, { geometry: any; properties: any; yieldValue: number }>>(new Map());
  const [allEncounteredFeatures, setAllEncounteredFeatures] = useState<Map<string, GeoJSON.Feature>>(new Map());
  const [totalAcres, setTotalAcres] = useState<number>(0);
  const [totalYield, setTotalYield] = useState<number>(0);
  const [isCalculatingStats, setIsCalculatingStats] = useState<boolean>(false);
  const isPaintingRef = useRef<boolean>(false);
  const editedFeaturesGeoJSONRef = useRef<GeoJSON.FeatureCollection>({ type: 'FeatureCollection', features: [] });
  const paintModeRef = useRef(paintMode);
  const selectedYieldValueRef = useRef(selectedYieldValue);
  const editedFeaturesRef = useRef(editedFeatures);
  const allFeaturesRef = useRef(allEncounteredFeatures);
  
  // Keep refs in sync with state
  useEffect(() => {
    paintModeRef.current = paintMode;
  }, [paintMode]);
  
  useEffect(() => {
    selectedYieldValueRef.current = selectedYieldValue;
  }, [selectedYieldValue]);
  
  useEffect(() => {
    editedFeaturesRef.current = editedFeatures;
  }, [editedFeatures]);
  
  useEffect(() => {
    allFeaturesRef.current = allEncounteredFeatures;
  }, [allEncounteredFeatures]);

  const cfg = useMemo(() => getSourceConfigForField(props.currentField), [props.currentField]);
  const layerNames = useMemo(() => getLayerNamesForField(props.currentField), [props.currentField]);

  useEffect(() => {
    // keep latest selected attribute available to event handlers
    selectedAttrRef.current = props.selectedAttr;
  }, [props.selectedAttr]);

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

    map.on('load', () => {
      try {
        // source
        if (map.getSource('data-source')) map.removeSource('data-source');
        map.addSource('data-source', { type: 'vector', url: cfg.url });
        
        // Add GeoJSON source for edited features
        if (!map.getSource('edited-features')) {
          map.addSource('edited-features', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
          });
        }
        
        // Add all layers using reusable function
        addMapLayers(map, layerNames, props.selectedAttr);
        
        // Add layer for edited features (renders on top)
        if (!map.getLayer('edited-features-fill')) {
          map.addLayer({
            id: 'edited-features-fill',
            type: 'fill',
            source: 'edited-features',
            paint: {
              'fill-color': buildFillPaint('yield_target') as any,
              'fill-opacity': MAP_STYLE.FILL_OPACITY
            }
          });
        }
        
        if (!map.getLayer('edited-features-line')) {
          map.addLayer({
            id: 'edited-features-line',
            type: 'line',
            source: 'edited-features',
            paint: {
              'line-color': COLORS.LINE_COLOR,
              'line-width': MAP_STYLE.LINE_WIDTH
            }
          });
        }
        
        // Calculate stats when on yield-view page
        if (props.page === 'yield-view' && props.selectedAttr === 'yield_target') {
          calculateFieldStats(map);
        }
      } catch (error) {
        console.error('Error loading map layers:', error);
      }
    });

    const handlePaint = (event: mapboxgl.MapMouseEvent) => {
      // Only allow painting on yield-view page
      if (!paintModeRef.current || !isPaintingRef.current || props.selectedAttr !== 'yield_target' || props.page !== 'yield-view') return;
      
      // First check if we're clicking on an already-edited feature
      const editedFeaturesLayer = map.queryRenderedFeatures(event.point, {
        layers: ['edited-features-fill']
      });
      
      if (editedFeaturesLayer.length > 0) {
        // Update existing edited feature
        const editedFeature = editedFeaturesLayer[0];
        const featureId = editedFeature.id?.toString() || '';
        
        if (featureId) {
          // Update the feature in our GeoJSON
          const featureIndex = editedFeaturesGeoJSONRef.current.features.findIndex(
            (f: any) => f.id === featureId
          );
          
          if (featureIndex >= 0) {
            editedFeaturesGeoJSONRef.current.features[featureIndex].properties = {
              ...editedFeaturesGeoJSONRef.current.features[featureIndex].properties,
              yield_target: selectedYieldValueRef.current
            };
            
            // Update state
            setEditedFeatures(prev => {
              const newMap = new Map(prev);
              if (newMap.has(featureId)) {
                newMap.set(featureId, {
                  ...newMap.get(featureId)!,
                  yieldValue: selectedYieldValueRef.current
                });
              }
              return newMap;
            });
            
            // Update GeoJSON source
            const source = map.getSource('edited-features') as mapboxgl.GeoJSONSource;
            if (source) {
              source.setData(editedFeaturesGeoJSONRef.current);
            }
            return;
          }
        }
      }
      
      // Otherwise, check original tiles and create new edited feature
      const features = map.queryRenderedFeatures(event.point, {
        layers: ['data-fill-highres', 'data-fill-mediumres']
      });
      
      if (features.length > 0) {
        const feature = features[0];
        // Create a unique ID based on feature properties and geometry
        // Use feature ID if available, otherwise use coordinates
        const originalId = feature.id?.toString() || feature.properties?.id || '';
        const coords = JSON.stringify((feature.geometry as GeoJSONPolygon).coordinates);
        const featureId = originalId || `edited-${coords.substring(0, 50)}`;
        
        // Check if we've already edited this feature (by coordinates or ID)
        const existingFeature = editedFeaturesGeoJSONRef.current.features.find((f: any) => {
          if (originalId && f.properties?._originalId === originalId) return true;
          const fCoords = JSON.stringify((f.geometry as GeoJSONPolygon).coordinates);
          return fCoords.substring(0, 50) === coords.substring(0, 50);
        });
        
        if (existingFeature) {
          // Update existing edited feature with new yield value
          existingFeature.properties = {
            ...existingFeature.properties,
            yield_target: selectedYieldValueRef.current
          };
          
          setEditedFeatures(prev => {
            const newMap = new Map(prev);
            const existingId = existingFeature.id?.toString() || featureId;
            if (newMap.has(existingId)) {
              newMap.set(existingId, {
                ...newMap.get(existingId)!,
                yieldValue: selectedYieldValueRef.current
              });
            }
            return newMap;
          });
        } else {
          // Create new edited feature
          const editedFeature: GeoJSON.Feature = {
            type: 'Feature',
            id: featureId,
            geometry: feature.geometry as GeoJSONPolygon,
            properties: {
              ...feature.properties,
              yield_target: selectedYieldValueRef.current,
              _edited: true,
              _originalId: originalId || undefined
            }
          };
          
          setEditedFeatures(prev => {
            const newMap = new Map(prev);
            newMap.set(featureId, { 
              geometry: feature.geometry, 
              properties: feature.properties || {}, 
              yieldValue: selectedYieldValueRef.current 
            });
            return newMap;
          });
          
          // Update GeoJSON source
          editedFeaturesGeoJSONRef.current.features.push(editedFeature);
        }
        
        // Update the GeoJSON source
        const source = map.getSource('edited-features') as mapboxgl.GeoJSONSource;
        if (source) {
          source.setData(editedFeaturesGeoJSONRef.current);
        }
      }
    };

    map.on('mousedown', (event: mapboxgl.MapMouseEvent) => {
      // Only allow painting on yield-view page
      if (paintModeRef.current && props.selectedAttr === 'yield_target' && props.page === 'yield-view') {
        isPaintingRef.current = true;
        handlePaint(event);
        map.getCanvas().style.cursor = 'crosshair';
      }
    });

    map.on('mousemove', (event: mapboxgl.MapMouseEvent) => {
      // Only allow painting on yield-view page
      if (paintModeRef.current && props.selectedAttr === 'yield_target' && props.page === 'yield-view') {
        if (isPaintingRef.current) {
          handlePaint(event);
        }
        if (!isPaintingRef.current) {
          map.getCanvas().style.cursor = 'crosshair';
        }
      } else {
        map.getCanvas().style.cursor = '';
      }
    });

    map.on('mouseup', () => {
      isPaintingRef.current = false;
    });

    map.on('mouseleave', () => {
      isPaintingRef.current = false;
    });

    map.on('click', (event: mapboxgl.MapMouseEvent) => {
      // Skip popup in paint mode
      if (paintModeRef.current && props.selectedAttr === 'yield_target' && props.page === 'yield-view') {
        return;
      }
      
      const currentAttr = selectedAttrRef.current;
      if (!currentAttr) {
        return;
      }
      
      // First check for edited features (they should override original tiles)
      let feature = null;
      const editedFeaturesLayer = map.queryRenderedFeatures(event.point, {
        layers: ['edited-features-fill']
      });
      
      if (editedFeaturesLayer.length > 0) {
        feature = editedFeaturesLayer[0];
      } else {
        // Fall back to original tiles
        const features = map.queryRenderedFeatures(event.point, {
          layers: ['data-fill-highres', 'data-fill-mediumres']
        });
        if (features.length > 0) {
          feature = features[0];
        }
      }
      
      if (!feature || !("coordinates" in feature.geometry)) {
        return;
      }

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

      // Get the value from feature properties (edited features will have updated yield_target)
      var text_value = feature.properties![currentAttr] || 0;
      if (currentAttr === 'yield_target') {
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
    });
    return () => { 
      try { 
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      } catch {} 
    };
  }, [cfg.url, cfg.center, props.currentField]);

  // Update edited features layer paint - use data-driven expression for yield values
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !map.getLayer('edited-features-fill')) return;
    
    try {
      if (props.selectedAttr === 'yield_target') {
        // Use data-driven expression that reads yield_target from feature properties
        const paintExpression = [
          'interpolate',
          ['linear'],
          ['coalesce', ['to-number', ['get', 'yield_target']], 0],
          0, COLORS.YIELD_LOW,
          125, COLORS.YIELD_MID,
          250, COLORS.YIELD_HIGH
        ];
        map.setPaintProperty('edited-features-fill', 'fill-color', paintExpression as any);
      }
    } catch (error) {
      console.error('Error updating edited features paint:', error);
    }
  }, [props.selectedAttr]);

  // Update edited features visibility based on selected attribute
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    
    try {
      const editedLayerIds = ['edited-features-fill', 'edited-features-line'];
      editedLayerIds.forEach(layerId => {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', 
            (props.selectedAttr === 'yield_target' && editedFeatures.size > 0) ? 'visible' : 'none'
          );
        }
      });
    } catch (error) {
      console.error('Error updating edited features visibility:', error);
    }
  }, [props.selectedAttr, editedFeatures.size]);

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

  // Calculate field statistics when on yield-view page
  const calculateFieldStats = async (map: mapboxgl.Map) => {
    if (props.selectedAttr !== 'yield_target' || props.page !== 'yield-view') return;
    
    setIsCalculatingStats(true);
    
    try {
      // Use field-specific bounds or query all features at a high zoom level
      // Get the field center and create a bounding box around it
      const cfg = getSourceConfigForField(props.currentField);
      const center = cfg.center;
      
      // Create a bounding box around the field (adjust as needed based on field size)
      // For now, we'll use a large bounding box that should cover the field
      const bounds = new mapboxgl.LngLatBounds(
        [center[0] - 0.01, center[1] - 0.01], // southwest
        [center[0] + 0.01, center[1] + 0.01]  // northeast
      );
      
      // Set map to show the full field bounds
      map.fitBounds(bounds, { padding: 50, maxZoom: 16 });
      await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for tiles to load
      
      // Query all rendered features at the highest detail level
      let allFeaturesMap = new Map<string, GeoJSON.Feature>();
      
      // Query at zoom 16 to get the highest resolution features
      const features = map.queryRenderedFeatures(undefined, {
        layers: ['data-fill-highres', 'data-fill-mediumres', 'data-fill-boundariesshp', 'edited-features-fill']
      });
      
      // Add unique features to our map (using feature ID or coordinates as key)
      features.forEach(feature => {
        if (feature.geometry.type === 'Polygon') {
          // Use feature ID if available, otherwise use a hash of coordinates
          const coords = JSON.stringify((feature.geometry as GeoJSONPolygon).coordinates);
          const key = feature.id?.toString() || `coords-${coords.substring(0, 100)}`;
          if (!allFeaturesMap.has(key)) {
            allFeaturesMap.set(key, feature as GeoJSON.Feature);
          }
        }
      });
      
      // Also check edited features separately to ensure we have the latest values
      const editedFeaturesList = editedFeaturesGeoJSONRef.current.features;
      editedFeaturesList.forEach((editedFeature: any) => {
        if (editedFeature.geometry.type === 'Polygon') {
          const key = editedFeature.id?.toString() || `edited-${JSON.stringify(editedFeature.geometry.coordinates).substring(0, 100)}`;
          // Override with edited feature if it exists
          allFeaturesMap.set(key, editedFeature);
        }
      });
      
      // Calculate totals
      let totalAcresValue = 0;
      let totalYieldValue = 0;
      
      allFeaturesMap.forEach(feature => {
        if (feature.geometry.type === 'Polygon') {
          const acres = calculateAcres(feature.geometry as GeoJSONPolygon);
          totalAcresValue += acres;
          
          // Get yield_target value (prioritize edited value)
          const yieldTarget = feature.properties?.yield_target || 0;
          totalYieldValue += acres * yieldTarget;
        }
      });
      
      setTotalAcres(totalAcresValue);
      setTotalYield(totalYieldValue);
      setAllEncounteredFeatures(allFeaturesMap);
    } catch (error) {
      console.error('Error calculating field stats:', error);
    } finally {
      setIsCalculatingStats(false);
    }
  };

  // Recalculate stats when entering yield-view page or when edits change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || props.page !== 'yield-view' || props.selectedAttr !== 'yield_target') {
      return;
    }
    
    // Wait a bit for map to fully load
    const timeout = setTimeout(() => {
      calculateFieldStats(map);
    }, 1000);
    
    return () => clearTimeout(timeout);
  }, [props.page, props.selectedAttr, props.currentField, editedFeatures.size]);

  // Clear paint mode when leaving yield-view page
  useEffect(() => {
    if (props.page !== 'yield-view') {
      setPaintMode(false);
      setTotalAcres(0);
      setTotalYield(0);
    }
  }, [props.page]);

  // Clear edited features when field changes or leaving yield-view
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !map.getSource('data-source')) return;
    
    try {
      // Clear edited features when field changes or switching away from yield-view
      if (props.page !== 'yield-view') {
        setEditedFeatures(new Map());
        editedFeaturesGeoJSONRef.current = { type: 'FeatureCollection', features: [] };
        const editedSource = map.getSource('edited-features') as mapboxgl.GeoJSONSource;
        if (editedSource) {
          editedSource.setData(editedFeaturesGeoJSONRef.current);
        }
      }
      
      // Add all layers using reusable function
      addMapLayers(map, layerNames, props.selectedAttr);
    } catch (error) {
      console.error('Error updating layer:', error);
    }
  }, [layerNames, props.selectedAttr, props.currentField, props.page]);
  
  const clearEdits = () => {
    const map = mapRef.current;
    setEditedFeatures(new Map());
    editedFeaturesGeoJSONRef.current = { type: 'FeatureCollection', features: [] };
    if (map && map.getSource('edited-features')) {
      const source = map.getSource('edited-features') as mapboxgl.GeoJSONSource;
      source.setData(editedFeaturesGeoJSONRef.current);
    }
  };

  const saveEditsToTileset = async () => {
    if (editedFeatures.size === 0) {
      alert('No edits to save');
      return;
    }

    try {
      // Convert edited features to array format
      const editedFeaturesArray = Array.from(editedFeatures.entries()).map(([id, data]) => ({
        id,
        yield_target: data.yieldValue,
        geometry: data.geometry,
        properties: data.properties
      }));

      const response = await fetch('/api/mapbox/update-tileset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fieldName: props.currentField,
          editedFeatures: editedFeaturesArray
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save edits');
      }

      const result = await response.json();
      alert(`Success! Tileset update initiated. ${result.message}`);
      
      // Optionally clear edits after successful save
      // clearEdits();
    } catch (error) {
      console.error('Error saving edits:', error);
      alert(`Failed to save edits: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

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

      {!props.hideNavigation && (
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

          {props.page === 'yield-view' && (
            <div className="control-panel-title">
              Your current yield target:
              <div className="layer-selection">
                <div className="layer-option">
                  <input type="radio" id="yield-target-view" name="yield-layer-view" defaultChecked />
                  <label htmlFor="yield-target-view">Yield Target</label>
                </div>
              </div>
              
              {/* Field Statistics */}
              <div style={{ 
                marginTop: '15px', 
                padding: '12px', 
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                borderRadius: '8px',
                border: '1px solid rgba(0,0,0,0.1)'
              }}>
                {isCalculatingStats ? (
                  <div style={{ textAlign: 'center', fontSize: '12px', color: '#666' }}>
                    Calculating...
                  </div>
                ) : (
                  <>
                    <div style={{ 
                      marginBottom: '8px',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#2c3e50'
                    }}>
                      Field Statistics
                    </div>
                    <div style={{ 
                      fontSize: '12px',
                      color: '#555',
                      marginBottom: '4px'
                    }}>
                      Total Acres: <strong style={{ color: '#2d5016' }}>{totalAcres.toFixed(2)}</strong>
                    </div>
                    <div style={{ 
                      fontSize: '12px',
                      color: '#555'
                    }}>
                      Total Expected Yield: <strong style={{ color: '#2d5016' }}>{totalYield.toLocaleString('en-US', { maximumFractionDigits: 0 })} bu</strong>
                    </div>
                  </>
                )}
              </div>
              <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                <div style={{ marginBottom: '10px' }}>
                  <button
                    className="panel-button"
                    onClick={() => setPaintMode(!paintMode)}
                    style={{
                      background: paintMode ? '#27ae60' : 'linear-gradient(135deg,#2d5016,#4a7c59)',
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    {paintMode ? (
                      <>
                        <span>✓</span>
                        <span>Edit Mode On</span>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: '16px' }}>✏️</span>
                        <span>Edit</span>
                      </>
                    )}
                  </button>
                </div>
                {paintMode && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: '#2c3e50' }}>
                      Yield Value (bu/acre):
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="250"
                      value={selectedYieldValue}
                      onChange={(e) => setSelectedYieldValue(Number(e.target.value))}
                      style={{ width: '100%', marginBottom: '8px' }}
                    />
                    <div style={{ 
                      textAlign: 'center', 
                      fontSize: '14px', 
                      fontWeight: 600, 
                      color: '#2d5016',
                      marginBottom: '8px'
                    }}>
                      {selectedYieldValue} bu/acre
                    </div>
                    <div style={{ 
                      width: '100%', 
                      height: '20px', 
                      borderRadius: '4px',
                      background: `linear-gradient(to right, ${COLORS.YIELD_LOW}, ${COLORS.YIELD_MID}, ${COLORS.YIELD_HIGH})`,
                      marginBottom: '12px'
                    }} />
                    {editedFeatures.size > 0 && (
                      <>
                        <button
                          className="panel-button"
                          onClick={saveEditsToTileset}
                          style={{
                            background: '#3498db',
                            width: '100%',
                            fontSize: '12px',
                            padding: '6px 12px',
                            marginBottom: '8px'
                          }}
                        >
                          Save to Tileset ({editedFeatures.size})
                        </button>
                        <button
                          className="panel-button"
                          onClick={clearEdits}
                          style={{
                            background: '#e74c3c',
                            width: '100%',
                            fontSize: '12px',
                            padding: '6px 12px'
                          }}
                        >
                          Clear Edits
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {(props.page === 'nutrient-capacity' || props.page === 'nutrient-capacity-view') && (
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

          {!props.hideNextBack && (
            <>
              <button className="panel-button" onClick={props.onBack}>← Back</button>
              {props.page !== 'nutrient-needed' && (
                <button className="panel-button" onClick={props.onNext}>Next →</button>
              )}
              {props.page === 'nutrient-needed' && (
                <button className="download-button" onClick={() => setShowDialog(true)}>Download Rx Map</button>
              )}
            </>
          )}
        </div>
      )}

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


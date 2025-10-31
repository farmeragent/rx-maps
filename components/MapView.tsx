'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

type PageKey = 'yield' | 'nutrient-capacity' | 'nutrient-needed';

function getNutrientName(n: 'n-current'|'p-current'|'k-current'|'n-needed'|'p-needed'|'k-needed') {
  if (n === 'n-current') return 'Nitrogen (N)';
  if (n === 'p-current') return 'Phosphorus (P)';
  if (n === 'k-current') return 'Potassium (K)';
  if (n === 'n-needed') return 'Nitrogen (N)';
  if (n === 'p-needed') return 'Phosphorus (P)';
  return 'Potassium (K)';
}

function getSourceConfigForField(fieldName: string) {
  switch ((fieldName || '').toLowerCase()) {
    case 'north of road':
      return { url: 'mapbox://zeumer.bofg9ncj', center: [-86.684316, 32.431793] as [number, number] };
    case 'south of road':
      return { url: 'mapbox://zeumer.8d46889j', center: [-86.686834, 32.423013] as [number, number] };
    case 'railroad pivot':
      return { url: 'mapbox://zeumer.2tepd0uh', center: [-86.376, 32.416] as [number, number] };
    default:
      return { url: 'mapbox://zeumer.bofg9ncj', center: [-86.684316, 32.431793] as [number, number] };
  }
}


function getLayerNamesForField(fieldName: string) {
  const field = (fieldName || '').toLowerCase();
  let baseName = '';
  
  switch (field) {
    case 'north of road':
      baseName = 'northofroad';
      break;
    case 'south of road':
      baseName = 'southofroad';
      break;
    case 'railroad pivot':
      baseName = 'railroadpivot';
      break;
    default:
      baseName = 'northofroad';
  }

  return {
    highres: `${baseName}highres`,
    mediumres: `${baseName}mediumres`,
    boundariesshp: 'boundariesshp'
  };
}

function getLegendInfo(attribute: string | null) {
  if (!attribute) return { colors: ['#ffffff', '#ffffff'], min: 0, max: 0 };
  
  if (attribute === 'yield_target') {
    return { colors: ['#a50426', '#fefdbd', '#016937'], stops: [0, 125, 250], min: 0, max: 250 };
  }
  else if (attribute === 'N_in_soil' || attribute === 'N_to_apply') {
    return { colors: ['#f5fbf4', '#054419'], stops: [0, 250], min: 0, max: 250 };
  }
  else if (attribute === 'P_in_soil' || attribute === 'P_to_apply') {
    return { colors: ['#fbfbfd', '#3b0379'], stops: [0, 250], min: 0, max: 250 };
  }
  else if (attribute === 'K_in_soil' || attribute === 'K_to_apply') {
    return { colors: ['#f6faff', '#08316e'], stops: [0, 250], min: 0, max: 250 };
  }
  return { colors: ['#f1f8e9', '#2e7d32'], stops: [0, 100], min: 0, max: 100 };
}

function buildFillPaint(attribute: string | null) {
  if (!attribute) return ['rgba', 0, 0, 0, 0] as any;
  if (attribute === 'yield_target') {
    return [
      'interpolate', ['linear'],
      ['coalesce', ['to-number', ['get', attribute]], 0],
      0, '#a50426',
      125, '#fefdbd',
      250, '#016937'
    ] as any;
  }
  else if (attribute === 'N_in_soil') {
    return [
      'interpolate', ['linear'],
      ['coalesce', ['to-number', ['get', attribute]], 0],
      0, '#f5fbf4',
      250, '#054419'
    ] as any;
  }
  else if (attribute === 'P_in_soil') {
    return [
      'interpolate', ['linear'],
      ['coalesce', ['to-number', ['get', attribute]], 0],
      0, '#fbfbfd',
      250, '#3b0379'
    ] as any;
  }
  else if (attribute === 'K_in_soil') {
    return [
      'interpolate', ['linear'],
      ['coalesce', ['to-number', ['get', attribute]], 0],
      0, '#f6faff',
      250, '#08316e'
    ] as any;
  }
  else if (attribute === 'N_to_apply') {
    return [
      'interpolate', ['linear'],
      ['coalesce', ['to-number', ['get', attribute]], 0],
      0, '#f5fbf4',
      250, '#054419'
    ] as any;
  }
  else if (attribute === 'P_to_apply') {
    return [
      'interpolate', ['linear'],
      ['coalesce', ['to-number', ['get', attribute]], 0],
      0, '#fbfbfd',
      250, '#3b0379'
    ] as any;
  }
  else if (attribute === 'K_to_apply') {
    return [
      'interpolate', ['linear'],
      ['coalesce', ['to-number', ['get', attribute]], 0],
      0, '#f6faff',
      250, '#08316e'
    ] as any;
  }
  return [
    'interpolate', ['linear'],
    ['coalesce', ['to-number', ['get', attribute]], 0],
    0, '#f1f8e9',
    25, '#c8e6c9',
    50, '#81c784',
    75, '#4caf50',
    100, '#2e7d32'
  ] as any;
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
        
        // Remove existing layers if any
        if (map.getLayer('data-fill-highres')) map.removeLayer('data-fill-highres');
        if (map.getLayer('data-line-highres')) map.removeLayer('data-line-highres');
        if (map.getLayer('data-fill-mediumres')) map.removeLayer('data-fill-mediumres');
        if (map.getLayer('data-line-mediumres')) map.removeLayer('data-line-mediumres');
        if (map.getLayer('data-fill-boundariesshp')) map.removeLayer('data-fill-boundariesshp');
        if (map.getLayer('data-line-boundariesshp')) map.removeLayer('data-line-boundariesshp');
        
        // Add highres layer
        map.addLayer({
          id: 'data-fill-highres', type: 'fill', source: 'data-source', 'source-layer': layerNames.highres,
          filter: ['==', ['geometry-type'], 'Polygon'],
          paint: { 'fill-color': buildFillPaint(props.selectedAttr) as any, 'fill-opacity': 0.8 }
        });
        
        map.addLayer({
          id: 'data-line-highres', type: 'line', source: 'data-source', 'source-layer': layerNames.highres,
          filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'Polygon']],
          paint: { 'line-color': '#0f0f0f', 'line-width': .0001 }
        });
        
        // Add mediumres layer
        map.addLayer({
          id: 'data-fill-mediumres', type: 'fill', source: 'data-source', 'source-layer': layerNames.mediumres,
          filter: ['==', ['geometry-type'], 'Polygon'],
          paint: { 'fill-color': buildFillPaint(props.selectedAttr) as any, 'fill-opacity': 0.8 }
        });
        
        map.addLayer({
          id: 'data-line-mediumres', type: 'line', source: 'data-source', 'source-layer': layerNames.mediumres,
          filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'Polygon']],
          paint: { 'line-color': '#0f0f0f', 'line-width': .0001 }
        });
        
        // Add boundariesshp layer
        map.addLayer({
          id: 'data-fill-boundariesshp', type: 'fill', source: 'data-source', 'source-layer': layerNames.boundariesshp,
          filter: ['==', ['geometry-type'], 'Polygon'],
          paint: { 'fill-color': buildFillPaint(props.selectedAttr) as any, 'fill-opacity': 0.8 }
        });
        
        map.addLayer({
          id: 'data-line-boundariesshp', type: 'line', source: 'data-source', 'source-layer': layerNames.boundariesshp,
          filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'Polygon']],
          paint: { 'line-color': '#0f0f0f', 'line-width': 0.0001 }
        });
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
        const coordinates = (feature.geometry as Point | Polygon | LineString).coordinates;
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
      const paintOpacity = props.selectedAttr ? 0.8 : 0.0;
      
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
      // Remove existing layers
      const layerIds = [
        'data-fill-highres', 'data-line-highres',
        'data-fill-mediumres', 'data-line-mediumres',
        'data-fill-boundariesshp', 'data-line-boundariesshp'
      ];
      
      layerIds.forEach(layerId => {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
      });

      // Add highres layer
      map.addLayer({
        id: 'data-fill-highres', type: 'fill', source: 'data-source', 'source-layer': layerNames.highres,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': buildFillPaint(props.selectedAttr) as any, 'fill-opacity': 0.8 }
      });
      
      map.addLayer({
        id: 'data-line-highres', type: 'line', source: 'data-source', 'source-layer': layerNames.highres,
        filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'Polygon']],
        paint: { 'line-color': '#0f0f0f', 'line-width': .0001 }
      });
      
      // Add mediumres layer
      map.addLayer({
        id: 'data-fill-mediumres', type: 'fill', source: 'data-source', 'source-layer': layerNames.mediumres,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': buildFillPaint(props.selectedAttr) as any, 'fill-opacity': 0.8 }
      });
      
      map.addLayer({
        id: 'data-line-mediumres', type: 'line', source: 'data-source', 'source-layer': layerNames.mediumres,
        filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'Polygon']],
        paint: { 'line-color': '#0f0f0f', 'line-width': .0001 }
      });
      
      // Add boundariesshp layer
      map.addLayer({
        id: 'data-fill-boundariesshp', type: 'fill', source: 'data-source', 'source-layer': layerNames.boundariesshp,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': buildFillPaint(props.selectedAttr) as any, 'fill-opacity': 0.8 }
      });
      
      map.addLayer({
        id: 'data-line-boundariesshp', type: 'line', source: 'data-source', 'source-layer': layerNames.boundariesshp,
        filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'Polygon']],
        paint: { 'line-color': '#0f0f0f', 'line-width': .0001 }
      });
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


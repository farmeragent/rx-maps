'use client';

import { useEffect, useMemo, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

type PageKey = 'yield' | 'nutrient-capacity' | 'nutrient-needed';

function getNutrientName(n: 'n-current'|'p-current'|'k-current'|'n-needed'|'p-needed'|'k-needed') {
  if (n === 'n-current') return 'Nitrogen';
  if (n === 'p-current') return 'Phosphorus';
  if (n === 'k-current') return 'Potassium';
  if (n === 'n-needed') return 'Nitrogen';
  if (n === 'p-needed') return 'Phosphorus';
  return 'Potassium';
}

function getSourceConfigForField(fieldName: string) {
  console.log("here")
  switch ((fieldName || '').toLowerCase()) {
    case 'north of road':
      return { url: 'mapbox://zeumer.bofg9ncj', layer: 'northofroadhighres', center: [-86.684316, 32.431793] as [number, number] };
    case 'south of road':
      return { url: 'mapbox://zeumer.8d46889j', layer: 'southofroadhighres', center: [-86.683, 32.422] as [number, number] };
    case 'railroad pivot':
      return { url: 'mapbox://zeumer.2tepd0uh', layer: 'railroadpivothighres', center: [-86.376, 32.416] as [number, number] };
    default:
      return { url: 'mapbox://zeumer.bofg9ncj', layer: 'northofroadhighres', center: [-86.684316, 32.431793] as [number, number] };
  }
}

function buildFillPaint(attribute: string | null) {
  if (!attribute) return ['rgba', 0, 0, 0, 0] as any;
  console.log(attribute)
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
}) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapNode = useRef<HTMLDivElement | null>(null);

  const cfg = useMemo(() => getSourceConfigForField(props.currentField), [props.currentField]);

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

        // layers
        if (map.getLayer('data-fill')) map.removeLayer('data-fill');
        if (map.getLayer('data-line')) map.removeLayer('data-line');

        map.addLayer({
          id: 'data-fill', type: 'fill', source: 'data-source', 'source-layer': cfg.layer,
          filter: ['==', ['geometry-type'], 'Polygon'],
          paint: { 'fill-color': buildFillPaint(props.selectedAttr) as any, 'fill-opacity': 0.8 }
        });

        map.addLayer({
          id: 'data-line', type: 'line', source: 'data-source', 'source-layer': cfg.layer,
          filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'Polygon']],
          paint: { 'line-color': '#0f0f0f', 'line-width': 0.0001 }
        });
      } catch (error) {
        console.error('Error loading map layers:', error);
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
  }, [cfg.url, cfg.layer, cfg.center, props.selectedAttr]);

  // update fill color on attribute change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !map.getLayer('data-fill')) return;
    try {
      map.setPaintProperty('data-fill', 'fill-color', buildFillPaint(props.selectedAttr) as any);
      map.setPaintProperty('data-fill', 'fill-opacity', props.selectedAttr ? 0.6 : 0.0);
    } catch (error) {
      console.error('Error updating paint property:', error);
    }
  }, [props.selectedAttr]);

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <div ref={mapNode} style={{ width: '100%', height: '100%' }} />

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
      </div>
    </div>
  );
}


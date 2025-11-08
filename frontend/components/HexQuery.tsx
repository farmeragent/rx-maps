'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import 'mapbox-gl/dist/mapbox-gl.css';
import { FIELD_NAMES, FIELD_CENTERS } from '../constants';

// Dynamically import deck.gl components (client-side only)
const DeckGL = dynamic(() => import('@deck.gl/react').then(mod => ({ default: mod.DeckGL })), { ssr: false });
const Map = dynamic(() => import('react-map-gl').then(mod => ({ default: mod.Map })), { ssr: false });

const VISUALIZATION_KEYWORDS = [
  'show me',
  'show the',
  'where in the field',
  'where are',
  'highlight',
  'map',
  'visual',
  'visualize',
  'display',
  'plot',
  'heatmap',
  'layer'
];

function questionRequiresVisualization(question: string) {
  const normalized = (question || '').toLowerCase();
  if (!normalized) return false;
  return VISUALIZATION_KEYWORDS.some(keyword => normalized.includes(keyword));
}

interface QueryResult {
  question: string;
  intent?: string;
  field_name?: string;
  sql?: string;
  results: any[];
  hex_ids: string[];
  count: number;
  summary: string;
}

interface Message {
  type: 'user' | 'bot' | 'error';
  text: string;
  sql?: string;
  metadata?: string;
}

// Use Next.js API routes as proxy to backend
const API_BASE_URL = '/api/hex-query';
const GEOJSON_PATH = '/north-of-road-high-res.geojson';

const FIELD_GEOJSON_SOURCES: Array<{ field: string; path: string }> = [
  { field: FIELD_NAMES.NORTH_OF_ROAD, path: '/north-of-road-high-res.geojson' },
  { field: FIELD_NAMES.SOUTH_OF_ROAD, path: '/south-of-road-high-res.geojson' },
  { field: FIELD_NAMES.RAILROAD_PIVOT, path: '/railroad-pivot-high-res.geojson' }
];

const FIELD_CENTERS_BY_NAME: Record<string, [number, number]> = {
  [FIELD_NAMES.NORTH_OF_ROAD]: FIELD_CENTERS.NORTH_OF_ROAD,
  [FIELD_NAMES.SOUTH_OF_ROAD]: FIELD_CENTERS.SOUTH_OF_ROAD,
  [FIELD_NAMES.RAILROAD_PIVOT]: FIELD_CENTERS.RAILROAD_PIVOT
};

const FIELD_KEYWORDS: Array<{ field: string; keywords: string[] }> = [
  { field: FIELD_NAMES.NORTH_OF_ROAD, keywords: ['north of road', 'north field', 'north-of-road'] },
  { field: FIELD_NAMES.SOUTH_OF_ROAD, keywords: ['south of road', 'south field', 'south-of-road'] },
  { field: FIELD_NAMES.RAILROAD_PIVOT, keywords: ['railroad pivot', 'railroad field', 'pivot'] }
];

const QUICK_PROMPTS = [
  'Highlight fields with low phosphorus this month.',
  'Show me hexes that need more than 100 units of nitrogen.',
  'Compare yield targets across all fields.',
  'Where should we prioritize potassium applications?'
];

function detectFieldFromQuestion(question: string): string | null {
  const normalized = (question || '').toLowerCase();
  if (!normalized) return null;
  for (const { field, keywords } of FIELD_KEYWORDS) {
    if (keywords.some(keyword => normalized.includes(keyword))) {
      return field;
    }
  }
  return null;
}

function detectFieldsInQuestion(question: string): string[] {
  const normalized = (question || '').toLowerCase();
  if (!normalized) return [];
  const matches = FIELD_KEYWORDS.filter(({ keywords }) =>
    keywords.some(keyword => normalized.includes(keyword))
  ).map(({ field }) => field);

  if (matches.length > 1) {
    return Array.from(new Set(matches));
  }

  if (matches.length === 0) {
    if (normalized.includes('all fields') || normalized.includes('multiple fields') || normalized.includes('fields')) {
      return Object.values(FIELD_NAMES);
    }
  }

  return Array.from(new Set(matches));
}

export default function HexQuery() {
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      type: 'bot',
      text: '👋 Hi! I can help you query your agricultural hex data. Try asking:\n• "Show me hexes with low phosphorus"\n• "What\'s the average yield target?"\n• "Find hexes that need more than 100 units of nitrogen"\n• "Show hexes with high yield and low potassium"'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [highlightedHexes, setHighlightedHexes] = useState<Set<string>>(new Set());
  const [hoveredHex, setHoveredHex] = useState<string | null>(null);
  const [prescriptionMaps, setPrescriptionMaps] = useState<any[]>([]);
  const [selectedPrescriptionLayer, setSelectedPrescriptionLayer] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [shouldAnimateToMap, setShouldAnimateToMap] = useState(false);
  const [viewState, setViewState] = useState({
    longitude: -86.685,
    latitude: 32.433,
    zoom: 13,
    pitch: 0,
    bearing: 0
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesRef = useRef<Message[]>([
    {
      type: 'bot',
      text: '👋 Hi! I can help you query your agricultural hex data. Try asking:\n• "Show me hexes with low phosphorus"\n• "What\'s the average yield target?"\n• "Find hexes that need more than 100 units of nitrogen"\n• "Show hexes with high yield and low potassium"'
    }
  ]);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hexToFieldRef = useRef<Record<string, string>>({});
  const pendingFieldsRef = useRef<string[]>([]);
  const [requestedField, setRequestedField] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const initialQuestion = (searchParams?.get('question') || '').trim();
  const lastAutoQuestionRef = useRef<string | null>(null);

  // Ensure component is mounted on client before rendering client-only content
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load GeoJSON data
  useEffect(() => {
    console.log('Loading GeoJSON from:', GEOJSON_PATH);
    fetch(GEOJSON_PATH)
      .then(res => {
        if (!res.ok) {
          throw new Error(`Failed to fetch GeoJSON: ${res.status} ${res.statusText}`);
        }
        return res.json();
      })
      .then(data => {
        console.log(`Loaded GeoJSON with ${data.features?.length || 0} features`);
        if (data.features && data.features.length > 0) {
          console.log('Sample feature:', data.features[0]);
          console.log('Sample feature properties:', data.features[0].properties);
        }
        setGeoJsonData(data);
      })
      .catch(error => {
        console.error('Failed to load GeoJSON:', error);
      });
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const submitQuestion = async (rawQuestion: string) => {
    const question = rawQuestion.trim();
    if (!question || isLoading) return;

    const requiresMap = questionRequiresVisualization(question);
    const fieldsMentioned = detectFieldsInQuestion(question);
    pendingFieldsRef.current = fieldsMentioned;
    const targetedField = fieldsMentioned.length === 1 ? fieldsMentioned[0] : detectFieldFromQuestion(question);

    if (requiresMap && !showMap) {
      setShouldAnimateToMap(true);
      setShowMap(true);
    } else if (!requiresMap && showMap) {
      setShowMap(false);
      setShouldAnimateToMap(false);
    }

    if (requiresMap && targetedField) {
      setRequestedField(targetedField);
    } else if (!requiresMap) {
      setRequestedField(null);
    }

    setInputValue('');
    addUserMessage(question);
    setIsLoading(true);

    try {
      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.detail || 'Query failed');
      }

      const result: QueryResult = await response.json();
      console.log('Query result:', result);

      // Check if this is a prescription map request
      if (result.intent === 'prescription_map') {
        console.log('Prescription map intent detected!');
        // Add initial bot message
        addBotMessage(result.summary);

        // Call prescription map API
        console.log('Calling prescription map API with field:', result.field_name || 'North of Road');
        const prescriptionResponse = await fetch('/api/prescription-map', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ field_name: result.field_name || 'North of Road' })
        });

        console.log('Prescription response status:', prescriptionResponse.status);

        if (!prescriptionResponse.ok) {
          throw new Error('Failed to create prescription map');
        }

        const prescriptionData = await prescriptionResponse.json();
        setIsLoading(false);

        // Store prescription maps and select first layer
        if (prescriptionData.prescription_maps && prescriptionData.prescription_maps.length > 0) {
          setPrescriptionMaps(prescriptionData.prescription_maps);
          setSelectedPrescriptionLayer(prescriptionData.prescription_maps[0].pass);
          setHighlightedHexes(new Set()); // Clear highlighted hexes
        }

        // Add success message
        const passCount = prescriptionData.prescription_maps?.length || 0;
        addBotMessage(
          `✓ Created ${passCount} prescription passes for ${prescriptionData.summary?.field_name || 'the field'}:\n` +
          prescriptionData.prescription_maps.map((pm: any) =>
            `• ${pm.pass}: ${pm.geojson.features[0].properties.rate} ${pm.geojson.features[0].properties.unit}`
          ).join('\n')
        );

      } else {
        // Normal query flow
        setIsLoading(false);

        // Add bot message
        addBotMessage(result.summary, result.sql, `Found ${result.count.toLocaleString()} result(s)`);

        // Highlight hexes on map
        if (result.hex_ids && result.hex_ids.length > 0) {
          setHighlightedHexes(new Set(result.hex_ids));
        } else {
          setHighlightedHexes(new Set());
        }

        // Display detailed results if available
        if (result.results && result.results.length > 0 && result.hex_ids.length === 0) {
          displayDetailedResults(result.results);
        }
      }

      if (!requiresMap && pendingFieldsRef.current.length > 1) {
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem(
              'assistantMultiField',
              JSON.stringify({
                question,
                results: result.results || [],
                summary: result.summary,
                sql: result.sql,
                count: result.count,
                timestamp: Date.now()
              })
            );
            sessionStorage.setItem('assistantChatHistory', JSON.stringify(messagesRef.current));
          } catch (storageError) {
            console.error('Failed to persist multi-field assistant data:', storageError);
          }
          window.location.href = '/multi-field';
        }
        pendingFieldsRef.current = [];
        return;
      }

      pendingFieldsRef.current = [];
    } catch (error) {
      setIsLoading(false);
      addErrorMessage(error instanceof Error ? error.message : 'Query failed. Please try again.');
      pendingFieldsRef.current = [];
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;
    await submitQuestion(inputValue);
  };

  useEffect(() => {
    if (!mounted) return;
    if (!initialQuestion) return;
    if (lastAutoQuestionRef.current === initialQuestion) return;

    lastAutoQuestionRef.current = initialQuestion;
    setInputValue(initialQuestion);
    submitQuestion(initialQuestion);
  }, [mounted, initialQuestion]);


  const appendMessage = (message: Message) => {
    setMessages(prev => {
      const next = [...prev, message];
      messagesRef.current = next;
      return next;
    });
  };

  const addUserMessage = (text: string) => {
    appendMessage({ type: 'user', text });
  };

  const addBotMessage = (text: string, sql?: string, metadata?: string) => {
    appendMessage({ type: 'bot', text, sql, metadata });
  };

  const addErrorMessage = (error: string) => {
    appendMessage({ type: 'error', text: error });
  };

  const displayDetailedResults = (results: any[]) => {
    if (results.length === 1) {
      const data = results[0];
      let details = '';
      for (const [key, value] of Object.entries(data)) {
        if (key !== 'h3_index') {
          const formattedValue = typeof value === 'number'
            ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
            : String(value);
          details += `${key}: ${formattedValue}\n`;
        }
      }
      if (details) {
        addBotMessage(details);
      }
    }
  };

  const handleClearHistory = async () => {
    try {
      await fetch('/api/hex-query/clear-history', { method: 'POST' });
      setMessages(prev => {
        const base = prev.length > 0 ? [prev[0]] : [];
        messagesRef.current = base;
        return base;
      }); // Keep welcome message
      setHighlightedHexes(new Set());
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('assistantChatHistory');
      }
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  // Helper function to interpolate between colors based on yield_target
  const interpolateColor = (value: number, stops: number[], colors: string[]): number[] => {
    // Clamp value to range
    const clampedValue = Math.max(stops[0], Math.min(stops[stops.length - 1], value));

    // Find which color segment we're in
    for (let i = 0; i < stops.length - 1; i++) {
      if (clampedValue >= stops[i] && clampedValue <= stops[i + 1]) {
        const range = stops[i + 1] - stops[i];
        const t = (clampedValue - stops[i]) / range; // 0 to 1

        // Parse hex colors
        const color1 = colors[i].replace('#', '');
        const color2 = colors[i + 1].replace('#', '');

        const r1 = parseInt(color1.substring(0, 2), 16);
        const g1 = parseInt(color1.substring(2, 4), 16);
        const b1 = parseInt(color1.substring(4, 6), 16);

        const r2 = parseInt(color2.substring(0, 2), 16);
        const g2 = parseInt(color2.substring(2, 4), 16);
        const b2 = parseInt(color2.substring(4, 6), 16);

        // Linear interpolation
        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);

        return [r, g, b, 180];
      }
    }

    // Default to first color if something goes wrong
    const color = colors[0].replace('#', '');
    return [
      parseInt(color.substring(0, 2), 16),
      parseInt(color.substring(2, 4), 16),
      parseInt(color.substring(4, 6), 16),
      180
    ];
  };

  // Color stops for yield target visualization
  const YIELD_STOPS = [0, 125, 250];
  const YIELD_COLORS = ['#a50426', '#fefdbd', '#016937'];

  const handlePromptSelect = (prompt: string) => {
    setInputValue(prompt);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const canSend = inputValue.trim().length > 0 && !isLoading;
  const layoutClass = showMap
    ? 'hex-query-layout hex-query-layout--map'
    : 'hex-query-layout hex-query-layout--solo';

  // Colors matching the original config
  const COLORS = {
    HIGHLIGHTED: [255, 100, 100, 220],   // Red
    HOVER: [255, 200, 100, 220]          // Orange
  };

  const MAX_LINE_WIDTH_ZOOM_LEVEL = 12;

  const [layersState, setLayersState] = useState<any[]>([]);

  // Create layers with deck.gl
  useEffect(() => {
    if (!mounted || !geoJsonData || typeof window === 'undefined') {
      setLayersState([]);
      return;
    }

    console.log('Creating layers with', geoJsonData.features.length, 'features');

    // Dynamically import GeoJsonLayer and PolygonLayer when needed
    Promise.all([
      import('@deck.gl/layers').then(mod => mod.GeoJsonLayer),
      import('@deck.gl/layers').then(mod => mod.PolygonLayer)
    ]).then(([GeoJsonLayer, PolygonLayer]) => {
      const layers: any[] = [];

      // Helper function to get base color (without highlighting logic)
      const getBaseColor = (feature: any) => {
        // If prescription layer is selected, color by application rate
        if (selectedPrescriptionLayer && prescriptionMaps.length > 0) {
          let value = 0;
          let stops = [0, 100, 200];
          let colors = ['#a50426', '#fefdbd', '#016937']; // Default: Red -> Yellow -> Green

          if (selectedPrescriptionLayer === 'nitrogen pass') {
            value = feature.properties.N_to_apply || 0;
            stops = [0, 250]; // Nitrogen range
            colors = ['#f5fbf4', '#054419']; // Light green -> Dark green
          } else if (selectedPrescriptionLayer === 'phosphorus pass') {
            value = feature.properties.P_to_apply || 0;
            stops = [0, 250]; // Phosphorus range
            colors = ['#fbfbfd', '#3b0379']; // Light white/blue -> Dark purple
          } else if (selectedPrescriptionLayer === 'potassium pass') {
            value = feature.properties.K_to_apply || 0;
            stops = [0, 250]; // Potassium range
            colors = ['#f6faff', '#08316e']; // Light blue -> Dark navy
          }

          return interpolateColor(value, stops, colors);
        }

        // Default state - color based on yield_target
        const yieldTarget = feature.properties.yield_target || 0;
        return interpolateColor(yieldTarget, YIELD_STOPS, YIELD_COLORS);
      };

      // Get fill color for hex based on state
      const getFillColor = (feature: any) => {
        const h3Index = feature.properties.h3_index;

        // Hover state (highest priority)
        if (hoveredHex === h3Index) {
          return COLORS.HOVER;
        }

        return getBaseColor(feature);
      };

      // Get line width based on zoom level
      const getLineWidth = (feature: any) => {
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

        // Highlighted hexes layer: Only highlighted hexes at full brightness
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

      setLayersState(layers);
    }).catch((error) => {
      console.error('Failed to load deck.gl layers:', error);
      setLayersState([]);
    });
  }, [mounted, geoJsonData, highlightedHexes, hoveredHex, prescriptionMaps, selectedPrescriptionLayer, viewState.zoom]);

  // Handle hover events
  const handleHover = (info: any) => {
    if (info.object) {
      const props = info.object.properties;
      setHoveredHex(props.h3_index);

      // Update tooltip position and content
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
    <div className={layoutClass}>
      {showMap && (
        <div className="hex-query-map" id="map-container">
          <Link href="/" className="hex-query-back">
            ← Back to Dashboard
          </Link>

      {/* Map Section */}
      <div
        id="map-container"
        style={{
          flex: 1,
          position: 'relative',
          backgroundColor: '#1a1a1a',
          width: '100%',
          height: '100vh',
          overflow: 'hidden'
        }}
      >
        {mounted && DeckGL && Map && (
          <>
            {process.env.NODE_ENV === 'development' && (
              <div style={{
                position: 'absolute',
                top: '60px',
                left: '20px',
                zIndex: 1000,
                background: 'rgba(0,0,0,0.7)',
                color: 'white',
                padding: '10px',
                fontSize: '12px',
                borderRadius: '4px'
              }}>
                <div>Layers: {layersState.length}</div>
                <div>GeoJSON: {geoJsonData ? `${geoJsonData.features?.length || 0} features` : 'loading...'}</div>
                <div>Highlighted: {highlightedHexes.size}</div>
                <div>Hovered: {hoveredHex || 'none'}</div>
              </div>
            )}

            {/* Prescription Map Layer Controls */}
            {prescriptionMaps.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '20px',
                right: '420px',
                zIndex: 1000,
                background: 'rgba(0,0,0,0.8)',
                color: 'white',
                padding: '15px',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
              }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px' }}>
                  Prescription Maps
                </div>
              )}

              {prescriptionMaps.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '20px',
                    right: '420px',
                    zIndex: 1000,
                    background: 'rgba(0,0,0,0.8)',
                    color: 'white',
                    padding: '15px',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px' }}>
                    Prescription Maps
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="prescription-layer"
                        checked={selectedPrescriptionLayer === null}
                        onChange={() => setSelectedPrescriptionLayer(null)}
                        style={{ marginRight: '8px' }}
                      />
                      <span style={{ fontSize: '13px' }}>None (Show Data)</span>
                    </label>
                    {prescriptionMaps.map((pm) => (
                      <label
                        key={pm.pass}
                        style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                      >
                        <input
                          type="radio"
                          name="prescription-layer"
                          checked={selectedPrescriptionLayer === pm.pass}
                          onChange={() => setSelectedPrescriptionLayer(pm.pass)}
                          style={{ marginRight: '8px' }}
                        />
                        <span style={{ fontSize: '13px' }}>
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
                style={{ width: '100%', height: '100%' }}
                getCursor={({ isDragging }: any) => (isDragging ? 'grabbing' : 'grab')}
                onLoad={() => console.log('DeckGL loaded, layers:', layersState.length)}
                onError={(error: any) => console.error('DeckGL error:', error)}
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

          {mounted && !process.env.NEXT_PUBLIC_MAPBOX_TOKEN && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: 'white',
                textAlign: 'center',
                zIndex: 1000
              }}
            >
              <div style={{
                padding: '12px 16px',
                maxWidth: '320px',
                wordWrap: 'break-word',
                background: message.type === 'user'
                  ? '#3b82f6'
                  : message.type === 'error'
                  ? '#fee2e2'
                  : '#f3f4f6',
                color: message.type === 'user'
                  ? 'white'
                  : message.type === 'error'
                  ? '#991b1b'
                  : '#1f2937',
                borderRadius: message.type === 'user'
                  ? '18px 18px 4px 18px'
                  : '18px 18px 18px 4px'
              }}>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{message.text}</p>
                {message.metadata && (
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                    {message.metadata}
                  </div>
                )}
                {message.sql && (
                  <details style={{ marginTop: '8px' }}>
                    <summary style={{
                      cursor: 'pointer',
                      padding: '6px 8px',
                      background: '#374151',
                      color: '#9ca3af',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      userSelect: 'none',
                      listStyle: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <span style={{ fontSize: '9px' }}>▶</span> View SQL Query
                    </summary>
                    <div style={{
                      marginTop: '6px',
                      padding: '8px',
                      background: '#1f2937',
                      color: '#10b981',
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      overflowX: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all'
                    }}>
                      {message.sql}
                    </div>
                  </details>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div style={{ alignSelf: 'flex-start' }}>
              <div style={{
                padding: '12px 16px',
                background: '#f3f4f6',
                borderRadius: '18px 18px 18px 4px',
                display: 'flex',
                gap: '4px'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  background: '#9ca3af',
                  borderRadius: '50%',
                  animation: 'bounce 1.4s infinite ease-in-out both'
                }} />
                <div style={{
                  width: '8px',
                  height: '8px',
                  background: '#9ca3af',
                  borderRadius: '50%',
                  animation: 'bounce 1.4s infinite ease-in-out both',
                  animationDelay: '-0.16s'
                }} />
                <div style={{
                  width: '8px',
                  height: '8px',
                  background: '#9ca3af',
                  borderRadius: '50%',
                  animation: 'bounce 1.4s infinite ease-in-out both',
                  animationDelay: '-0.32s'
                }} />
              </div>
            </div>
          )}

          <div ref={tooltipRef} className="hex-query-tooltip" />
        </div>
      )}

      <div className="hex-query-layout__assistant">
        <aside
          className={`assistant-pane assistant-pane--embedded ${
            showMap ? 'assistant-pane--map' : 'assistant-pane--dialog'
          }`}
        >
          <div className="assistant-pane__surface">
            <header className="assistant-pane__header">
              <div>
                <p className="assistant-pane__title">Query Assistant</p>
                <p className="assistant-pane__subtitle">
                  Ask about fields, nutrients, or yield trends. I&apos;ll pull maps whenever you need a
                  visual.
                </p>
              </div>
              <div className="assistant-pane__action-row">
                {showMap && (
                  <Link href="/" className="assistant-pane__action-btn">
                    Dashboard
                  </Link>
                )}
                <button
                  type="button"
                  className="assistant-pane__action-btn assistant-pane__action-btn--danger"
                  onClick={handleClearHistory}
                >
                  Clear history
                </button>
              </div>
            </header>

            <div className="assistant-pane__messages">
              {messages.map((message, index) => {
                const roleClass =
                  message.type === 'user'
                    ? 'assistant-pane__bubble--user'
                    : message.type === 'error'
                      ? 'assistant-pane__bubble--error'
                      : 'assistant-pane__bubble--assistant';
                return (
                  <div key={index} className={`assistant-pane__bubble ${roleClass}`}>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{message.text}</div>
                    {message.metadata && (
                      <div className="assistant-pane__meta">{message.metadata}</div>
                    )}
                    {message.sql && (
                      <pre className="assistant-pane__sql" aria-label="Generated SQL">
                        {message.sql}
                      </pre>
                    )}
                  </div>
                );
              })}
              {isLoading && (
                <div className="assistant-pane__bubble assistant-pane__bubble--assistant assistant-pane__bubble--thinking">
                  <span className="assistant-pane__dot" />
                  <span className="assistant-pane__dot" />
                  <span className="assistant-pane__dot" />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="assistant-pane__quick">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="assistant-pane__quick-btn"
                  onClick={() => handlePromptSelect(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>

            <form
              className="assistant-pane__composer"
              onSubmit={(event) => {
                event.preventDefault();
                if (canSend) {
                  handleSend();
                }
              }}
            >
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    if (canSend) {
                      handleSend();
                    }
                  }
                }}
                placeholder="Ask a question about your field data..."
                className="assistant-pane__input"
                rows={2}
              />
              <button type="submit" className="assistant-pane__send" disabled={!canSend}>
                Send
              </button>
            </form>
          </div>
        </aside>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0);
          }
          40% {
            transform: scale(1);
          }
        }
        .tooltip {
          display: none;
        }
        .tooltip.show {
          display: block;
        }
        .tooltip-row {
          display: flex;
          justify-content: space-between;
          margin: 4px 0;
        }
        .tooltip-label {
          font-weight: 600;
          margin-right: 8px;
        }
        details[open] summary span {
          transform: rotate(90deg);
        }
        details summary span {
          display: inline-block;
          transition: transform 0.2s ease;
        }
        details summary:hover {
          background: #4b5563 !important;
        }
      `}</style>
    </div>
  );
}
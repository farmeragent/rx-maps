'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import 'mapbox-gl/dist/mapbox-gl.css';

// Dynamically import deck.gl components (client-side only)
const DeckGL = dynamic(() => import('@deck.gl/react').then(mod => ({ default: mod.DeckGL })), { ssr: false });
const Map = dynamic(() => import('react-map-gl').then(mod => ({ default: mod.Map })), { ssr: false });

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
  const [viewState, setViewState] = useState({
    longitude: -86.685,
    latitude: 32.433,
    zoom: 13,
    pitch: 0,
    bearing: 0
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

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

  const submitQuestion = async (rawQuestion: string) => {
    const question = rawQuestion.trim();
    if (!question || isLoading) return;

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

<<<<<<< HEAD
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

=======
      addBotMessage(result.summary, result.sql, `Found ${result.count.toLocaleString()} result(s)`);

      if (result.hex_ids && result.hex_ids.length > 0) {
        setHighlightedHexes(new Set(result.hex_ids));
>>>>>>> 76ae5aa (Add new assistant chat homepage)
      } else {
        // Normal query flow
        setIsLoading(false);

<<<<<<< HEAD
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
=======
      if (result.results && result.results.length > 0 && result.hex_ids.length === 0) {
        displayDetailedResults(result.results);
>>>>>>> 76ae5aa (Add new assistant chat homepage)
      }
    } catch (error) {
      setIsLoading(false);
      addErrorMessage(error instanceof Error ? error.message : 'Query failed. Please try again.');
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


  const addUserMessage = (text: string) => {
    setMessages(prev => [...prev, { type: 'user', text }]);
  };

  const addBotMessage = (text: string, sql?: string, metadata?: string) => {
    setMessages(prev => [...prev, { type: 'bot', text, sql, metadata }]);
  };

  const addErrorMessage = (error: string) => {
    setMessages(prev => [...prev, { type: 'error', text: error }]);
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
      setMessages([messages[0]]); // Keep welcome message
      setHighlightedHexes(new Set());
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

    // Dynamically import GeoJsonLayer when needed
    import('@deck.gl/layers').then(({ GeoJsonLayer }) => {
      const layers: any[] = [];

      // Get fill color for hex based on state
      const getFillColor = (feature: any) => {
        const h3Index = feature.properties.h3_index;

        // Hover state (highest priority)
        if (hoveredHex === h3Index) {
          return COLORS.HOVER;
        }

        // Highlighted state
        if (highlightedHexes.has(h3Index)) {
          return COLORS.HIGHLIGHTED;
        }

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

      const layer: any = new (GeoJsonLayer as any)({
        id: 'hex-layer',
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
        getLineWidth: 0.1,
        lineWidthMinPixels: 1.0,
        updateTriggers: {
          getFillColor: [Array.from(highlightedHexes), hoveredHex, selectedPrescriptionLayer]
        },
        visible: true,
        opacity: 1
      });
      layers.push(layer);

      setLayersState(layers);
    }).catch((error) => {
      console.error('Failed to load deck.gl layers:', error);
      setLayersState([]);
    });
  }, [mounted, geoJsonData, highlightedHexes, hoveredHex, prescriptionMaps, selectedPrescriptionLayer]);

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
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Back Button */}
      <a
        href="/"
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          zIndex: 1000,
          padding: '10px 20px',
          backgroundColor: 'rgba(45, 80, 22, 0.9)',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '6px',
          fontSize: '14px',
          fontWeight: 600,
          transition: 'background-color 0.2s',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(45, 80, 22, 1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(45, 80, 22, 0.9)';
        }}
      >
        ← Back to Dashboard
      </a>

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
                    <label key={pm.pass} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="prescription-layer"
                        checked={selectedPrescriptionLayer === pm.pass}
                        onChange={() => setSelectedPrescriptionLayer(pm.pass)}
                        style={{ marginRight: '8px' }}
                      />
                      <span style={{ fontSize: '13px' }}>
                        {pm.pass} ({pm.geojson.features[0].properties.rate} {pm.geojson.features[0].properties.unit})
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
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: 'white',
            textAlign: 'center',
            zIndex: 1000
          }}>
            <p>Mapbox token not configured. Please set NEXT_PUBLIC_MAPBOX_TOKEN in your environment variables.</p>
          </div>
        )}
      </div>

      {/* Chat Section */}
      <div style={{
        width: '400px',
        background: 'white',
        borderLeft: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Chat Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f9fafb'
        }}>
          <h2 style={{ fontSize: '20px', color: '#1f2937', margin: 0 }}>
            Query Assistant
          </h2>
          <button
            onClick={handleClearHistory}
            style={{
              padding: '6px 12px',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#dc2626'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#ef4444'; }}
          >
            Clear History
          </button>
        </div>

        {/* Chat Messages */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {messages.map((message, index) => (
            <div
              key={index}
              style={{
                alignSelf: message.type === 'user' ? 'flex-end' : 'flex-start',
                animation: 'fadeIn 0.3s ease-in'
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
                  <div style={{
                    marginTop: '8px',
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
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <div style={{
          padding: '20px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          gap: '8px',
          background: 'white'
        }}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !isLoading) {
                handleSend();
              }
            }}
            placeholder="Ask a question about your field data..."
            style={{
              flex: 1,
              padding: '12px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none'
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; }}
          />
          <button
            onClick={handleSend}
            disabled={isLoading}
            style={{
              padding: '12px 24px',
              background: isLoading ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => {
              if (!isLoading) e.currentTarget.style.background = '#2563eb';
            }}
            onMouseLeave={(e) => {
              if (!isLoading) e.currentTarget.style.background = '#3b82f6';
            }}
          >
            Send
          </button>
        </div>
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
      `}</style>
    </div>
  );
}


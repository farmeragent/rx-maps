'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import ChatSidebar from './ChatSidebar';
import HexMapView from './HexMapView';

interface QueryResult {
  question: string;
  intent?: string;
  field_name?: string;
  sql?: string;
  results: any[];
  hex_ids: string[];
  count: number;
  summary: string;
  view_type?: 'map' | 'table' | null;
  column_metadata?: Record<string, { display_name: string; unit?: string }>;
}

interface Message {
  type: 'user' | 'bot' | 'error';
  text: string;
  sql?: string;
  metadata?: string;
  tableData?: any[];
  columnMetadata?: Record<string, { display_name: string; unit?: string }>;
}

const API_BASE_URL = '/api/hex-query';
const GEOJSON_PATH = '/north-of-road-high-res.geojson';

export default function HexQuery() {
  const searchParams = useSearchParams();
  const initialQuestion = searchParams?.get('question') || '';
  const hasSubmittedInitialQuestion = useRef(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      type: 'bot',
      text: '👋 Hi! I can help you query your agricultural hex data. Try asking:\n• "Show me hexes with low phosphorus"\n• "What\'s the average yield target?"\n• "Find hexes that need more than 100 units of nitrogen"\n• "Show hexes with high yield and low potassium"'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentView, setCurrentView] = useState<'map' | 'table' | null>(null);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [hasShownMap, setHasShownMap] = useState(false);
  const [isFullWidth, setIsFullWidth] = useState(true); // Start with full-width chat

  // Map-specific state
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [highlightedHexes, setHighlightedHexes] = useState<Set<string>>(new Set());
  const [prescriptionMaps, setPrescriptionMaps] = useState<any[]>([]);
  const [selectedPrescriptionLayer, setSelectedPrescriptionLayer] = useState<string | null>(null);

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
        setGeoJsonData(data);
      })
      .catch(error => {
        console.error('Failed to load GeoJSON:', error);
      });
  }, []);

  // Handle initial question from URL
  useEffect(() => {
    if (initialQuestion && messages.length === 1 && !hasSubmittedInitialQuestion.current) {
      hasSubmittedInitialQuestion.current = true;
      setInputValue(initialQuestion);
      handleSubmit(initialQuestion);
    }
  }, [initialQuestion, messages.length]);

  const addUserMessage = (text: string) => {
    setMessages(prev => [...prev, { type: 'user', text }]);
  };

  const addBotMessage = (
    text: string,
    sql?: string,
    metadata?: string,
    tableData?: any[],
    columnMetadata?: Record<string, { display_name: string; unit?: string }>
  ) => {
    setMessages(prev => [...prev, { type: 'bot', text, sql, metadata, tableData, columnMetadata }]);
  };

  const addErrorMessage = (error: string) => {
    setMessages(prev => [...prev, { type: 'error', text: error }]);
  };

  const handleSubmit = async (question?: string) => {
    const q = question || inputValue.trim();
    if (!q || isLoading) return;

    setInputValue('');
    addUserMessage(q);
    setIsLoading(true);

    try {
      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.detail || 'Query failed');
      }

      const result: QueryResult = await response.json();
      console.log('Query result:', result);

      // Check if this is a prescription map request
      if (result.intent === 'prescription_map') {
        addBotMessage(result.summary);

        // Call prescription map API
        const prescriptionResponse = await fetch('/api/prescription-map', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ field_name: result.field_name || 'North of Road' })
        });

        if (!prescriptionResponse.ok) {
          throw new Error('Failed to create prescription map');
        }

        const prescriptionData = await prescriptionResponse.json();
        setIsLoading(false);

        // Store prescription maps and select first layer
        if (prescriptionData.prescription_maps && prescriptionData.prescription_maps.length > 0) {
          setPrescriptionMaps(prescriptionData.prescription_maps);
          setSelectedPrescriptionLayer(prescriptionData.prescription_maps[0].pass);
          setHighlightedHexes(new Set());
          setCurrentView('map'); // Show map for prescription
          setHasShownMap(true); // Mark that we've shown the map at least once
          setIsFullWidth(false); // Switch to sidebar mode
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
        setQueryResult(result);

        // Handle different view types
        if (result.view_type === 'map') {
          setCurrentView('map');
          setHasShownMap(true); // Mark that we've shown the map at least once
          setIsFullWidth(false); // Switch to sidebar mode
          // Highlight hexes on map
          if (result.hex_ids && result.hex_ids.length > 0) {
            setHighlightedHexes(new Set(result.hex_ids));
          }
          // Add bot message without table data
          addBotMessage(result.summary, result.sql);
        } else if (result.view_type === 'table') {
          // Table view: embed in chat, don't change main view
          addBotMessage(result.summary, result.sql, undefined, result.results, result.column_metadata);
        } else {
          // Simple answer: keep current view, show in chat only
          addBotMessage(result.summary, result.sql);
        }
      }
    } catch (error) {
      setIsLoading(false);
      addErrorMessage(error instanceof Error ? error.message : 'Query failed. Please try again.');
    }
  };

  const handleClearHistory = async () => {
    try {
      await fetch('/api/hex-query/clear-history', { method: 'POST' });
      setMessages([messages[0]]); // Keep welcome message
      setHighlightedHexes(new Set());
      setCurrentView(null);
      setQueryResult(null);
      setIsFullWidth(true); // Reset to full-width
      setHasShownMap(false); // Reset map state
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  const handleToggleWidth = () => {
    setIsFullWidth(!isFullWidth);
  };

  return (
    <div className="hex-query-container">
      <ChatSidebar
        messages={messages}
        inputValue={inputValue}
        onInputChange={setInputValue}
        onSubmit={() => handleSubmit()}
        onClearHistory={handleClearHistory}
        onToggleWidth={handleToggleWidth}
        isLoading={isLoading}
        isFullWidth={isFullWidth}
        hasShownMap={hasShownMap}
      />

      {!isFullWidth && (
        <div className="hex-query-content">
          {/* Only mount map when first needed, then keep mounted to avoid WebGL context recreation */}
          {geoJsonData && hasShownMap && (
            <div
              className="hex-query-map-container"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                visibility: currentView === 'map' ? 'visible' : 'hidden',
                pointerEvents: currentView === 'map' ? 'auto' : 'none'
              }}
            >
              <HexMapView
                geoJsonData={geoJsonData}
                highlightedHexes={highlightedHexes}
                prescriptionMaps={prescriptionMaps}
                selectedPrescriptionLayer={selectedPrescriptionLayer}
                onPrescriptionLayerChange={setSelectedPrescriptionLayer}
              />
            </div>
          )}

          {!currentView && (
            <div className="hex-query-empty">
              <div className="hex-query-empty__content">
                <h2>Ask me anything about your fields</h2>
                <p>I'll show you maps or direct answers based on your question.</p>
              </div>
            </div>
          )}
        </div>
      )}

      <style jsx global>{`
        .hex-query-container {
          display: flex;
          height: 100vh;
          overflow: hidden;
        }

        .hex-query-content {
          flex: 1;
          position: relative;
          background: #f9fafb;
          overflow: hidden;
        }

        .hex-query-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: 2rem;
        }

        .hex-query-empty__content {
          text-align: center;
          max-width: 500px;
        }

        .hex-query-empty__content h2 {
          margin: 0 0 1rem 0;
          font-size: 2rem;
          font-weight: 600;
          color: #1f2937;
        }

        .hex-query-empty__content p {
          margin: 0;
          font-size: 1.125rem;
          color: #6b7280;
        }
      `}</style>
    </div>
  );
}

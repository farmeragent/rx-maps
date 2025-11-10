'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
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

const GEOJSON_SOURCES = [
  { path: '/north-of-road-high-res.geojson', fieldName: 'North of Road' },
  { path: '/south-of-road-high-res.geojson', fieldName: 'South of Road' },
  { path: '/railroad-pivot-high-res.geojson', fieldName: 'Railroad Pivot' }
];
const ALL_FIELD_NAMES = GEOJSON_SOURCES.map(source => source.fieldName);

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
  const [visibleFieldNames, setVisibleFieldNames] = useState<Set<string>>(new Set());
  const [hexFieldLookup, setHexFieldLookup] = useState<Record<string, string>>({});
  const [highlightedHexes, setHighlightedHexes] = useState<Set<string>>(new Set());
  const [prescriptionMaps, setPrescriptionMaps] = useState<any[]>([]);
  const [selectedPrescriptionLayer, setSelectedPrescriptionLayer] = useState<string | null>(null);

  // Load GeoJSON data
  useEffect(() => {
    let isMounted = true;

    const loadGeoJson = async () => {
      try {
        console.log('Loading GeoJSON files:', GEOJSON_SOURCES.map(source => source.path));
        const collections = await Promise.all(
          GEOJSON_SOURCES.map(async source => {
            const response = await fetch(source.path);
            if (!response.ok) {
              throw new Error(`Failed to fetch GeoJSON "${source.path}": ${response.status} ${response.statusText}`);
            }
            const collection = await response.json();
            const features = (collection?.features || []).map((feature: any) => ({
              ...feature,
              properties: {
                ...feature.properties,
                field_name: feature?.properties?.field_name || source.fieldName
              }
            }));
            return {
              fieldName: source.fieldName,
              features
            };
          })
        );

        if (!isMounted) {
          return;
        }
        const combinedFeatures = collections.flatMap(({ features }) => features);
        const hexFieldMap: Record<string, string> = {};
        collections.forEach(({ fieldName, features }) => {
          features.forEach((feature: any) => {
            const h3Index = feature?.properties?.h3_index;
            if (h3Index) {
              hexFieldMap[h3Index] = fieldName;
            }
          });
        });

        const combinedGeoJson = {
          type: 'FeatureCollection',
          features: combinedFeatures
        };

        console.log(`Loaded GeoJSON with ${combinedFeatures.length} total features`);
        setGeoJsonData(combinedGeoJson);
        setHexFieldLookup(hexFieldMap);
        setVisibleFieldNames(new Set(ALL_FIELD_NAMES));
      } catch (error) {
        console.error('Failed to load GeoJSON files:', error);
      }
    };

    loadGeoJson();

    return () => {
      isMounted = false;
    };
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

  const determineVisibleFields = (result: QueryResult) => {
    const fieldNames = new Set<string>();

    if (result.field_name) {
      fieldNames.add(result.field_name);
    }

    if (result.hex_ids && result.hex_ids.length > 0) {
      result.hex_ids.forEach(hexId => {
        const fieldName = hexFieldLookup[hexId];
        if (fieldName) {
          fieldNames.add(fieldName);
        }
      });
    }

    return fieldNames;
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
        const targetFieldName = result.field_name || 'North of Road';
        const prescriptionResponse = await fetch('/api/prescription-map', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ field_name: targetFieldName })
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
          setVisibleFieldNames(new Set([targetFieldName]));
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
          } else {
            setHighlightedHexes(new Set());
          }
          const fieldNames = determineVisibleFields(result);
          setVisibleFieldNames(fieldNames.size > 0 ? fieldNames : new Set(ALL_FIELD_NAMES));
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
      setVisibleFieldNames(new Set(ALL_FIELD_NAMES));
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  const handleToggleWidth = () => {
    setIsFullWidth(!isFullWidth);
  };

  const filteredGeoJsonData = useMemo(() => {
    if (!geoJsonData) {
      return null;
    }

    if (!visibleFieldNames || visibleFieldNames.size === 0) {
      return geoJsonData;
    }

    return {
      ...geoJsonData,
      features: geoJsonData.features.filter((feature: any) =>
        visibleFieldNames.has(feature?.properties?.field_name)
      )
    };
  }, [geoJsonData, visibleFieldNames]);

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
          {filteredGeoJsonData && hasShownMap && (
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
                geoJsonData={filteredGeoJsonData}
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

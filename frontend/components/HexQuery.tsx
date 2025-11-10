'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ChatSidebar, { ChatMessageAction } from './ChatSidebar';
import HexMapView from './HexMapView';
import { usePersistentChat } from '../hooks/usePersistentChat';
import { DEFAULT_CHAT_MESSAGES } from '../constants/chat';

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

const API_BASE_URL = '/api/hex-query';

const GEOJSON_SOURCES = [
  { path: '/north-of-road-high-res.geojson', fieldName: 'North of Road' },
  { path: '/south-of-road-high-res.geojson', fieldName: 'South of Road' },
  { path: '/railroad-pivot-high-res.geojson', fieldName: 'Railroad Pivot' }
];
const ALL_FIELD_NAMES = GEOJSON_SOURCES.map(source => source.fieldName);

export default function HexQuery() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuestion = searchParams?.get('question') || '';
  const hasSubmittedInitialQuestion = useRef(false);

  const {
    messages,
    setMessages,
    resetMessages,
    isHydrated: isChatHydrated
  } = usePersistentChat({ initialMessages: DEFAULT_CHAT_MESSAGES });
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentView, setCurrentView] = useState<'map' | 'table' | null>(null);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [hasShownMap, setHasShownMap] = useState(false);
  const [isFullWidth, setIsFullWidth] = useState(true); // Start with full-width chat
  const [pendingAllFieldsPrompt, setPendingAllFieldsPrompt] = useState(false);
  const [lastPrescriptionField, setLastPrescriptionField] = useState<string | null>(null);

  // Map-specific state
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [visibleFieldNames, setVisibleFieldNames] = useState<Set<string>>(new Set());
  const [hexFieldLookup, setHexFieldLookup] = useState<Record<string, string>>({});
  const [highlightedHexes, setHighlightedHexes] = useState<Set<string>>(new Set());
  const [prescriptionMaps, setPrescriptionMaps] = useState<any[]>([]);
  const [selectedPrescriptionLayer, setSelectedPrescriptionLayer] = useState<string | null>(null);
  const [centerField, setCenterField] = useState<string | null>(null);

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
    if (!isChatHydrated || !initialQuestion || hasSubmittedInitialQuestion.current) {
      return;
    }

    hasSubmittedInitialQuestion.current = true;
    setInputValue(initialQuestion);

    const lastMessage = messages[messages.length - 1];
    const skipAddingUserMessage =
      lastMessage?.type === 'user' &&
      lastMessage.text.trim().toLowerCase() === initialQuestion.trim().toLowerCase();

    void handleSubmit(initialQuestion, { skipAddingUserMessage });
  }, [initialQuestion, isChatHydrated, messages, handleSubmit]);

  const addUserMessage = (text: string) => {
    setMessages(prev => [...prev, { type: 'user', text }]);
  };

  const addBotMessage = (
    text: string,
    options?: {
      sql?: string;
      metadata?: string;
      tableData?: any[];
      columnMetadata?: Record<string, { display_name: string; unit?: string }>;
      actions?: ChatMessageAction[];
      actionId?: string;
    }
  ) => {
    setMessages(prev => [
      ...prev,
      {
        type: 'bot',
        text,
        sql: options?.sql,
        metadata: options?.metadata,
        tableData: options?.tableData,
        columnMetadata: options?.columnMetadata,
        actions: options?.actions,
        actionId: options?.actionId
      }
    ]);
  };

  const addErrorMessage = (error: string) => {
    setMessages(prev => [...prev, { type: 'error', text: error }]);
  };

  const clearActionsById = (actionId?: string) => {
    if (!actionId) {
      return;
    }

    setMessages(prev =>
      prev.map(message =>
        message.actionId === actionId ? { ...message, actions: undefined } : message
      )
    );
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

  async function handleSubmit(
    question?: string,
    options?: {
      skipAddingUserMessage?: boolean;
    }
  ) {
    const q = question || inputValue.trim();
    if (!q || isLoading) return;

    setInputValue('');
    if (!options?.skipAddingUserMessage) {
      addUserMessage(q);
    }
    setIsLoading(true);
    setPendingAllFieldsPrompt(false);
    clearActionsById('all-fields-prompt');

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

        setLastPrescriptionField(targetFieldName);
        setPendingAllFieldsPrompt(false);

        // Add success message
        const passCount = prescriptionData.prescription_maps?.length || 0;
        addBotMessage(
          `✓ Created ${passCount} prescription passes for ${prescriptionData.summary?.field_name || 'the field'}:\n` +
            prescriptionData.prescription_maps
              .map(
                (pm: any) =>
                  `• ${pm.pass}: ${pm.geojson.features[0].properties.rate} ${pm.geojson.features[0].properties.unit}`
              )
              .join('\n')
        );

        addBotMessage('Would you like me to create prescription maps for all fields as well?', {
          actions: [
            { label: 'Yes, include all fields', value: 'generate_all_prescriptions', variant: 'primary' },
            { label: 'No, just this field', value: 'skip_generate_all', variant: 'secondary' }
          ],
          actionId: 'all-fields-prompt'
        });
        setPendingAllFieldsPrompt(true);
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
          addBotMessage(result.summary, { sql: result.sql });
        } else if (result.view_type === 'table') {
          // Table view: embed in chat, don't change main view
      addBotMessage(result.summary, {
        sql: result.sql,
        tableData: result.results,
        columnMetadata: result.column_metadata
      });
        } else {
          // Simple answer: keep current view, show in chat only
          addBotMessage(result.summary, { sql: result.sql });
        }
      }
    } catch (error) {
      setIsLoading(false);
      addErrorMessage(error instanceof Error ? error.message : 'Query failed. Please try again.');
    }
  }

  const handleClearHistory = async () => {
    try {
      await fetch('/api/hex-query/clear-history', { method: 'POST' });
      resetMessages(); // Keep welcome message
      setHighlightedHexes(new Set());
      setCurrentView(null);
      setQueryResult(null);
      setIsFullWidth(true); // Reset to full-width
      setHasShownMap(false); // Reset map state
      setVisibleFieldNames(new Set(ALL_FIELD_NAMES));
      setPendingAllFieldsPrompt(false);
      setLastPrescriptionField(null);
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  const handleToggleWidth = () => {
    setIsFullWidth(!isFullWidth);
  };

  const handleGenerateAllFields = async () => {
    setIsLoading(true);
    setPendingAllFieldsPrompt(false);

    try {
      addUserMessage('Yes, include all fields.');

      const tableRows: Array<Record<string, number | string>> = [];
      const nutrientUnits: Record<'nitrogen' | 'phosphorus' | 'potassium', string | undefined> = {
        nitrogen: undefined,
        phosphorus: undefined,
        potassium: undefined
      };

      for (const fieldName of ALL_FIELD_NAMES) {
        const response = await fetch('/api/prescription-map', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ field_name: fieldName })
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.detail || `Failed to create prescription maps for ${fieldName}`);
        }

        const data = await response.json();
        const row: Record<string, number | string> = {
          field: data.summary?.field_name || fieldName,
          nitrogen: '',
          phosphorus: '',
          potassium: ''
        };

        const passes: any[] = data.prescription_maps || [];
        passes.forEach((pm: any) => {
          const passName = typeof pm.pass === 'string' ? pm.pass.toLowerCase() : '';
          const feature = pm.geojson?.features?.[0];
          const rate = feature?.properties?.rate ?? null;
          const unit = feature?.properties?.unit;

          if (passName.includes('nitrogen')) {
            row.nitrogen = rate ?? '';
            nutrientUnits.nitrogen = nutrientUnits.nitrogen || unit;
          } else if (passName.includes('phosphorus')) {
            row.phosphorus = rate ?? '';
            nutrientUnits.phosphorus = nutrientUnits.phosphorus || unit;
          } else if (passName.includes('potassium')) {
            row.potassium = rate ?? '';
            nutrientUnits.potassium = nutrientUnits.potassium || unit;
          }
        });

        tableRows.push(row);
      }

      const columnMetadata = {
        field: { display_name: 'Field' },
        nitrogen: {
          display_name: 'Nitrogen',
          unit: nutrientUnits.nitrogen
        },
        phosphorus: {
          display_name: 'Phosphorus',
          unit: nutrientUnits.phosphorus
        },
        potassium: {
          display_name: 'Potassium',
          unit: nutrientUnits.potassium
        }
      };

      addBotMessage('Here is the nutrient plan for all fields:', {
        tableData: tableRows,
        columnMetadata,
        actions: [
          {
            label: 'Open Field Management Dashboard',
            value: 'open_dashboard',
            variant: 'primary'
          }
        ],
        actionId: 'dashboard-link'
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to generate prescriptions for all fields.';
      addErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMessageAction = async (value: string, actionId?: string) => {
    if (actionId && actionId !== 'dashboard-link') {
      clearActionsById(actionId);
    }

    // Handle view field action
    if (value.startsWith('view_field:')) {
      const fieldName = value.replace('view_field:', '');
      setVisibleFieldNames(new Set([fieldName]));
      setHighlightedHexes(new Set()); // Clear hex highlights
      setPrescriptionMaps([]); // Clear prescription maps
      setSelectedPrescriptionLayer(null); // Clear prescription layer
      setCurrentView('map');
      setHasShownMap(true);
      setIsFullWidth(false); // Switch to sidebar mode
      setCenterField(fieldName); // Trigger map to center on this field
      return;
    }

    if (value === 'generate_all_prescriptions') {
      if (!pendingAllFieldsPrompt) {
        return;
      }
      await handleGenerateAllFields();
    } else if (value === 'skip_generate_all') {
      setPendingAllFieldsPrompt(false);
      const fieldLabel = lastPrescriptionField ? ` for ${lastPrescriptionField}` : '';
      addUserMessage('No, just this field.');
      addBotMessage(`Okay, I'll stick with the maps${fieldLabel}. Let me know if you need anything else.`);
    } else if (value === 'open_dashboard') {
      router.push('/dashboard');
    }
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
        onAction={handleMessageAction}
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
                centerField={centerField}
                onCenterFieldComplete={() => setCenterField(null)}
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

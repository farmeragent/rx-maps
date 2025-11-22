"use client";
import "@copilotkit/react-ui/styles.css";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { useCoAgent, useCopilotChat } from "@copilotkit/react-core";
import { TextMessage, MessageRole } from "@copilotkit/runtime-client-gql";
import { useEffect, useState } from "react";
import HexMapView from "./_components/hex-map-view";
import ScatterPlot from "./_components/scatter-plot";
import Table from "./_components/table";
import { Homepage } from "./_components/homepage";
import { useSqlExecutionResult, ViewType, ScatterPlotData } from "./_lib/useSqlExecutionResult";

interface LastQueryDisplayProps {
  lastToolCall: { sql: string } | null;
}

const processTableData = (data: Record<string, number[]>): Record<string, any>[] => {
  const columns = Object.keys(data);
  const rowCount = columns.length > 0 ? data[columns[0]]?.length || 0 : 0;
  const rows: Record<string, any>[] = [];

  for (let i = 0; i < rowCount; i++) {
    const row: Record<string, any> = {};
    columns.forEach(col => {
      row[col] = data[col][i];
    });
    rows.push(row);
  }

  return rows;
};

const LastQueryDisplay = ({ lastToolCall }: LastQueryDisplayProps) => {
  if (!lastToolCall) return null;

  return (
    <div style={{
      marginTop: '1rem',
      padding: '1rem',
      backgroundColor: '#f0f0f0',
      borderRadius: '4px',
      fontFamily: 'monospace',
      fontSize: '0.9em'
    }}>
      <strong>Last Query:</strong><br />
      {lastToolCall.sql}
    </div>
  );
};

// Component to send initial message after mount
const InitialMessageSender = ({ message, onSent }: { message: string; onSent: () => void }) => {
  const chat = useCopilotChat();

  useEffect(() => {
    if (message && chat.appendMessage) {
      const textMessage = new TextMessage({
        id: Date.now().toString(),
        role: MessageRole.User,
        content: message,
      });
      chat.appendMessage(textMessage);
      onSent();
    }
  }, [message, chat, onSent]);

  return null;
};

const ToolView = ({ sidebarOpen, initialMessage, onInitialMessageSent }: {
  sidebarOpen: boolean;
  initialMessage: string | null;
  onInitialMessageSent: () => void;
}) => {
  const [view, setView] = useState<ViewType>(ViewType.MAP);
  const [lastToolCall, setLastToolCall] = useState<{ sql: string } | null>(null);
  const [scatterPlotData, setScatterPlotData] = useState<ScatterPlotData | null>(null);
  const [tableData, setTableData] = useState<any[] | null>(null);
  const [mapData, setMapData] = useState<any>(null);
  const [geoJsonData, setGeoJsonData] = useState<any>(null);

  // Load default GeoJSON data on mount
  useEffect(() => {
    const loadGeoJson = async () => {
      try {
        const response = await fetch('/north-of-road-high-res.geojson');
        if (!response.ok) {
          throw new Error(`Failed to fetch GeoJSON: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        console.log('✅ Loaded default GeoJSON:', data);
        setGeoJsonData(data);
      } catch (error) {
        console.error('❌ Failed to load GeoJSON:', error);
      }
    };

    loadGeoJson();
  }, []);


  const { state } = useCoAgent({
    name: "root_agent"
  });
  console.log("STATE:", state);
  const data = state.data;
  const expected_answer_type = state.expected_answer_type;

  if (data && expected_answer_type && view !== expected_answer_type) {
    const viewType = expected_answer_type.toUpperCase() as ViewType;
    setView(viewType);
    switch (viewType) {
      case ViewType.TABLE: {
        // Convert column-oriented to row-oriented for table display
        const rows = processTableData(data as Record<string, number[]>);
        console.log("📋 Setting table data:", rows);
        setTableData(rows);
        break;
      }

      case ViewType.SCATTERPLOT: {
        // For scatter plot, data should already be in the right format
        // Assuming data has x and y columns
        const columns = Object.keys(data);
        if (columns.length >= 2) {
          const scatterData: ScatterPlotData = {
            data: data as Record<string, number[]>,
            x_column: columns[0],
            y_column: columns[1],
            title: "Scatter Plot",
            x_label: columns[0],
            y_label: columns[1],
          };
          console.log("📈 Setting scatter plot data:", scatterData);
          setScatterPlotData(scatterData);
        }
        break;
      }

      case ViewType.MAP: {
        // For map view, store the data for HexMapView
        console.log("🗺️ Setting map data:", data);
        setMapData(data);
        break;
      } 
      default:
        console.warn("Unknown expected_answer_type:", expected_answer_type);
    }
  
}

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      {initialMessage && (
        <InitialMessageSender message={initialMessage} onSent={onInitialMessageSent} />
      )}
      {/* Main content area - marginRight accounts for fixed sidebar */}
      <div style={{ flex: 1, overflow: 'auto', padding: '2rem', marginRight: sidebarOpen ? '450px' : '0' }}>
        {(() => {
          switch (view) {
            case ViewType.HOME:
              return (
                <div>
                  <h1>Farm Pulse Home Page</h1>
                  <p>Ask me about your agricultural data using the sidebar.</p>
                  <div style={{ marginTop: '2rem' }}>
                    <h3>Try asking:</h3>
                    <ul>
                      <li>"Show me areas of low phosphorus in the north-of-road field"</li>
                      <li>"What is the average yield target?"</li>
                      <li>"Compare nutrient levels across fields"</li>
                    </ul>
                  </div>
                </div>
              );

            case ViewType.MAP:
              return (
                <div>
                  <h1>Map View</h1>
                  <LastQueryDisplay lastToolCall={lastToolCall} />
                  <div style={{ marginTop: '2rem', height: 'calc(100vh - 300px)', minHeight: '600px' }}>
                    <HexMapView
                      geoJsonData={geoJsonData}
                      highlightedHexes={mapData?.h3_index ? new Set(mapData.h3_index) : new Set<string>()}
                      prescriptionMaps={[]}
                      selectedPrescriptionLayer={null}
                      onPrescriptionLayerChange={(layer: string | null) => {
                        // TODO: Implement prescription layer change handler
                      }}
                      centerField={null}
                      onCenterFieldComplete={() => {
                        // TODO: Implement center field complete handler
                      }}
                    />
                  </div>
                </div>
              );

            case ViewType.SCATTERPLOT:
              return (
                <div>
                  <h1>Chart View</h1>
                  <LastQueryDisplay lastToolCall={lastToolCall} />
                  <div style={{ marginTop: '2rem', height: 'calc(100vh - 300px)', minHeight: '600px' }}>
                    {scatterPlotData ? (
                      <ScatterPlot plotData={scatterPlotData} />
                    ) : (
                      <p>No chart data available. Please execute a query that returns scatter plot data.</p>
                    )}
                  </div>
                </div>
              );

            case ViewType.TABLE:
              return (
                <div>
                  <h1>Table View</h1>
                  <LastQueryDisplay lastToolCall={lastToolCall} />
                  <div style={{ marginTop: '2rem' }}>
                    <Table data={tableData || []} />
                  </div>
                </div>
              );

            default:
              return null;
          }
        })()}
      </div>
    </div>
  );
};

function MainApp() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showHomepage, setShowHomepage] = useState(true);
  const [initialMessage, setInitialMessage] = useState<string | null>(null);

  const handleHomepageSubmit = (question: string) => {
    // Store the message to be sent after transition
    setInitialMessage(question);
    // Open sidebar and transition away from homepage
    setSidebarOpen(true);
    setShowHomepage(false);
  };

  return (
    <CopilotSidebar
      key={showHomepage ? 'homepage' : 'toolview'}
      defaultOpen={!showHomepage}
      clickOutsideToClose={false}
      onSetOpen={(open) => {
        setSidebarOpen(open);
        if (open && showHomepage) setShowHomepage(false);
      }}
      labels={{
        title: "Farm Pulse Assistant",
        initial: "Hi! How can I help?",
      }}
      suggestions={showHomepage ? [] : [
        {
          title: "Low P NoR",
          message: "Show me areas of low phosphorus in the north-of-road field",
        },
        {
          title: "Ca vs CEC",
          message: "Plot calcium vs cec",
        },
        {
          title: "Fields",
          message: "Can you show me a table of all my fields?",
        },
      ]}
    >
      {showHomepage ? (
        <Homepage onSubmit={handleHomepageSubmit} />
      ) : (
        <ToolView
          sidebarOpen={sidebarOpen}
          initialMessage={initialMessage}
          onInitialMessageSent={() => setInitialMessage(null)}
        />
      )}
    </CopilotSidebar>
  );
}

export default function FarmPulse() {
  return <MainApp />;
}
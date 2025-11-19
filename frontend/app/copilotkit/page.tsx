"use client";
import "@copilotkit/react-ui/styles.css";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { useFrontendTool } from "@copilotkit/react-core";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import HexMapView from "../hex-query/_components/hex-map-view";
import ScatterPlot from "../hex-query/_components/scatter-plot";

// Dynamically import HexQuery to avoid SSR issues
const HexQuery = dynamic(() => import('../hex-query/_components/hex-query'), {
  ssr: false,
  loading: () => <div>Loading map view...</div>
});

enum ViewType {
  HOME = 'home',
  MAP = 'map',
  CHART = 'chart',
  TABLE = 'table'
}


interface ScatterPlotData {
  data: Record<string, number[]>;
  x_column: string;
  y_column: string;
  title?: string;
  x_label?: string;
  y_label?: string;
}

interface LastQueryDisplayProps {
  lastToolCall: { sql: string } | null;
}

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

const ToolView = () => {
  const [currentView, setCurrentView] = useState<ViewType>(ViewType.HOME);
  const [lastToolCall, setLastToolCall] = useState<{sql: string} | null>(null);
  const [scatterPlotData, setScatterPlotData] = useState<ScatterPlotData | null>(null);
  const [tableData, setTableData] = useState<any[] | null>(null);


  useEffect(() => {
    console.log("CURRENT VIEW:", currentView);
  }, [currentView]);


  // Receive SQL query generation results from backend
  useFrontendTool({
    name: "receive_sql_query_result",
    description: "Receive the generated SQL query result from generate_SQL_query. Call this after generating a SQL query to pass the results to the frontend.",
    parameters: [
      {
        name: "status",
        type: "string",
        description: "Status of SQL generation (SUCCESS or ERROR)",
        required: true,
      },
      {
        name: "sql_query",
        type: "string",
        description: "The generated SQL query",
        required: false,
      },
      {
        name: "sql_summary",
        type: "string",
        description: "Natural language explanation of the query",
        required: false,
      },
      {
        name: "expected_answer_type",
        type: "string",
        description: "Expected visualization type: MAP, TABLE, or SCATTERPLOT",
        required: false,
      },
      {
        name: "error_details",
        type: "string",
        description: "Error details if status is ERROR",
        required: false,
      },
    ],
    handler: async ({ status, sql_query, sql_summary, expected_answer_type, error_details }) => {
        console.log("📊 Received SQL query result:", {
          status,
          sql_query,
          sql_summary,
          expected_answer_type,
          error_details
        });

        if (status === "SUCCESS" && sql_query) {
          // Store the SQL query
          setLastToolCall({ sql: sql_query });

          // Switch view based on expected answer type
          switch (expected_answer_type) {
            case "MAP":
              setCurrentView(ViewType.MAP);
              break;
            case "TABLE":
              setCurrentView(ViewType.TABLE);
              break;
            case "SCATTERPLOT":
              setCurrentView(ViewType.CHART);
              break;
            default:
              console.log("Unknown answer type:", expected_answer_type);
          }
        } else if (status === "ERROR") {
          console.error("SQL generation failed:", error_details);
          // Optionally show error to user
        }

        return { received: true };
    },
  });

//   useFrontendTool({
//     name: "switch_views",
//     description: "Switch to a different view of the application.",
//     parameters: [
//       {
//         name: "view",
//         type: "string",
//         description: "The view to switch to",
//         required: true,
//       },
//     ],
//     handler: async ({ view }) => {
//         console.log(view);
//         console.log("How is this going to work?")
//       setCurrentView(view as ViewType);
//     },
//   });


//   useFrontendTool({
//     name: "display_sql_query_result",
//     description: "Display SQL query results in the hex query view. Use this tool after executing a SQL query to show the results on the map visualization. This switches the UI to show the query results.",
//     parameters: [
//       {
//         name: "sql",
//         type: "string",
//         description: "The SQL query that was executed",
//         required: true,
//       },
//     ],
//     handler: async ({ sql }) => {
//         console.log("🔧 HANDLER called with SQL:", sql);
//         // Use setTimeout to defer state update to next tick
//         setTimeout(() => {
//           console.log("⚡ Switching to map view");
//           setCurrentView(ViewType.MAP);
//           setLastToolCall({ sql });
//         }, 0);
//         return { sql };
//     },
//     render: ({args, status, result}) => {
//         console.log("🎨 RENDER called - Status:", status, "Args:", args, "Result:", result);

//         return "";
//     },
//   }, []); // Empty dependency array to ensure it's registered once

//   useFrontendTool({
//     name: "display_scatter_plot_result",
//     description: "Display data from sql query in a scatter plot format.",
//     parameters: [
//       {
//         name: "sql",
//         type: "string",
//         description: "The SQL query that was executed",
//         required: true,
//       },
//     ],
//     handler: async ({ sql }) => {
//         console.log("🔧 HANDLER called with:", sql);
//         // Use setTimeout to defer state update to next tick
//         setTimeout(() => {
//           console.log("⚡ Switching to map view");
//           setCurrentView(ViewType.TABLE);
         
//         }, 0);
//         return { sql };
//     },
//     render: ({args, status, result}) => {
//         console.log("🎨 Display scatter plot results:", status, "Args:", args, "Result:", result);

//         return "";
//     },
//   }, []); // Empty dependency array to ensure it's registered once

  // Test tool to verify frontend tools are working
//   useFrontendTool({
//     name: "test_tool",
//     description: "A simple test tool to verify frontend tools are working. Always call this tool first to test if frontend tools are working.",
//     parameters: [],
//     handler: async () => {
//       console.log("✅ TEST TOOL HANDLER CALLED - Frontend tools are working!");
//       alert("Frontend tools are working! The test tool was called successfully.");
//       return { success: true };
//     },
//   }, []);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      {/* Main content area */}
      <div style={{ flex: 1, overflow: 'auto', padding: '2rem' }}>
        {(() => {
          switch (currentView) {
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
                      geoJsonData={undefined} 
                      highlightedHexes={new Set<string>()} 
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

            case ViewType.CHART:
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
                  <div style={{ marginTop: '2rem', overflow: 'auto' }}>
                    {tableData && tableData.length > 0 ? (
                      <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        backgroundColor: '#fff',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f5f5f5' }}>
                            {Object.keys(tableData[0]).map((key) => (
                              <th key={key} style={{
                                padding: '12px',
                                textAlign: 'left',
                                borderBottom: '2px solid #ddd',
                                fontWeight: '600'
                              }}>
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tableData.map((row, index) => (
                            <tr key={index} style={{
                              borderBottom: '1px solid #eee'
                            }}>
                              {Object.values(row).map((value: any, cellIndex) => (
                                <td key={cellIndex} style={{
                                  padding: '12px',
                                  borderRight: '1px solid #eee'
                                }}>
                                  {value !== null && value !== undefined ? String(value) : '-'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div style={{ 
                        padding: '2rem',
                        textAlign: 'center',
                        color: '#666'
                      }}>
                        <p>No table data available. Please execute a query that returns table data.</p>
                      </div>
                    )}
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

export default function YourApp() {
  return (<><ToolView /><CopilotSidebar
      defaultOpen={true}
      labels={{
          title: "Farm Pulse Assistant",
          initial: "Hi! How can I help?",
      }}
      suggestions={[
          {
              title: "Low P NoR",
              message: "Show me areas of low phosphorus in the north-of-road field",
          },
      ]} /></>);
      
}
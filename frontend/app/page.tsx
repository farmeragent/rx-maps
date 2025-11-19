"use client";
import "@copilotkit/react-ui/styles.css";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { useFrontendTool } from "@copilotkit/react-core";
import { useEffect, useState } from "react";
import HexMapView from "./_components/hex-map-view";
import ScatterPlot from "./_components/scatter-plot";
import Table from "./_components/table";



enum ViewType {
  HOME = 'HOME',
  MAP = 'MAP',
  SCATTERPLOT = 'SCATTERPLOT',
  TABLE = 'TABLE'
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
  const [view, setView] = useState<ViewType>(ViewType.HOME);
  const [lastToolCall, setLastToolCall] = useState<{sql: string} | null>(null);
  const [scatterPlotData, setScatterPlotData] = useState<ScatterPlotData | null>(null);
  const [tableData, setTableData] = useState<any[] | null>(null);
  const [mapData, setMapData] = useState<any>(null);


  useEffect(() => {
    console.log("CURRENT VIEW:", view);
  }, [view]);

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
              setView(ViewType.MAP);
              break;
            case "TABLE":
              setView(ViewType.TABLE);
              break;
            case "SCATTERPLOT":
              setView(ViewType.SCATTERPLOT);
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

  // (Ojas) -> This will be our primary function, but it is currently too slow because it pulls alot of data
  // DO NOT DELETE 
  // Receive SQL query execution results (the actual data) from backend
//   useFrontendTool({
//     name: "receive_sql_execution_result",
//     description: "Receive the actual data results from execute_SQL_query. Call this after executing a SQL query to display the data in the frontend. The data should be in column-oriented format (e.g., {\"column1\": [val1, val2], \"column2\": [val3, val4]}).",
//     parameters: [
//       {
//         name: "status",
//         type: "string",
//         description: "Status of SQL execution (SUCCESS or ERROR)",
//         required: true,
//       },
//       {
//         name: "data",
//         type: "object",
//         description: "Column-oriented data from the query result. Keys are column names, values are arrays of values.",
//         required: false,
//       },
//       {
//         name: "row_count",
//         type: "number",
//         description: "Number of rows returned",
//         required: false,
//       },
//       {
//         name: "acres",
//         type: "number",
//         description: "Total acres if area column exists",
//         required: false,
//       },
//       {
//         name: "expected_answer_type",
//         type: "string",
//         description: "Expected visualization type: MAP, TABLE, or SCATTERPLOT",
//         required: false,
//       },
//       {
//         name: "sql",
//         type: "string",
//         description: "The SQL query that was executed",
//         required: false,
//       },
//       {
//         name: "error_details",
//         type: "string",
//         description: "Error details if status is ERROR",
//         required: false,
//       },
//     ],
//     handler: async ({ status, data, row_count, acres, expected_answer_type, sql, error_details }) => {
//         console.log("📊 Received SQL execution result:", {
//           status,
//           data,
//           row_count,
//           acres,
//           expected_answer_type,
//           sql,
//           error_details
//         });

//         setView(expected_answer_type as ViewType);
//         if (status === "SUCCESS" && data) {
//           // Convert column-oriented data to the appropriate format based on visualization type
          
//           if (expected_answer_type === "TABLE") {
//             // Convert column-oriented to row-oriented for table display
//             const columns = Object.keys(data);
//             const rowCount = (data as Record<string, number[]>)[columns[0]]?.length || 0;
//             const rows = [];

//             for (let i = 0; i < rowCount; i++) {
//               const row: any = {};
//               columns.forEach(col => {
//                 row[col] = (data as Record<string, number[]>)[col][i];
//               });
//               rows.push(row);
//             }

//             console.log("📋 Setting table data:", rows);
//             setTableData(rows);
//           }
//           else if (expected_answer_type === "SCATTERPLOT") {
//             // For scatter plot, data should already be in the right format
//             // Assuming data has x and y columns
//             const columns = Object.keys(data);
//             if (columns.length >= 2) {
//               const scatterData: ScatterPlotData = {
//                 data: data as Record<string, number[]>,
//                 x_column: columns[0],
//                 y_column: columns[1],
//                 title: "Scatter Plot",
//                 x_label: columns[0],
//                 y_label: columns[1],
//               };
//               console.log("📈 Setting scatter plot data:", scatterData);
//               setScatterPlotData(scatterData);
//             }
//           }
//           else if (expected_answer_type === "MAP") {
//             // For map view, store the data for HexMapView
//             console.log("🗺️ Setting map data:", data);
//             setMapData(data);
//           }

//           console.log(`✅ Processed ${row_count} rows${acres ? ` (${acres.toFixed(2)} acres)` : ''}`);
//         } else if (status === "ERROR") {
//           console.error("SQL execution failed:", error_details);
//         }

//         return { received: true };
//     },
//   });


  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      {/* Main content area */}
      <div style={{ flex: 1, overflow: 'auto', padding: '2rem' }}>
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

export default function FarmPulse() {
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
          {
            title: "Ca vs CEC",
            message: "What is the relationship between calcium and CEC?",
          },
          {
            title: "Fields",
            message: "Can you show me a table of all my fields?",
          },
      ]} /></>);

}
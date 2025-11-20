import { useFrontendTool } from "@copilotkit/react-core";
import { Dispatch, SetStateAction } from "react";

export enum ViewType {
  HOME = 'HOME',
  MAP = 'MAP',
  SCATTERPLOT = 'SCATTERPLOT',
  TABLE = 'TABLE'
}

export interface ScatterPlotData {
  data: Record<string, number[]>;
  x_column: string;
  y_column: string;
  title?: string;
  x_label?: string;
  y_label?: string;
}

interface SqlExecutionResultParams {
  setLastToolCall: Dispatch<SetStateAction<{ sql: string } | null>>;
  setView: Dispatch<SetStateAction<ViewType>>;
  setTableData: Dispatch<SetStateAction<any[] | null>>;
  setScatterPlotData: Dispatch<SetStateAction<ScatterPlotData | null>>;
  setMapData: Dispatch<SetStateAction<any>>;
  processTableData: (data: Record<string, number[]>) => Record<string, any>[];
}

export function useSqlExecutionResult({
  setLastToolCall,
  setView,
  setTableData,
  setScatterPlotData,
  setMapData,
  processTableData,
}: SqlExecutionResultParams) {
  useFrontendTool({
    name: "receive_sql_execution_result",
    description: "Receive the actual data results from generate_sql_and_query_database. Call this after executing a SQL query to display the data in the frontend. The data should be in column-oriented format (e.g., {\"column1\": [val1, val2], \"column2\": [val3, val4]}).",
    available: "disabled",
    parameters: [
      {
        name: "status",
        type: "string",
        description: "Status of SQL execution (SUCCESS or ERROR)",
        required: true,
      },
      {
        name: "data",
        type: "object",
        description: "Column-oriented data from the query result. Keys are column names, values are arrays of values.",
        required: true,
      },
      {
        name: "row_count",
        type: "number",
        description: "Number of rows returned",
        required: false,
      },
      {
        name: "acres",
        type: "number",
        description: "Total acres if area column exists",
        required: false,
      },
      {
        name: "expected_answer_type",
        type: "string",
        description: "Expected visualization type: MAP, TABLE, or SCATTERPLOT",
        required: false,
      },
      {
        name: "sql",
        type: "string",
        description: "The SQL query that was executed",
        required: false,
      },
      {
        name: "error_details",
        type: "string",
        description: "Error details if status is ERROR",
        required: false,
      },
    ],
    handler: async ({ status, data, row_count, acres, expected_answer_type, sql, error_details }) => {
      console.log("📊 Received SQL execution result:", {
        status,
        data,
        row_count,
        acres,
        expected_answer_type,
        sql,
        error_details
      });

      if (sql) {
        setLastToolCall({ sql });
      }

      if (status === "SUCCESS" && data && expected_answer_type) {
        // Convert column-oriented data to the appropriate format based on visualization type
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

        console.log(`✅ Processed ${row_count} rows${acres ? ` (${acres.toFixed(2)} acres)` : ''}`);
      } else if (status === "ERROR") {
        console.error("SQL execution failed:", error_details);
      }

      return { received: true };
    },
  });
}


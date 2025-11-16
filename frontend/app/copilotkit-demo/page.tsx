"use client";

import { CopilotKit } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";

export default function CopilotKitDemo() {
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{
        padding: "1rem 2rem",
        borderBottom: "1px solid #e0e0e0",
        backgroundColor: "#fff"
      }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 600 }}>
          Farm Pulse CopilotKit Demo
        </h1>
        <p style={{ margin: "0.5rem 0 0 0", color: "#666", fontSize: "0.875rem" }}>
          Chat with your agricultural data using CopilotKit + AG-UI
        </p>
      </div>

      {/* CopilotKit Provider + Sidebar */}
      <CopilotKit
        runtimeUrl="/api/copilotkit"
        agent="root_agent"
      >
        <CopilotSidebar
          defaultOpen={true}
          labels={{
            title: "Farm Pulse Assistant",
            initial: "Hello! I can help you query agricultural data. Try asking:\n\n• Show me areas of low phosphorus in the north-of-road field\n• What is the average yield target?\n• Compare nutrient levels across fields",
          }}
        >
          {/* Main Content Area */}
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            backgroundColor: "#f9fafb"
          }}>
            <div style={{
              maxWidth: "600px",
              textAlign: "center"
            }}>
              <h2 style={{ fontSize: "2rem", marginBottom: "1rem", color: "#111" }}>
                Chat with Your Agricultural Database
              </h2>
              <p style={{ fontSize: "1.125rem", color: "#666", lineHeight: 1.6 }}>
                This demo uses <strong>CopilotKit</strong> connected to your ADK agent via the <strong>AG-UI protocol</strong>.
              </p>
              <p style={{ fontSize: "1rem", color: "#888", marginTop: "1.5rem" }}>
                Open the sidebar on the right to start chatting with the agent.
              </p>

              <div style={{
                marginTop: "2rem",
                padding: "1.5rem",
                backgroundColor: "#fff",
                borderRadius: "8px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                textAlign: "left"
              }}>
                <h3 style={{ fontSize: "1rem", marginBottom: "0.75rem", color: "#111" }}>
                  Features:
                </h3>
                <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#666" }}>
                  <li>Real-time streaming responses</li>
                  <li>SQL query generation and execution</li>
                  <li>Natural language to BigQuery</li>
                  <li>Tool execution visualization</li>
                </ul>
              </div>

              <div style={{
                marginTop: "1.5rem",
                padding: "1rem",
                backgroundColor: "#eff6ff",
                border: "1px solid #dbeafe",
                borderRadius: "6px",
                fontSize: "0.875rem",
                color: "#1e40af"
              }}>
                <strong>Architecture:</strong><br />
                CopilotKit (GraphQL) → Next.js Runtime (<code>/api/copilotkit</code>) → AG-UI (<code>:8001</code>) → ADK Agent
              </div>
            </div>
          </div>
        </CopilotSidebar>
      </CopilotKit>
    </div>
  );
}

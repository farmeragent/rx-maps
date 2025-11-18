import { HttpAgent } from "@ag-ui/client";
import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";

import { NextRequest } from "next/server";

/**
 * CopilotKit Runtime API Route
 *
 * This route acts as a GraphQL bridge between the CopilotKit frontend
 * and the AG-UI backend running on port 8001.
 *
 * Architecture:
 * Frontend (CopilotKit React) → This Next.js API Route (GraphQL) → AG-UI Backend (port 8001)
 */
const serviceAdapter = new ExperimentalEmptyAdapter();


const runtime = new CopilotRuntime({
  agents: {
    // Our AG-UI endpoint URL
    "root_agent": new HttpAgent({ url: "http://127.0.0.1:8001/" }),
  }
});


export async function POST(req: NextRequest) {
  // Create HttpAgent instance that connects to our AG-UI backend
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });

  return await handleRequest(req);
}

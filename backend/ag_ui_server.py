"""
AG-UI FastAPI Server for CopilotKit Demo
Exposes the root_agent via AG-UI protocol for use with CopilotKit frontend
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from ag_ui_adk import ADKAgent, add_adk_fastapi_endpoint
from agents.agent import root_agent
from dotenv import load_dotenv
import os
import json

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="Farm Pulse AG-UI Server",
    description="ADK agent exposed via AG-UI protocol",
    version="1.0.0"
)

# Add logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    if request.url.path == "/":
        body = await request.body()
        print(f"\n🔍 Incoming request to /:")
        print(f"   Method: {request.method}")
        print(f"   Headers: {dict(request.headers)}")
        print(f"   Body: {body.decode() if body else 'empty'}")
    response = await call_next(request)
    if request.url.path == "/":
        print(f"   Response status: {response.status_code}")
    return response

# Add CORS middleware for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create the AG-UI middleware wrapper for the ADK agent
adk_agent = ADKAgent(
    adk_agent=root_agent,
    app_name="agricultural_query_agent",
    user_id="copilotkit_demo_user"
)

# Add the AG-UI endpoint to FastAPI
# This creates a /copilot endpoint that CopilotKit can connect to
add_adk_fastapi_endpoint(
    app=app,
    agent=adk_agent,
    path="/"
)

@app.get("/")
async def root():
    """Root endpoint with server info"""
    return {
        "name": "Farm Pulse AG-UI Server",
        "version": "1.0.0",
        "description": "ADK agent exposed via AG-UI protocol",
        "agent": {
            "name": root_agent.name,
            "description": root_agent.description
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "ag-ui-server"
    }

# ============================================================================
# SERVER STARTUP
# ============================================================================

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("AG_UI_PORT", "8001"))

    print("\n" + "=" * 80)
    print("🚀 Starting Farm Pulse AG-UI Server")
    print("=" * 80)
    print(f"\n📍 Server running at: http://localhost:{port}")
    print(f"\n🔧 AG-UI endpoint:")
    print(f"   • POST http://localhost:{port}/copilot (for CopilotKit)")
    print(f"\n🤖 Agent: {root_agent.name}")
    print(f"   Description: {root_agent.description}")
    print(f"\n✓ Ready for CopilotKit frontend integration!")
    print("\n" + "=" * 80 + "\n")

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info"
    )

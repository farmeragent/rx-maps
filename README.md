# Farm Pulse

Agricultural database query system powered by AI agents and BigQuery.

## Prerequisites

- Python 3.13+
- Google Cloud Project with BigQuery enabled
- Google Gemini API key

## Setup

### 1. Install Dependencies

```bash
# Create and activate virtual environment
python3 -m venv data/venv
source data/venv/bin/activate

# Install Python packages
pip install -r requirements.txt
```

### 2. Configure Environment Variables

Create a `.env` file in the `backend/` directory with the following variables:

#### Required Variables

```bash
# Google Gemini API Key (required for AI agent)
GOOGLE_API_KEY=your_google_gemini_api_key_here

# Google Cloud Configuration (required for BigQuery)
GOOGLE_PROJECT_ID=your_google_project_id
BQ_DATASET_ID=your_bigquery_dataset_id
```

#### Optional Variables

```bash
# Mapbox Configuration (for satellite imagery)
MAPBOX_TOKEN=your_mapbox_token  # Get free token at https://mapbox.com

# Server Port
AG_UI_PORT=8001  # AG-UI server port (default: 8001)
```

## Running the Server

The AG-UI server exposes the ADK agent via the AG-UI protocol for integration with CopilotKit and other frontends.

```bash
cd backend
source ../data/venv/bin/activate
python ag_ui_server.py
```

The server will start on port 8001 (configurable via `AG_UI_PORT` environment variable).

### Available Endpoints

- **POST** `http://localhost:8001/copilot` - AG-UI endpoint for CopilotKit integration
- **GET** `http://localhost:8001/` - Server info and available endpoints

## How It Works

### Architecture

```
Frontend (CopilotKit React)
    ↓ GraphQL requests
Next.js API Route (/api/copilotkit)
    ↓ HttpAgent (AG-UI protocol)
AG-UI Backend (ag_ui_server.py:8001)
    ↓ ADK Runner
ADK Agent (BigQuery tools)
```

### Query Flow

1. **User submits a query** via CopilotKit UI (e.g., "Show me areas with low phosphorus")
2. **Next.js runtime** receives GraphQL request and forwards to AG-UI backend via HttpAgent
3. **AG-UI server** processes the request using the ADK agent
4. **Agent executes tools** to generate and run BigQuery SQL queries
5. **Results are streamed back** through the AG-UI protocol to the frontend
6. **Query data is stored** in `tool_context.state["data"]` as a dictionary of columns



### Project Structure

```
backend/
├── ag_ui_server.py      # Main AG-UI FastAPI server
├── agents/              # ADK agent and tools
│   ├── tools.py        # Query execution tools (BigQuery)
│   ├── agent.py        # Agent configuration
│   └── prompts.py      # Agent prompts
├── requirements.txt     # Python dependencies
├── test_adk_response.py # Test script for ADK endpoints
└── .env                 # Environment variables



### Testing

Use the test script to verify the agent is working:

```bash
cd backend
python test_adk_response.py
```

This will:
1. Create a test session
2. Send a query to the agent
3. Print the response and session state
4. Show the data stored in `tool_context.state`

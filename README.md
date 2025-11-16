# Farm Pulse

Agricultural database query system powered by AI agents and BigQuery.

## Prerequisites

- Python 3.13+
- Google Cloud Project with BigQuery enabled
- Anthropic API key

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
# Anthropic API Key (required for AI agent)
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Google Cloud Configuration (required for BigQuery)
GOOGLE_PROJECT_ID=your_google_project_id
BQ_DATASET_ID=your_bigquery_dataset_id
```

#### Optional Variables

```bash
# Database Configuration
DATABASE_PATH=../data/agricultural_data.db  # Path to local SQLite database

# Mapbox Configuration (for satellite imagery)
MAPBOX_TOKEN=your_mapbox_token  # Get free token at https://mapbox.com

# Server Port
PORT=8001  # ADK agent server port (set via command line)
```

## Running the Server

### Start the ADK Agent Server (Port 8001)

The ADK agent server handles AI-powered query processing and stores results in the session state.

```bash
cd backend
source ../data/venv/bin/activate
adk web --port 8001
```

Access the agent UI at: http://localhost:8001

## How It Works

1. **User submits a query** to the ADK agent (e.g., "Show me areas with low phosphorus")
2. **Agent processes the query** using BigQuery tools to fetch data
3. **Results are stored** in `tool_context.state["data"]` as a dictionary of columns
4. **Agent responds** with a summary and the data is available in the session state

### Accessing Results

Query results are stored in the ADK session state and can be accessed via the session API:

```bash
# Get session state (includes data, SQL query, etc.)
curl http://localhost:8001/apps/agents/users/{user_id}/sessions/{session_id}
```

The session state contains:
- `data`: Dictionary of column names to values
- `sql_query`: The SQL query that was executed (if available)

## Development

### Project Structure

```
backend/
├── agents/          # ADK agent and tools
│   ├── tools.py    # Query execution tools
│   ├── agent.py    # Agent configuration
│   └── prompts.py  # Agent prompts
├── test_adk_response.py  # Test script for ADK endpoints
└── .env            # Environment variables
```

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

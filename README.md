# Farm Pulse

Agricultural database query system powered by AI agents and BigQuery.

## Prerequisites

- Python 3.13+
- Redis (for caching query results)
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

# Install Redis (macOS)
brew install redis
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

# Redis Configuration (defaults shown)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=  # Leave empty if no password

# Server Ports
API_PORT=8000  # Custom API server port
PORT=8001      # ADK agent server port (set via command line)
```

## Running the Servers

The application requires **three** services to be running:

### 1. Start Redis Server

Redis is required for caching query results between the ADK agent and custom API server.

```bash
# Start Redis as a background service
brew services start redis

# Or run Redis in the foreground (for debugging)
redis-server

# Verify Redis is running
redis-cli ping  # Should return "PONG"
```

### 2. Start the ADK Agent Server (Port 8001)

The ADK agent server handles AI-powered query processing.

```bash
cd backend
source ../data/venv/bin/activate
adk web --port 8001
```

Access the agent UI at: http://localhost:8001

### 3. Start the Custom API Server (Port 8000)

The custom API server provides endpoints to fetch query results by UUID.

```bash
# In a new terminal
cd backend
source ../data/venv/bin/activate
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

#### Custom API Endpoints

- `GET /api/health` - Health check and cache status
- `GET /api/results/{result_id}` - Get query result by UUID
- `GET /api/results` - List all cached result UUIDs
- `GET /api/cache/status` - Cache system status

### Quick Start Script

For convenience, you can start both servers with:

```bash
cd backend
source ../data/venv/bin/activate
./start_servers.sh
```

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  ADK Agent      │────▶│    Redis     │◀────│  Custom API     │
│  (Port 8001)    │     │  (Port 6379) │     │  (Port 8000)    │
│                 │     └──────────────┘     │                 │
│ - AI queries    │                          │ - Result fetch  │
│ - Store results │                          │ - Result list   │
└─────────────────┘                          └─────────────────┘
```

1. **ADK Agent** processes queries and stores results in Redis with a UUID
2. **Redis** provides shared cache between servers (results expire after 24h)
3. **Custom API** retrieves results from Redis by UUID

## Troubleshooting

### "Result not found or expired" Error

This error occurs when:

1. **Redis is not running**: Start Redis with `brew services start redis`
2. **Servers not using Redis**: Check logs for "Redis not available" warnings
3. **Result actually expired**: Results are cached for 24 hours
4. **Wrong UUID**: Verify you're using the exact UUID from the agent output

### Verify Redis Connection

```bash
# Check if Redis is running
redis-cli ping

# Check what's in Redis
redis-cli KEYS "query_result:*"

# Check API server cache status
curl http://localhost:8000/api/cache/status
```

## Development

### Project Structure

```
backend/
├── agents/          # ADK agent and tools
│   ├── tools.py    # Query execution and result storage
│   └── __init__.py
├── server.py        # Custom API server
├── results_cache.py # Redis/memory cache implementation
└── .env            # Environment variables
```

### Cache Implementation

- **Redis** (recommended): Persistent cache shared between server processes
- **In-Memory** (fallback): Used when Redis is unavailable, but each server process has separate memory

**Important**: Without Redis, the ADK agent and custom API server cannot share cached results!

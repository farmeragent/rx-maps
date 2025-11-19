# Farm Pulse

Agricultural database query system powered by AI agents and BigQuery.

## Prerequisites

- Python 3.13+
- Node.js 18+
- Google Cloud Project with BigQuery enabled
- Google Gemini API key

## Setup

### 1. Backend Setup

```bash
# Install Python dependencies
cd backend
pip install -r requirements.txt
```

Create a `.env` file in the `backend/` directory:

```bash
# Required
GOOGLE_API_KEY=your_google_gemini_api_key
GOOGLE_PROJECT_ID=your_google_project_id
BQ_DATASET_ID=your_bigquery_dataset_id

# Optional
AG_UI_PORT=8001
```

### 2. Frontend Setup

```bash
# Install Node dependencies
cd frontend
npm install
```

## Running the Application

### Start the Backend

```bash
cd backend
python ag_ui_server.py
```

The backend server will start on `http://localhost:8001`

### Start the Frontend

```bash
cd frontend
npm run dev
```

The frontend will start on `http://localhost:3000`

## Architecture

```
Frontend (Next.js + CopilotKit)
    ↓
Backend (AG-UI Server + Google ADK Agent)
    ↓
BigQuery (Agricultural Data)
```

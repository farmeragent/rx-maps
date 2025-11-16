"""
Farm Pulse Custom API Server
Provides custom endpoints for query results and cache management
Uses ADK Python SDK to call the agent directly
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from results_cache import get_result, is_redis_available, list_all_results
from agents.agent import root_agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
import json
import os

# Create the FastAPI app
app = FastAPI(
    title="Farm Pulse API",
    description="Custom API endpoints for agricultural database query results",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize ADK session service and runner
session_service = InMemorySessionService()
runner = Runner(
    agent=root_agent,
    app_name="agricultural_query_agent",
    session_service=session_service
)

# Global session holder
_default_session = None

async def get_or_create_session():
    """Get or create the default session"""
    global _default_session
    if _default_session is None:
        _default_session = await session_service.create_session(
            app_name="agricultural_query_agent",
            user_id="default_user",
            session_id="default_session"
        )
    return _default_session

# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class QueryRequest(BaseModel):
    question: str
    include_context: Optional[bool] = False


class QueryResponse(BaseModel):
    question: str
    intent: Optional[str] = "query"
    field_name: Optional[str] = None
    sql: Optional[str] = None
    results: List[Dict[str, Any]]
    hex_ids: List[str]
    count: int
    summary: str
    view_type: Optional[str] = None
    column_metadata: Optional[Dict[str, Dict[str, str]]] = None
    scatter_plot_data: Optional[Dict[str, Any]] = None


# ============================================================================
# CUSTOM ENDPOINTS
# ============================================================================

@app.get("/")
async def root():
    """Root endpoint with API info"""
    return {
        "name": "Farm Pulse API",
        "version": "1.0.0",
        "endpoints": {
            "query": "POST /api/query",
            "health": "/api/health",
            "results": "/api/results/{result_id}",
            "list_results": "/api/results",
            "cache_status": "/api/cache/status"
        },
        "agent": "ADK Python SDK (embedded)"
    }


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "cache": "redis" if is_redis_available() else "memory"
    }


@app.post("/api/query", response_model=QueryResponse)
async def query_database(request: QueryRequest):
    """
    Execute a natural language query using ADK Python SDK with Runner

    Args:
        request: QueryRequest with question and optional context flag

    Returns:
        QueryResponse with results, SQL, and hex IDs for highlighting
    """
    try:
        print(f"\n🔵 Processing query: {request.question}")

        # Create or get session for this user
        user_id = "default_user"
        session_id = "default_session"

        # Get or create session
        session = await get_or_create_session()

        # Package user query as Content
        content = types.Content(
            role='user',
            parts=[types.Part(text=request.question)]
        )

        # Run the agent and collect events
        print(f"🔵 Calling runner.run_async()")
        response_text = ""
        state = {}

        async for event in runner.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=content
        ):
            print(f"🔵 Event: {type(event).__name__}")

            # Get the final response text
            if hasattr(event, 'content') and event.content:
                if hasattr(event.content, 'parts') and event.content.parts:
                    for part in event.content.parts:
                        if hasattr(part, 'text') and part.text:
                            response_text = part.text
                            print(f"🔵 Response text: {response_text[:100]}...")

            # Get state from event if available
            if hasattr(event, 'state'):
                state = event.state
                print(f"🔵 State: {state}")

        result_id = state.get("result_id")
        print(f"🔵 Final result_id from state: {result_id}")

        # Default response structure
        result_data = {
            "question": request.question,
            "summary": response_text if response_text else "Query executed successfully.",
            "intent": "query",
            "results": [],
            "hex_ids": [],
            "count": 0,
            "sql": None
        }

        # If we have a result_id, fetch the full results from cache
        if result_id:
            print(f"🔵 Fetching cached result for ID: {result_id}")
            cached_result = get_result(result_id)

            if cached_result:
                print(f"🔵 Found cached result with {cached_result.get('row_count', 0)} rows")

                # Extract hex_ids from the cached result if present
                columns = cached_result.get("columns", {})
                if "h3_index" in columns:
                    result_data["hex_ids"] = columns["h3_index"]
                    result_data["count"] = len(columns["h3_index"])
                    result_data["view_type"] = "map"
                else:
                    result_data["count"] = cached_result.get("row_count", 0)

                # Get SQL from cached result
                result_data["sql"] = cached_result.get("sql")

                # Convert first 5 rows for preview
                row_count = cached_result.get("row_count", 0)
                if row_count > 0 and columns:
                    preview_rows = []
                    for i in range(min(5, row_count)):
                        row = {col_name: col_values[i] for col_name, col_values in columns.items()}
                        preview_rows.append(row)
                    result_data["results"] = preview_rows
            else:
                print(f"⚠️  No cached result found for ID: {result_id}")

        # Return in expected format
        return QueryResponse(
            question=result_data.get('question', request.question),
            sql=result_data.get('sql'),
            intent=result_data.get('intent', 'query'),
            field_name=result_data.get('field_name'),
            results=result_data.get('results', []),
            hex_ids=result_data.get('hex_ids', []),
            count=result_data.get('count', 0),
            summary=result_data.get('summary', ''),
            view_type=result_data.get('view_type'),
            column_metadata=result_data.get('column_metadata'),
            scatter_plot_data=result_data.get('scatter_plot_data')
        )

    except Exception as e:
        # Log the error and return user-friendly message
        error_message = str(e)
        print(f"❌ Query error: {error_message}")
        import traceback
        traceback.print_exc()

        raise HTTPException(
            status_code=400,
            detail=f"Query failed: {error_message}"
        )


@app.get("/api/results/{result_id}")
async def get_query_result(result_id: str):
    """
    Get query results by UUID

    Args:
        result_id: UUID of the query result (from tool_context.state.result_id)

    Returns:
        Query result data including SQL, columns, and metadata

    Example:
        GET /api/results/123e4567-e89b-12d3-a456-426614174000
    """
    result = get_result(result_id)

    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"Result {result_id} not found or expired. Results expire after 24 hours."
        )

    return result


@app.get("/api/results")
async def list_results():
    """
    List all cached result IDs

    Returns:
        List of result UUIDs currently in the cache
    """
    result_ids = list_all_results()
    return {
        "count": len(result_ids),
        "result_ids": result_ids
    }


@app.get("/api/cache/status")
async def cache_status():
    """
    Get cache system status

    Returns:
        Information about the caching system (Redis or in-memory)
    """
    return {
        "redis_available": is_redis_available(),
        "cache_type": "redis" if is_redis_available() else "memory",
        "note": "In-memory cache does not persist across server restarts" if not is_redis_available() else "Redis provides persistent caching"
    }


# ============================================================================
# SERVER STARTUP
# ============================================================================

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("API_PORT", "8000"))

    print("\n" + "=" * 80)
    print("🚀 Starting Farm Pulse API Server")
    print("=" * 80)
    print(f"\n📍 Server running at: http://localhost:{port}")
    print(f"\n🔧 API endpoints:")
    print(f"   • POST http://localhost:{port}/api/query (calls ADK agent via Python SDK)")
    print(f"   • GET  http://localhost:{port}/api/health")
    print(f"   • GET  http://localhost:{port}/api/results/{{result_id}}")
    print(f"   • GET  http://localhost:{port}/api/results")
    print(f"   • GET  http://localhost:{port}/api/cache/status")
    print(f"\n💾 Cache: {'Redis' if is_redis_available() else 'In-Memory (install Redis for persistence)'}")
    print(f"\n🤖 ADK Agent: Embedded (using Python SDK)")
    print(f"\n✓ No need to start separate ADK server - everything runs in this process!")
    print("\n" + "=" * 80 + "\n")

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info"
    )

"""
Farm Pulse Custom API Server
Provides custom endpoints for query results and cache management
Run separately from the ADK agent server
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from results_cache import get_result, is_redis_available, list_all_results
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
            "health": "/api/health",
            "results": "/api/results/{result_id}",
            "list_results": "/api/results",
            "cache_status": "/api/cache/status"
        },
        "note": "ADK agent runs on port 8001"
    }


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "cache": "redis" if is_redis_available() else "memory"
    }


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
    print("🚀 Starting Farm Pulse Custom API Server")
    print("=" * 80)
    print(f"\n📍 Server running at: http://localhost:{port}")
    print(f"\n🔧 Custom API endpoints:")
    print(f"   • GET  http://localhost:{port}/api/health")
    print(f"   • GET  http://localhost:{port}/api/results/{{result_id}}")
    print(f"   • GET  http://localhost:{port}/api/results")
    print(f"   • GET  http://localhost:{port}/api/cache/status")
    print(f"\n💾 Cache: {'Redis' if is_redis_available() else 'In-Memory (install Redis for persistence)'}")
    print(f"\n⚠️  Remember to also start the ADK agent server:")
    print(f"   cd backend && adk start --port 8001")
    print("\n" + "=" * 80 + "\n")

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info"
    )

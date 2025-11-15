"""
FastAPI backend for agricultural hex query system
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
from dotenv import load_dotenv

from query_service import QueryService
from database import get_db
from prescription_service import PrescriptionService

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="Agricultural Hex Query API",
    description="API for querying agricultural H3 hex data using natural language",
    version="1.0.0"
)

# Add CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize query service
query_service = None

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    global query_service
    try:
        query_service = QueryService()
        print("✓ Query service initialized")
        print("✓ Database connected")
    except Exception as e:
        print(f"✗ Failed to initialize: {str(e)}")
        raise


# Request/Response models
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

class HealthResponse(BaseModel):
    status: str
    database: str
    total_hexes: int

class SchemaResponse(BaseModel):
    table_name: str
    columns: List[Dict[str, str]]
    stats: Dict[str, Any]


# Endpoints
@app.get("/", response_model=Dict[str, str])
async def root():
    """Root endpoint"""
    return {
        "message": "Agricultural Hex Query API",
        "docs": "/docs",
        "health": "/health"
    }


@app.get("/config")
async def get_config():
    """Get frontend configuration"""
    return {
        "mapbox_token": os.getenv("MAPBOX_TOKEN", "")
    }


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    try:
        db = get_db()
        result = db.execute_query("SELECT COUNT(*) as count FROM agricultural_hexes")
        total_hexes = result[0]['count']

        return {
            "status": "healthy",
            "database": "connected",
            "total_hexes": total_hexes
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")


@app.get("/schema", response_model=SchemaResponse)
async def get_schema():
    """Get database schema information"""
    try:
        db = get_db()
        schema_info = db.get_schema_info()
        return schema_info
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get schema: {str(e)}")


@app.post("/api/query", response_model=QueryResponse)
async def query_database(request: QueryRequest):
    """
    Execute a natural language query against the database

    Args:
        request: QueryRequest with question and optional context flag

    Returns:
        QueryResponse with results, SQL, and hex IDs for highlighting
    """
    if not query_service:
        raise HTTPException(status_code=500, detail="Query service not initialized")

    try:
        # Execute the natural language query
        result = query_service.execute_natural_language_query(request.question)

        return QueryResponse(
            question=result['question'],
            sql=result['sql'],
            intent=result['intent'],
            field_name=result.get('field_name'),
            results=result['results'],
            hex_ids=result['hex_ids'],
            count=result['count'],
            summary=result['summary'],
            view_type=result.get('view_type'),
            column_metadata=result.get('column_metadata'),
            scatter_plot_data=result.get('scatter_plot_data')
        )

    except Exception as e:
        # Log the error and return user-friendly message
        error_message = str(e)
        print(f"Query error: {error_message}")

        raise HTTPException(
            status_code=400,
            detail=f"Query failed: {error_message}"
        )


@app.post("/api/query/clear-history")
async def clear_query_history():
    """Clear conversation history"""
    if not query_service:
        raise HTTPException(status_code=500, detail="Query service not initialized")

    query_service.clear_history()
    return {"message": "Conversation history cleared"}


@app.post("/api/prescription-map")
async def create_prescription_map(field_name: str = "North of Road"):
    """
    Create prescription maps for N, P, and K application

    Args:
        field_name: Name of the field to create prescriptions for

    Returns:
        List of prescription map passes with GeoJSON data
    """
    try:
        prescription_service = PrescriptionService()
        prescription_maps = prescription_service.create_prescription_maps(field_name)

        return {
            "success": True,
            "prescription_maps": [pm.to_dict() for pm in prescription_maps],
            "summary": {
                "total_passes": len(prescription_maps),
                "field_name": field_name
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create prescription map: {str(e)}")


@app.post("/api/query/sql")
async def execute_sql_directly(sql: str):
    """
    Execute SQL directly (for advanced users/debugging)

    Args:
        sql: SQL query string

    Returns:
        Query results
    """
    try:
        db = get_db()
        db.validate_sql(sql)
        results = db.execute_query(sql)

        # Extract hex_ids if present
        hex_ids = []
        if results and 'h3_index' in results[0]:
            hex_ids = [row['h3_index'] for row in results]

        return {
            "sql": sql,
            "results": results,
            "hex_ids": hex_ids,
            "count": len(results)
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"SQL execution failed: {str(e)}")


# Run with: uvicorn main:app --reload --host 0.0.0.0 --port 8000
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)

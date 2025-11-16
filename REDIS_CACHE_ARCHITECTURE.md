# Redis Cache Architecture for Query Results

## Overview

The system now uses a Redis-cached approach for handling query results, allowing efficient handling of large datasets and separating query execution from result delivery.

## Architecture

### Backend Flow

```
User Question
    ↓
Frontend → POST /api/query
    ↓
Agent (generate_SQL_query) → Generates SQL
    ↓
Agent (execute_SQL_query) → Executes SQL on BigQuery
    ↓
Results stored in Redis/Memory cache with UUID
    ↓
Returns: {result_id, preview, row_count, summary}
    ↓
Frontend displays summary + preview
    ↓
(Optional) Fetch full results: GET /api/results/{result_id}
```

### Key Components

#### 1. Backend: `execute_SQL_query` Tool (agents/tools.py)

**Returns:**
```python
{
    "status": "SUCCESS",
    "result_id": "abc-123-uuid",      # UUID for cache lookup
    "row_count": 1000,                 # Total rows
    "preview": [...],                  # First 5 rows
    "column_names": ["field", "avg"],  # Column names
    "acres": 123.45                    # Optional: total acres
}
```

**Stores in Cache:**
```python
{
    "sql": "SELECT ...",
    "columns": {
        "field_name": ["North", "South", ...],
        "avg_yield": [180.5, 175.2, ...]
    },
    "row_count": 1000,
    "timestamp": 1234567890
}
```

#### 2. Backend: Results Cache (results_cache.py)

**Storage Options:**
- **Redis**: Production (with TTL of 24 hours)
- **In-Memory**: Fallback if Redis unavailable

**Functions:**
- `store_result(result_id, data)` - Store query results
- `get_result(result_id)` - Retrieve query results
- `delete_result(result_id)` - Remove from cache

#### 3. Backend: API Endpoint (main.py)

```python
@app.get("/api/results/{result_id}")
async def get_query_result(result_id: str):
    """Retrieve cached query result by ID"""
    result_data = get_cached_result(result_id)
    if result_data is None:
        raise HTTPException(status_code=404, ...)
    return result_data
```

#### 4. Frontend: API Route (app/api/hex-query/route.ts)

**POST /api/hex-query** - Submit query
- Proxies to backend `/api/query`
- Returns query result with `result_id`

**GET /api/hex-query?result_id=<uuid>** - Fetch full results
- Proxies to backend `/api/results/{result_id}`
- Returns full cached data

#### 5. Frontend: Component (hex-query.tsx)

**Updated Interface:**
```typescript
interface QueryResult {
  // ... existing fields
  result_id?: string; // UUID for cache lookup
}
```

**Helper Function:**
```typescript
async function fetchFullResults(resultId: string): Promise<any[]> {
  // Fetches from GET /api/hex-query?result_id=...
  // Converts column-based to row-based format
}
```

**Smart Loading:**
- **Tables**: Fetches full results if `result_id` present
- **Maps**: Uses `hex_ids` from initial response
- **Scatter Plots**: Uses `scatter_plot_data` from initial response
- **Simple Queries**: Uses `summary` only

## Data Format Conversion

### Backend Storage (Column-Based)
```json
{
  "columns": {
    "field_name": ["North", "South", "Railroad"],
    "avg_yield": [180.5, 175.2, 182.1]
  },
  "row_count": 3
}
```

### Frontend Usage (Row-Based)
```json
[
  {"field_name": "North", "avg_yield": 180.5},
  {"field_name": "South", "avg_yield": 175.2},
  {"field_name": "Railroad", "avg_yield": 182.1}
]
```

The `fetchFullResults()` function automatically converts between formats.

## Benefits

### 1. Scalability
- Large result sets don't block initial response
- Results cached for 24 hours (configurable TTL)
- Multiple clients can access same result_id

### 2. Performance
- Initial response contains only preview (5 rows)
- Full results fetched only when needed
- Reduces API payload size by 90%+ for large datasets

### 3. Flexibility
- Agent can reference result_id in responses
- Frontend can fetch full data on-demand
- Supports pagination in future

### 4. Reliability
- Graceful fallback to in-memory cache
- Expires old results automatically
- Error handling for missing/expired results

## Example Flows

### Flow 1: Simple Query (No Full Results Needed)

```
User: "What's the average yield?"
    ↓
Backend: Executes query, stores in cache
    ↓
Returns: {
  summary: "Average yield is 178.5 bu/ac",
  result_id: "abc-123",
  preview: [{"avg_yield": 178.5}],
  row_count: 1
}
    ↓
Frontend: Shows summary only
✓ No additional fetch needed
```

### Flow 2: Table Query (Full Results Needed)

```
User: "Compare yield by field"
    ↓
Backend: Executes query, stores 3 rows in cache
    ↓
Returns: {
  summary: "Here's the comparison...",
  result_id: "def-456",
  preview: [...],
  row_count: 3,
  view_type: "table"
}
    ↓
Frontend: Detects view_type === "table"
    ↓
Fetches: GET /api/hex-query?result_id=def-456
    ↓
Converts columns → rows
    ↓
Displays table in chat
```

### Flow 3: Map Query (Hex IDs Only)

```
User: "Show areas with low phosphorus"
    ↓
Backend: Executes query, stores 500 rows in cache
    ↓
Returns: {
  summary: "Found 500 hexes...",
  result_id: "ghi-789",
  hex_ids: ["8a2a...", "8a2b...", ...],
  row_count: 500,
  view_type: "map"
}
    ↓
Frontend: Highlights hex_ids on map
✓ No need to fetch full 500 rows
```

## Configuration

### Environment Variables

**Backend (.env):**
```bash
# Redis configuration (optional, falls back to in-memory)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=  # Optional

# BigQuery configuration
GOOGLE_PROJECT_ID=your-project-id
BQ_DATASET_ID=your-dataset
GOOGLE_API_KEY=your-api-key
```

**Frontend (.env.local):**
```bash
QUERY_SERVICE_API_URL=http://localhost:8000
```

## Monitoring

### Check Redis Status
```bash
curl http://localhost:8000/health
```

### List Cached Results
```python
from results_cache import list_all_results
print(list_all_results())
```

### Manual Result Lookup
```bash
# Using the helper script
python backend/get_result.py abc-123-uuid

# Or via API
curl http://localhost:8000/api/results/abc-123-uuid
```

## Future Enhancements

1. **Pagination**: Return result_id + offset/limit
2. **Compression**: Compress large result sets
3. **Analytics**: Track cache hit rates
4. **Expiration**: Configurable TTL per query type
5. **Streaming**: Stream large results incrementally

"""
Redis-based cache for storing query results by UUID
Falls back to in-memory cache if Redis is unavailable
"""
import json
import os
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

# Redis configuration
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_DB = int(os.getenv("REDIS_DB", 0))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", None)

# Default TTL (24 hours in seconds)
DEFAULT_TTL = 24 * 60 * 60

# Try to import Redis
try:
    import redis
    from redis.exceptions import RedisError
    REDIS_INSTALLED = True
except ImportError:
    logger.warning("Redis not installed. Using in-memory cache. Install with: pip install redis")
    REDIS_INSTALLED = False
    RedisError = Exception  # Dummy for type hints

# Initialize Redis client or fallback
if REDIS_INSTALLED:
    try:
        redis_client = redis.Redis(
            host=REDIS_HOST,
            port=REDIS_PORT,
            db=REDIS_DB,
            password=REDIS_PASSWORD,
            decode_responses=True,  # Automatically decode bytes to strings
            socket_connect_timeout=5,
            socket_timeout=5
        )
        # Test connection
        redis_client.ping()
        logger.info(f"✓ Connected to Redis at {REDIS_HOST}:{REDIS_PORT}")
        REDIS_AVAILABLE = True
    except (RedisError, ConnectionError) as e:
        logger.warning(f"✗ Redis not available: {e}. Falling back to in-memory cache.")
        redis_client = None
        REDIS_AVAILABLE = False
else:
    redis_client = None
    REDIS_AVAILABLE = False

# Fallback: in-memory cache
_memory_cache: Dict[str, Any] = {}


def _get_key(result_id: str) -> str:
    """Generate Redis key for result ID"""
    return f"query_result:{result_id}"


def store_result(result_id: str, data: Dict[str, Any], ttl_seconds: int = DEFAULT_TTL) -> bool:
    """
    Store query result data in cache with expiration

    Args:
        result_id: Unique identifier for the result
        data: Result data to store (must be JSON-serializable)
        ttl_seconds: Time-to-live in seconds (default: 24 hours)

    Returns:
        True if stored successfully, False otherwise
    """
    try:
        if REDIS_AVAILABLE:
            # Store in Redis
            key = _get_key(result_id)
            serialized_data = json.dumps(data)
            redis_client.setex(key, ttl_seconds, serialized_data)
            logger.info(f"Stored result {result_id} in Redis (TTL: {ttl_seconds}s)")
            return True
        else:
            # Fallback: store in memory (no TTL in memory cache)
            _memory_cache[result_id] = data
            logger.info(f"Stored result {result_id} in memory cache")
            return True
    except (RedisError, json.JSONEncodeError, TypeError) as e:
        logger.error(f"Failed to store result {result_id}: {e}")
        return False


def get_result(result_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve query result data from cache

    Args:
        result_id: Unique identifier for the result

    Returns:
        Result data if found and not expired, None otherwise
    """
    try:
        if REDIS_AVAILABLE:
            # Get from Redis
            key = _get_key(result_id)
            serialized_data = redis_client.get(key)

            if serialized_data is None:
                logger.info(f"Result {result_id} not found in Redis")
                return None

            data = json.loads(serialized_data)
            logger.info(f"Retrieved result {result_id} from Redis")
            return data
        else:
            # Fallback: get from memory
            data = _memory_cache.get(result_id)
            if data:
                logger.info(f"Retrieved result {result_id} from memory cache")
            else:
                logger.info(f"Result {result_id} not found in memory cache")
            return data
    except (RedisError, json.JSONDecodeError) as e:
        logger.error(f"Failed to retrieve result {result_id}: {e}")
        return None


def delete_result(result_id: str) -> bool:
    """
    Delete query result from cache

    Args:
        result_id: Unique identifier for the result

    Returns:
        True if deleted, False otherwise
    """
    try:
        if REDIS_AVAILABLE:
            key = _get_key(result_id)
            deleted = redis_client.delete(key)
            logger.info(f"Deleted result {result_id} from Redis")
            return deleted > 0
        else:
            if result_id in _memory_cache:
                del _memory_cache[result_id]
                logger.info(f"Deleted result {result_id} from memory cache")
                return True
            return False
    except RedisError as e:
        logger.error(f"Failed to delete result {result_id}: {e}")
        return False


def get_ttl(result_id: str) -> Optional[int]:
    """
    Get remaining TTL for a result

    Args:
        result_id: Unique identifier for the result

    Returns:
        Remaining TTL in seconds, -1 if no expiration, -2 if not found, None on error
    """
    if not REDIS_AVAILABLE:
        return None

    try:
        key = _get_key(result_id)
        ttl = redis_client.ttl(key)
        return ttl
    except RedisError as e:
        logger.error(f"Failed to get TTL for result {result_id}: {e}")
        return None


def list_all_results() -> list[str]:
    """
    List all result IDs in the cache

    Returns:
        List of result IDs
    """
    try:
        if REDIS_AVAILABLE:
            pattern = _get_key("*")
            keys = redis_client.keys(pattern)
            # Extract result IDs from keys
            result_ids = [key.replace("query_result:", "") for key in keys]
            return result_ids
        else:
            return list(_memory_cache.keys())
    except RedisError as e:
        logger.error(f"Failed to list results: {e}")
        return []


def clear_all_results() -> bool:
    """
    Clear all query results from cache (use with caution!)

    Returns:
        True if cleared successfully
    """
    try:
        if REDIS_AVAILABLE:
            pattern = _get_key("*")
            keys = redis_client.keys(pattern)
            if keys:
                redis_client.delete(*keys)
            logger.info(f"Cleared {len(keys)} results from Redis")
            return True
        else:
            _memory_cache.clear()
            logger.info("Cleared all results from memory cache")
            return True
    except RedisError as e:
        logger.error(f"Failed to clear results: {e}")
        return False


def is_redis_available() -> bool:
    """Check if Redis is available"""
    return REDIS_AVAILABLE

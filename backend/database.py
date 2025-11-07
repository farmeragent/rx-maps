"""
DuckDB database connection and query execution
"""
import duckdb
import os
import json
from typing import List, Dict, Any
from pathlib import Path


class DatabaseConnection:
    def __init__(self, db_path: str = None):
        """Initialize database connection"""
        if db_path is None:
            # Default to parent directory
            db_path = str(Path(__file__).parent.parent / "agricultural_data.db")

        self.db_path = db_path
        self.conn = None

        # Load schema configuration
        schema_config_path = Path(__file__).parent / "schema_config.json"
        if schema_config_path.exists():
            with open(schema_config_path, 'r') as f:
                self.schema_config = json.load(f)
        else:
            self.schema_config = None

    def connect(self):
        """Connect to DuckDB database"""
        if self.conn is None:
            self.conn = duckdb.connect(self.db_path, read_only=False)
            if os.getenv("ENVIRONMENT", None) == "production":
                current_directory = os.getenv("HOME", "/tmp")
                self.conn.execute(f"SET home_directory='{current_directory}';")
                self.conn.execute(f"SET secret_directory='{current_directory}/secrets_dir';")
                self.conn.execute(f"SET extension_directory='{current_directory}/extensions_dir';")
            # Load spatial extension
            self.conn.install_extension("spatial");
            self.conn.load_extension("spatial");
        return self.conn

    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
            self.conn = None

    def execute_query(self, sql: str) -> List[Dict[str, Any]]:
        """
        Execute a SQL query and return results as list of dictionaries

        Args:
            sql: SQL query string

        Returns:
            List of dictionaries with column names as keys
        """
        conn = self.connect()
        try:
            result = conn.execute(sql).fetchall()
            columns = [desc[0] for desc in conn.description]
            return [dict(zip(columns, row)) for row in result]
        except Exception as e:
            raise Exception(f"Query execution failed: {str(e)}")

    def get_schema_info(self) -> Dict[str, Any]:
        """Get database schema information including rich metadata for prompt context"""
        conn = self.connect()

        # Get sample data stats
        stats_sql = """
        SELECT
            COUNT(*) as total_hexes,
            ROUND(MIN(yield_target), 2) as min_yield,
            ROUND(MAX(yield_target), 2) as max_yield,
            ROUND(AVG(P_in_soil), 2) as avg_P,
            ROUND(AVG(K_in_soil), 2) as avg_K,
            ROUND(AVG(N_in_soil), 2) as avg_N
        FROM agricultural_hexes;
        """

        stats = conn.execute(stats_sql).fetchone()

        # Build result with database stats
        result = {
            "table_name": "agricultural_hexes",
            "stats": {
                "total_hexes": stats[0],
                "min_yield": stats[1],
                "max_yield": stats[2],
                "avg_P": stats[3],
                "avg_K": stats[4],
                "avg_N": stats[5]
            }
        }

        # If schema config exists, use rich metadata; otherwise fallback to basic info
        if self.schema_config:
            result["description"] = self.schema_config.get("description", "")
            result["columns"] = self.schema_config.get("columns", [])
            result["query_hints"] = self.schema_config.get("query_hints", [])
            result["domain_knowledge"] = self.schema_config.get("domain_knowledge", [])
        else:
            # Fallback to basic schema from database
            schema_sql = """
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'agricultural_hexes'
            ORDER BY ordinal_position;
            """
            columns = conn.execute(schema_sql).fetchall()
            result["columns"] = [{"name": col[0], "type": col[1]} for col in columns]

        return result

    def validate_sql(self, sql: str) -> bool:
        """
        Validate SQL query (basic safety checks)

        Args:
            sql: SQL query to validate

        Returns:
            True if valid, raises exception otherwise
        """
        sql_lower = sql.lower().strip()

        # Block dangerous operations
        dangerous_keywords = ['drop', 'delete', 'truncate', 'alter', 'create', 'insert', 'update']
        for keyword in dangerous_keywords:
            if keyword in sql_lower:
                raise Exception(f"SQL contains forbidden keyword: {keyword}")

        # Must be a SELECT statement
        if not sql_lower.startswith('select'):
            raise Exception("Only SELECT queries are allowed")

        return True


# Singleton instance
_db_instance = None

def get_db() -> DatabaseConnection:
    """Get or create database connection singleton"""
    global _db_instance
    if _db_instance is None:
        db_path = os.getenv("DATABASE_PATH", None)
        _db_instance = DatabaseConnection(db_path)
    return _db_instance

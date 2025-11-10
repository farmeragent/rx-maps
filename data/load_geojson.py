"""
Load multiple GeoJSON files into DuckDB with field identifiers
"""
import duckdb
from pathlib import Path
import sys
import json


def validate_schema_coverage(conn, schema_config_path):
    """
    Validate that all database columns have corresponding entries in schema_config.json

    Args:
        conn: DuckDB connection
        schema_config_path: Path to schema_config.json file

    Returns:
        bool: True if all columns are documented, False otherwise
    """
    # Get all columns from the database table
    db_columns = conn.execute("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'agricultural_hexes'
        ORDER BY column_name
    """).fetchall()
    db_column_names = {row[0] for row in db_columns}

    # Load schema config
    with open(schema_config_path, 'r') as f:
        schema_config = json.load(f)

    # Get all column names from schema config
    config_column_names = {col['name'] for col in schema_config['columns']}

    # Find columns missing from schema config
    missing_from_config = db_column_names - config_column_names

    # Report results
    print("\n" + "="*60)
    print("SCHEMA VALIDATION")
    print("="*60)
    print(f"\nDatabase columns: {len(db_column_names)}")
    print(f"Schema config entries: {len(config_column_names)}")

    if missing_from_config:
        print(f"\n✗ VALIDATION FAILED")
        print(f"\nColumns in database but MISSING from schema_config.json:")
        for col in sorted(missing_from_config):
            print(f"  - {col}")
        return False
    else:
        print(f"\n✓ VALIDATION PASSED - All database columns are documented in schema_config.json")
        return True

def load_geojson_files():
    """Load all GeoJSON files into the database with field names"""

    # Database path (same directory as script)
    db_path = str(Path(__file__).parent / "agricultural_data.db")

    # GeoJSON files to load with their field names (in field-geojsons subdirectory)
    geojson_files = [
        {
            "path": str(Path(__file__).parent / "field-geojsons" / "north-of-road-high-res.geojson"),
            "field_name": "North of Road"
        },
        {
            "path": str(Path(__file__).parent / "field-geojsons" / "railroad-pivot-high-res.geojson"),
            "field_name": "Railroad Pivot"
        },
        {
            "path": str(Path(__file__).parent / "field-geojsons" / "south-of-road-high-res.geojson"),
            "field_name": "South of Road"
        }
    ]

    # Connect to DuckDB
    conn = duckdb.connect(db_path)

    try:
        # Install and load spatial extension
        print("Loading spatial extension...")
        conn.execute("INSTALL spatial;")
        conn.execute("LOAD spatial;")

        # Drop existing table if it exists
        print("\nDropping existing table...")
        conn.execute("DROP TABLE IF EXISTS agricultural_hexes;")

        # Create the table with field_name column
        print("Creating table schema...")
        conn.execute("""
            CREATE TABLE agricultural_hexes (
                h3_index VARCHAR PRIMARY KEY,
                field_name VARCHAR NOT NULL,
                area DOUBLE,
                pH DOUBLE,
                P_in_soil DOUBLE,
                K_in_soil DOUBLE,
                cec DOUBLE,
                yield_target DOUBLE,
                calcium DOUBLE,
                magnesium DOUBLE,
                N_in_soil DOUBLE,
                N_to_apply DOUBLE,
                P_to_apply DOUBLE,
                K_to_apply DOUBLE,
                geometry GEOMETRY
            );
        """)

        # Load each GeoJSON file
        total_rows = 0
        for file_info in geojson_files:
            file_path = file_info["path"]
            field_name = file_info["field_name"]

            print(f"\nLoading {field_name} from {Path(file_path).name}...")

            # Check if file exists
            if not Path(file_path).exists():
                print(f"  WARNING: File not found: {file_path}")
                continue

            # Read GeoJSON and insert into table
            # DuckDB's ST_Read expands properties as columns
            insert_sql = f"""
                INSERT INTO agricultural_hexes
                SELECT
                    h3_index,
                    '{field_name}' as field_name,
                    area,
                    pH,
                    P_in_soil,
                    K_in_soil,
                    cec,
                    yield_target,
                    calcium,
                    magnesium,
                    N_in_soil,
                    N_to_apply,
                    P_to_apply,
                    K_to_apply,
                    geom as geometry
                FROM ST_Read('{file_path}');
            """

            conn.execute(insert_sql)

            # Get count for this field
            result = conn.execute(f"""
                SELECT COUNT(*) as count
                FROM agricultural_hexes
                WHERE field_name = '{field_name}'
            """).fetchone()

            field_count = result[0]
            total_rows += field_count
            print(f"  ✓ Loaded {field_count:,} hexes")

        # Create index on field_name for faster queries
        print("\nCreating indexes...")
        conn.execute("CREATE INDEX idx_field_name ON agricultural_hexes(field_name);")
        conn.execute("CREATE INDEX idx_p_in_soil ON agricultural_hexes(P_in_soil);")
        conn.execute("CREATE INDEX idx_k_in_soil ON agricultural_hexes(K_in_soil);")
        conn.execute("CREATE INDEX idx_n_in_soil ON agricultural_hexes(N_in_soil);")
        conn.execute("CREATE INDEX idx_ph ON agricultural_hexes(pH);")
        conn.execute("CREATE INDEX idx_cec ON agricultural_hexes(cec);")
        conn.execute("CREATE INDEX idx_calcium ON agricultural_hexes(calcium);")
        conn.execute("CREATE INDEX idx_magnesium ON agricultural_hexes(magnesium);")

        # Validate schema coverage - FATAL if columns are undocumented
        schema_config_path = Path(__file__).parent.parent / "backend" / "schema_config.json"
        if not validate_schema_coverage(conn, schema_config_path):
            print("\n✗ FATAL ERROR: All database columns must be documented in schema_config.json")
            sys.exit(1)

        # Display summary statistics
        print("\n" + "="*60)
        print("LOAD COMPLETE")
        print("="*60)

        # Overall stats
        print(f"\nTotal hexes loaded: {total_rows:,}")

        # Per-field stats
        print("\nPer-Field Statistics:")
        print("-" * 60)
        stats = conn.execute("""
            SELECT
                field_name,
                COUNT(*) as hex_count,
                ROUND(AVG(P_in_soil), 2) as avg_P,
                ROUND(AVG(K_in_soil), 2) as avg_K,
                ROUND(AVG(N_in_soil), 2) as avg_N,
                ROUND(AVG(yield_target), 2) as avg_yield
            FROM agricultural_hexes
            GROUP BY field_name
            ORDER BY field_name;
        """).fetchall()

        for row in stats:
            print(f"\n{row[0]}:")
            print(f"  Hexes: {row[1]:,}")
            print(f"  Avg P: {row[2]}")
            print(f"  Avg K: {row[3]}")
            print(f"  Avg N: {row[4]}")
            print(f"  Avg Yield: {row[5]}")

        # Example queries
        print("\n" + "="*60)
        print("EXAMPLE QUERIES")
        print("="*60)

        print("\n1. Which field has the lowest average phosphorus?")
        result = conn.execute("""
            SELECT
                field_name,
                ROUND(AVG(P_in_soil), 2) as avg_P
            FROM agricultural_hexes
            GROUP BY field_name
            ORDER BY avg_P ASC
            LIMIT 1;
        """).fetchone()
        print(f"   → {result[0]}: {result[1]} ppm")

        print("\n2. How many hexes in each field have low phosphorus (< 60)?")
        low_p_results = conn.execute("""
            SELECT
                field_name,
                COUNT(*) as low_P_count
            FROM agricultural_hexes
            WHERE P_in_soil < 60
            GROUP BY field_name
            ORDER BY low_P_count DESC;
        """).fetchall()
        for row in low_p_results:
            print(f"   → {row[0]}: {row[1]:,} hexes")

        print("\n✓ Database ready!")
        print(f"✓ Location: {db_path}")

    except Exception as e:
        print(f"\n✗ Error: {str(e)}")
        sys.exit(1)

    finally:
        conn.close()

if __name__ == "__main__":
    load_geojson_files()

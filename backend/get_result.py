#!/usr/bin/env python3
"""
Quick script to fetch and display query results by UUID
Usage: python get_result.py <result_id>
"""
import sys
import requests
import json
from pprint import pprint

API_HOST = "http://localhost:8000"

def get_result(result_id: str):
    """Fetch and display result by UUID"""

    url = f"{API_HOST}/api/results/{result_id}"

    print(f"Fetching result: {result_id}")
    print(f"URL: {url}")
    print("=" * 80)

    try:
        response = requests.get(url)
        response.raise_for_status()

        data = response.json()

        print("\n✅ Result found!")
        print("=" * 80)

        # Pretty print the full response
        print("\nFull Response:")
        pprint(data, width=120)

        # Show key information
        if "sql" in data:
            print("\n" + "=" * 80)
            print("SQL Query:")
            print("=" * 80)
            print(data["sql"])

        if "columns" in data:
            print("\n" + "=" * 80)
            print("Columns:")
            print("=" * 80)
            for col_name, values in data["columns"].items():
                print(f"  {col_name}: {len(values)} rows")
                # Show first few values
                if values:
                    print(f"    Sample: {values[:3]}")

        if "row_count" in data:
            print(f"\nTotal Rows: {data['row_count']}")

        if "timestamp" in data:
            from datetime import datetime
            ts = datetime.fromtimestamp(data["timestamp"])
            print(f"Created: {ts.strftime('%Y-%m-%d %H:%M:%S')}")

    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            print("\n❌ Result not found or expired")
            print(f"   {e.response.json().get('detail', 'Unknown error')}")
        else:
            print(f"\n❌ HTTP Error: {e}")

    except requests.exceptions.ConnectionError:
        print(f"\n❌ Could not connect to API server at {API_HOST}")
        print("   Make sure the server is running:")
        print("   cd backend && python server.py")

    except Exception as e:
        print(f"\n❌ Error: {e}")

def main():
    if len(sys.argv) < 2:
        print("Usage: python get_result.py <result_id>")
        print("\nExample:")
        print("  python get_result.py 123e4567-e89b-12d3-a456-426614174000")
        sys.exit(1)

    result_id = sys.argv[1]
    get_result(result_id)

if __name__ == "__main__":
    main()

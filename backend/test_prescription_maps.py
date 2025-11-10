"""
Test script to generate prescription maps for all fields and save as GeoJSON files
"""
import requests
import json
import os
from pathlib import Path

# API endpoint
API_URL = "http://localhost:8000/api/prescription-map"

# Fields to generate prescription maps for
FIELDS = [
    "North of Road",
    "South of Road",
    "Railroad Pivot"
]

# Output directory
OUTPUT_DIR = Path(__file__).parent.parent / "data" / "prescription_maps"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def sanitize_filename(name: str) -> str:
    """Convert field name to safe filename"""
    return name.lower().replace(" ", "_")


def test_prescription_map(field_name: str):
    """
    Call prescription map API and save GeoJSONs

    Args:
        field_name: Name of the field to process
    """
    print(f"\n{'='*60}")
    print(f"Processing field: {field_name}")
    print(f"{'='*60}")

    try:
        # Call API
        response = requests.post(
            API_URL,
            params={"field_name": field_name},
            timeout=30
        )
        response.raise_for_status()

        data = response.json()

        if not data.get("success"):
            print(f"❌ Failed to generate prescription maps for {field_name}")
            return

        # Get prescription maps
        prescription_maps = data.get("prescription_maps", [])
        summary = data.get("summary", {})

        print(f"✓ Generated {summary.get('total_passes', 0)} prescription passes")

        # Save each prescription map as a separate GeoJSON
        field_safe_name = sanitize_filename(field_name)

        for pmap in prescription_maps:
            pass_name = pmap.get("pass", "unknown")
            geojson = pmap.get("geojson", {})

            # Create filename
            pass_safe_name = sanitize_filename(pass_name)
            filename = f"{field_safe_name}_{pass_safe_name}.geojson"
            filepath = OUTPUT_DIR / filename

            # Save GeoJSON
            with open(filepath, 'w') as f:
                json.dump(geojson, f, indent=2)

            # Get stats from the feature
            features = geojson.get("features", [])
            if features:
                props = features[0].get("properties", {})
                rate = props.get("rate", 0)
                unit = props.get("unit", "")
                print(f"  ✓ Saved: {filename}")
                print(f"    - Average rate: {rate} {unit}")

        print(f"✓ All files saved to: {OUTPUT_DIR}")

    except requests.exceptions.RequestException as e:
        print(f"❌ API request failed: {str(e)}")
    except Exception as e:
        print(f"❌ Error: {str(e)}")


def main():
    """Main test function"""
    print("="*60)
    print("Prescription Map Generator Test")
    print("="*60)
    print(f"API URL: {API_URL}")
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"Fields to process: {len(FIELDS)}")

    # Process each field
    for field_name in FIELDS:
        test_prescription_map(field_name)

    print("\n" + "="*60)
    print("✓ Test complete!")
    print(f"GeoJSON files saved to: {OUTPUT_DIR}")
    print("="*60)


if __name__ == "__main__":
    main()

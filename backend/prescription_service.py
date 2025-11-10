"""
Prescription map generation service
"""
import json
import h3
import geopandas as gpd
from shapely.geometry import Polygon, MultiPolygon
from shapely.ops import unary_union
from typing import List, Dict, Any
from dataclasses import dataclass
from database import get_db


@dataclass
class PrescriptionMap:
    """Wrapper around a GeoJSON FeatureCollection for a prescription pass"""
    pass_name: str
    geojson: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            "pass": self.pass_name,
            "geojson": self.geojson
        }


class PrescriptionService:
    """Service for generating prescription maps"""

    def __init__(self):
        self.db = get_db()

    def create_prescription_maps(self, field_name: str) -> List[PrescriptionMap]:
        """
        Create prescription maps for a given field

        Args:
            field_name: Name of the field to create prescriptions for

        Returns:
            List of PrescriptionMap objects (one for N, P, K)
        """
        # Create prescription maps for each nutrient
        prescription_maps = []

        # Nitrogen pass
        prescription_maps.append(
            self._create_nutrient_pass(field_name, "nitrogen pass", "N_to_apply", "lbs/acre")
        )

        # Phosphorus pass
        prescription_maps.append(
            self._create_nutrient_pass(field_name, "phosphorus pass", "P_to_apply", "lbs/acre")
        )

        # Potassium pass
        prescription_maps.append(
            self._create_nutrient_pass(field_name, "potassium pass", "K_to_apply", "lbs/acre")
        )

        return prescription_maps

    def _create_nutrient_pass(
        self,
        field_name: str,
        pass_name: str,
        nutrient_column: str,
        unit: str
    ) -> PrescriptionMap:
        """
        Create a single nutrient prescription pass with boundary polygon

        Args:
            field_name: Name of the field
            pass_name: Name of the pass (e.g., "nitrogen pass")
            nutrient_column: Column name for nutrient data (e.g., "N_to_apply")
            unit: Unit of measurement

        Returns:
            PrescriptionMap object
        """
        # Query to get h3 indices and average nutrient rate
        sql = f"""
        SELECT
            h3_index,
            AVG({nutrient_column}) as avg_rate
        FROM agricultural_hexes
        WHERE field_name = '{field_name}'
        GROUP BY h3_index
        """

        result = self.db.execute_query(sql)

        if not result or len(result) == 0:
            raise ValueError(f"No data found for field: {field_name}")

        # Extract h3 indices and calculate average rate
        h3_indices = [row['h3_index'] for row in result]
        # Filter out None values when calculating average
        rates = [row['avg_rate'] for row in result if row['avg_rate'] is not None]
        avg_rate = sum(rates) / len(rates) if rates else 0

        compacted_h3_indices = h3.compact_cells(h3_indices)
        h3_boundaries = [h3.cell_to_boundary(hex) for hex in compacted_h3_indices]
        shapely_polys = []
        for boundary in h3_boundaries:
            shapely_polys.append(Polygon([(lon, lat) for lat, lon in boundary]))
        rx_map_boundary = unary_union(shapely_polys).convex_hull


        # Create MultiPolygon from all cell polygons
        # Create GeoDataFrame with the geometry
        gdf = gpd.GeoDataFrame(
            { 'pass': [pass_name],
                'zone_number': [1],
                'rate': [round(avg_rate, 2)],
                'unit': [unit]
            },
            geometry=[rx_map_boundary],
            crs='EPSG:4326'
        )

        # Convert to GeoJSON dict
        geojson = json.loads(gdf.to_json())

        return PrescriptionMap(pass_name=pass_name, geojson=geojson)

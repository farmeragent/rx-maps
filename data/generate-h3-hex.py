import logging
import tempfile
from pathlib import Path
from tkinter import W

import geopandas as gpd
import h3
import numpy as np
import rasterio
from absl import app, flags
from rasterio.warp import calculate_default_transform, reproject, Resampling
from rasterstats import zonal_stats
from shapely.geometry import Polygon

FLAGS = flags.FLAGS

flags.DEFINE_string('boundary_geojson', None, 'Path to the boundary GeoJSON file.', required=True)
flags.DEFINE_string('raster_tif_dir', None, 'Path to a directory of TIFF files.', required=True)
flags.DEFINE_string('output_geojson', None, 'Path to the output GeoJSON file.', required=True)
flags.DEFINE_integer('resolution', 14, 'H3 resolution (smaller number = bigger hexes).')

def reproject_raster(
    input_path: str,
    output_path: str,
    dst_crs: str,
    resampling: str = "nearest",
):
    """
    Reproject a GeoTIFF raster to a new CRS.

    Parameters
    ----------
    input_path : str
        Path to the input GeoTIFF.
    output_path : str
        Path to save the reprojected GeoTIFF.
    dst_crs : str
        Target CRS (e.g. "EPSG:32610").
    resampling : str, optional
        Resampling method ("nearest", "bilinear", "cubic", etc.).
    return_array : bool, optional
        If True, returns (array, transform, profile) instead of saving only.

    Returns
    -------
    tuple or None
        (array, transform, profile) if return_array=True, else None.
    """

    # Map string name to rasterio enum
    resampling_method = getattr(Resampling, resampling)

    with rasterio.open(input_path) as src:
        transform, width, height = calculate_default_transform(
            src.crs, dst_crs, src.width, src.height, *src.bounds
        )

        profile = src.profile.copy()
        profile.update({
            "crs": dst_crs,
            "transform": transform,
            "width": width,
            "height": height
        })

        # Initialize empty output array
        data = np.empty((src.count, height, width), dtype=src.dtypes[0])

        for i in range(1, src.count + 1):
            reproject(
                source=rasterio.band(src, i),
                destination=data[i - 1],
                src_transform=src.transform,
                src_crs=src.crs,
                dst_transform=transform,
                dst_crs=dst_crs,
                resampling=resampling_method
            )

        # Save to disk
        with rasterio.open(output_path, "w", **profile) as dst:
            dst.write(data)

def main(argv):
    # --- 1. Load your AOI boundary from GeoJSON ---
    boundary_gdf = gpd.read_file(FLAGS.boundary_geojson)
    boundary_gdf = boundary_gdf.to_crs(epsg=4326)

    # --- 2. Generate H3 hexes that cover this boundary ---
    boundary_coords = boundary_gdf.geometry.union_all().__geo_interface__  # GeoJSON-like dict
    geojson_coords = boundary_coords['coordinates'][0]
    latlon_coords = [(lat, lon) for lon, lat in geojson_coords]
    poly = h3.LatLngPoly(latlon_coords)
    hexes = h3.h3shape_to_cells(poly, res=FLAGS.resolution)

    cell_boundaries = []
    cell_areas = []
    for hex in hexes:
        boundary = h3.cell_to_boundary(hex)
        cell_boundaries.append(Polygon([(lon, lat) for lat, lon in boundary]))

        area_m2 = h3.cell_area(hex, unit='m^2')
        area_acres = area_m2 * 0.000247105
        cell_areas.append(area_acres)

    hex_gdf = gpd.GeoDataFrame({"h3_index": hexes, "area": cell_areas, "geometry": cell_boundaries}, crs=4326)

    # --- 4. Run zonal statistics on each hex ---
    stats = {}
    for raster_tif in Path(FLAGS.raster_tif_dir).glob("*.tif"):
        # We need to reproject the tif to EPSG:4326
        
        with tempfile.NamedTemporaryFile(suffix=".tif") as tmp_tif:
            logging.info(f"Processing {raster_tif}")
            reproject_raster(raster_tif, tmp_tif.name, "EPSG:4326")
            raster_layer_name = Path(raster_tif).stem
            layer_stats = zonal_stats(
                hex_gdf['geometry'], tmp_tif.name,
                stats=["mean", "min", "max"],
                nodata=None,
                geojson_out=True
            )
            stats[raster_layer_name] = layer_stats

    # --- 5. Attach results back to GeoDataFrame ---
    for layer_name, layer_stats in stats.items()    :
        for i, s in enumerate(layer_stats):
            if layer_name == 'weed-map' and s["properties"]["mean"] is not None:
                hex_gdf.loc[i, layer_name] = 1 - s["properties"]["mean"]
            elif layer_name == 'yield_target' and s["properties"]["min"] is not None:
                hex_gdf.loc[i, layer_name] = s["properties"]["min"]
            else:
                hex_gdf.loc[i, layer_name] = s["properties"]["mean"]

    logging.info("Writing to file")
    hex_gdf.to_file(FLAGS.output_geojson, driver="GeoJSON")

if __name__ == '__main__':
    app.run(main)

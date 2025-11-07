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

flags.DEFINE_string('field_geojson', None, 'Path to the field GeoJSON file.', required=True)

def main(argv):
    field_gdf = gpd.read_file(FLAGS.field_geojson)

    field_gdf.rename(columns={'potassium': 'K_in_soil', 'phosphorus': 'P_in_soil'}, inplace=True)
    field_gdf["N_in_soil"] = 0
    field_gdf["K_in_soil"] = field_gdf["K_in_soil"].fillna(field_gdf["K_in_soil"].mean())
    field_gdf["P_in_soil"] = field_gdf["P_in_soil"].fillna(field_gdf["P_in_soil"].mean())

    # https://www.aces.edu/blog/topics/crop-production/corn-nutrient-removal-nitrogen-rates-broiler-litter-application/
    field_gdf['N_needed'] = field_gdf['yield_target'] * 1.2
    field_gdf['P_needed'] = field_gdf['yield_target'] * 0.76
    field_gdf['K_needed'] = field_gdf['yield_target'] * 0.84

    field_gdf['N_to_apply'] = field_gdf['N_needed'] - field_gdf['N_in_soil']
    field_gdf['P_to_apply'] = field_gdf['P_needed'] - field_gdf['P_in_soil']
    field_gdf.loc[field_gdf['P_to_apply'] < 0, 'P_to_apply'] = 0
    field_gdf['K_to_apply'] = field_gdf['K_needed'] - field_gdf['K_in_soil']
    field_gdf.loc[field_gdf['K_to_apply'] < 0, 'K_to_apply'] = 0

    float_cols = field_gdf.select_dtypes(include=['float64']).columns
    field_gdf[float_cols] = field_gdf[float_cols].astype('float32')
    field_gdf.drop(columns=['N_needed', 'P_needed', 'K_needed'], inplace=True)

    field_gdf.to_file(FLAGS.field_geojson, driver="GeoJSON")

if __name__ == '__main__':
    app.run(main)

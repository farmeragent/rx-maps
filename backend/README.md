# Shapefile to H3 Index Converter and Visualizer

This Python script converts shapefile geometries to H3 indices and provides visualization functionality for the H3 boundaries.

## Features

- **Shapefile Reading**: Load and process shapefiles using GeoPandas
- **H3 Conversion**: Convert various geometry types (points, polygons, linestrings) to H3 indices
- **Visualization**: Plot H3 boundaries with customizable styling
- **Comparison Plots**: Side-by-side comparison of original shapefile and H3 representation
- **Statistics**: Get detailed statistics about the conversion process

## Installation

1. Install the required dependencies:
```bash
pip install -r requirements.txt
```

## Usage

### Basic Usage

```python
from shapefile_to_h3 import ShapefileToH3

# Initialize converter with H3 resolution 8
converter = ShapefileToH3(h3_resolution=8)

# Load your shapefile
gdf = converter.load_shapefile("your_shapefile.shp")

# Convert all geometries to H3 indices
h3_results = converter.convert_all_to_h3()

# Plot H3 boundaries
converter.plot_h3_boundaries(title="My H3 Visualization")

# Plot comparison between original and H3
converter.plot_comparison(save_path="comparison.png")

# Get statistics
stats = converter.get_h3_statistics()
print(stats)
```

### Advanced Usage

```python
# Custom H3 resolution (0-15, higher = more detailed)
converter = ShapefileToH3(h3_resolution=10)

# Load shapefile
converter.load_shapefile("data.shp")

# Convert to H3
results = converter.convert_all_to_h3()

# Custom plotting
converter.plot_h3_boundaries(
    title="Custom H3 Plot",
    color='red',
    edgecolor='blue',
    alpha=0.8,
    figsize=(15, 10),
    save_path="custom_plot.png"
)

# Plot specific H3 indices
specific_indices = list(results[0])  # First feature's H3 indices
converter.plot_h3_boundaries(
    h3_indices=specific_indices,
    title="Specific Feature H3 Indices"
)
```

## H3 Resolution Guide

H3 resolution levels determine the size of the hexagonal cells:

- **Resolution 0**: ~4,250,546.8 km² (continental level)
- **Resolution 1**: ~607,220.98 km² (country level)
- **Resolution 2**: ~86,745.85 km² (state/province level)
- **Resolution 3**: ~12,392.26 km² (large city level)
- **Resolution 4**: ~1,770.32 km² (city level)
- **Resolution 5**: ~252.90 km² (district level)
- **Resolution 6**: ~36.13 km² (neighborhood level)
- **Resolution 7**: ~5.16 km² (block level)
- **Resolution 8**: ~0.74 km² (building level)
- **Resolution 9**: ~0.11 km² (building detail level)
- **Resolution 10**: ~0.015 km² (very detailed level)

## Supported Geometry Types

- **Points**: Direct conversion to containing H3 cell
- **Polygons/MultiPolygons**: Grid sampling within polygon bounds
- **LineStrings/MultiLineStrings**: Point sampling along the line
- **Other geometries**: Bounding box sampling

## Output

The script provides:

1. **H3 Indices**: List of H3 index strings for each geometry
2. **Visualizations**: Matplotlib plots of H3 boundaries
3. **Statistics**: Conversion metrics and area calculations
4. **Comparison Plots**: Side-by-side original vs H3 representation

## Example Output

```
Loaded shapefile with 150 features
CRS: EPSG:4326
Converted 150 features to 1,247 q!unique H3 indices

H3 Conversion Statistics:
  total_h3_indices: 1247
  h3_resolution: 8
  valid_polygons: 1247
  approximate_area_sq_meters: 923456.78
  approximate_area_sq_km: 0.92
  original_features: 150
```

## Requirements

- Python 3.7+
- GeoPandas
- H3
- Matplotlib
- NumPy
- Shapely
- Fiona
- PyProj
- Pandas

## Notes

q!- The script handles coordinate system transformations automatically
- H3 indices are returned as strings in hexadecimal format
- Visualization uses equal aspect ratio for accurate geographic representation
- Large shapefiles may take time to process depending on H3 resolution
- Higher H3 resolutions create more detailed but computationally expensive results

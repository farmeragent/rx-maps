import geopandas as gpd
from pathlib import Path
from absl import app
from absl import flags

FLAGS = flags.FLAGS

flags.DEFINE_multi_string('input', None, 'Input GeoJSON files to merge (can be specified multiple times)')
flags.DEFINE_string('output', 'merged.geojson', 'Output path for merged GeoJSON file')

# Mark input as required
flags.mark_flag_as_required('input')


def main(argv):
    del argv  # Unused

    if len(FLAGS.input) < 2:
        print("Warning: Only one input file specified. At least two files recommended for merging.")

    gdfs = []

    # Read each GeoJSON file and add field_name column
    for geojson_path in FLAGS.input:
        print(f"Reading: {geojson_path}")
        gdf = gpd.read_file(geojson_path)

        # Extract field name from filename (stem without extension)
        field_name = Path(geojson_path).stem
        gdf['field_name'] = field_name

        print(f"  → Loaded {len(gdf)} features (field_name: '{field_name}')")
        gdfs.append(gdf)

    # Concatenate all GeoDataFrames
    print(f"\nMerging {len(gdfs)} GeoJSON files...")
    merged_gdf = gpd.pd.concat(gdfs, ignore_index=True)

    # Write to output file
    print(f"Writing merged GeoJSON to: {FLAGS.output}")
    merged_gdf.to_file(FLAGS.output, driver='GeoJSON')

    print(f"\n✓ Successfully merged {len(merged_gdf)} total features to {FLAGS.output}")
    print(f"  → Input files: {len(FLAGS.input)}")
    print(f"  → Total features: {len(merged_gdf)}")


if __name__ == '__main__':
    app.run(main)

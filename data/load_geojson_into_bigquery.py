import json
import geopandas as gpd
from google.cloud import bigquery
from absl import app
from absl import flags

FLAGS = flags.FLAGS

flags.DEFINE_string('geojson', None, 'Path to the GeoJSON file to load')
flags.DEFINE_string('schema', 'bigquery_schema.json', 'Path to the schema JSON file')
flags.DEFINE_string('table_id', 'farm-pulse-478001.autaugafarms.hexes', 'BigQuery table ID (project.dataset.table)')

# Mark geojson as required
flags.mark_flag_as_required('geojson')


def main(argv):
    del argv  # Unused

    # Read your GeoJSON
    print(f"Loading GeoJSON from: {FLAGS.geojson}")
    gdf = gpd.read_file(FLAGS.geojson)

    # Convert geometry to Well-Known Text (WKT)
    gdf['geometry_wkt'] = gdf['geometry'].apply(lambda x: x.wkt if x else None)

    # Drop the original geometry column
    gdf = gdf.drop('geometry', axis=1)

    # Load schema with descriptions
    print(f"Loading schema from: {FLAGS.schema}")
    with open(FLAGS.schema, 'r') as f:
        schema_json = json.load(f)

    # Convert to BigQuery SchemaField objects
    schema = [
        bigquery.SchemaField(
            name=field['name'],
            field_type=field['type'],
            mode=field['mode'],
            description=field.get('description', '')
        )
        for field in schema_json
    ]

    # Verify all columns have schema descriptions
    dataframe_columns = set(gdf.columns)
    schema_columns = {field['name'] for field in schema_json}

    # Check for missing columns in schema
    missing_in_schema = dataframe_columns - schema_columns
    if missing_in_schema:
        raise ValueError(f"Columns in dataframe missing from schema: {missing_in_schema}")

    # Check for extra columns in schema
    extra_in_schema = schema_columns - dataframe_columns
    if extra_in_schema:
        print(f"Warning: Columns in schema not present in dataframe: {extra_in_schema}")

    # Check for missing or empty descriptions
    missing_descriptions = [
        field['name'] for field in schema_json
        if not field.get('description', '').strip()
    ]
    if missing_descriptions:
        raise ValueError(f"Columns missing descriptions in schema: {missing_descriptions}")

    print(f"✓ Schema validation passed: All {len(dataframe_columns)} columns have descriptions")

    # Upload to BigQuery with schema
    print(f"Uploading to BigQuery table: {FLAGS.table_id}")
    client = bigquery.Client()

    job_config = bigquery.LoadJobConfig(
        schema=schema,
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
    )

    job = client.load_table_from_dataframe(gdf, FLAGS.table_id, job_config=job_config)
    job.result()  # Wait for the job to complete

    print(f"✓ Successfully loaded {len(gdf)} rows to {FLAGS.table_id}")


if __name__ == '__main__':
    app.run(main)

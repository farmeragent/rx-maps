import { NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to update Mapbox tileset with edited yield values
 * 
 * This uses Mapbox Tiling Service (MTS) to create an incremental update (changeset)
 * that updates the yield_target values for specific features.
 * 
 * Requirements:
 * - MAPBOX_SECRET_TOKEN (secret token with tilesets:write scope)
 * - Tileset must have stable unique feature IDs
 * - Tileset ID format: username.tileset_id
 */

interface UpdateRequest {
  fieldName: string;
  editedFeatures: Array<{
    id: string;
    yield_target: number;
    geometry: any;
    properties: any;
  }>;
}

// Map field names to tileset IDs
const TILESET_IDS: Record<string, string> = {
  'North of Road': 'zeumer.bofg9ncj',
  'South of Road': 'zeumer.8d46889j',
  'Railroad Pivot': 'zeumer.2tepd0uh'
};

export async function POST(request: NextRequest) {
  try {
    const body: UpdateRequest = await request.json();
    const { fieldName, editedFeatures } = body;

    if (!fieldName || !editedFeatures || !Array.isArray(editedFeatures)) {
      return NextResponse.json(
        { error: 'Invalid request body. Expected fieldName and editedFeatures array.' },
        { status: 400 }
      );
    }

    const tilesetId = TILESET_IDS[fieldName];
    if (!tilesetId) {
      return NextResponse.json(
        { error: `Unknown field: ${fieldName}` },
        { status: 400 }
      );
    }

    const mapboxSecretToken = process.env.MAPBOX_SECRET_TOKEN;
    if (!mapboxSecretToken) {
      return NextResponse.json(
        { error: 'MAPBOX_SECRET_TOKEN not configured. This requires a secret token with tilesets:write scope.' },
        { status: 500 }
      );
    }

    // Create a GeoJSON FeatureCollection for the changeset
    const changesetFeatures = editedFeatures.map(feature => ({
      type: 'Feature' as const,
      id: feature.id,
      geometry: feature.geometry,
      properties: {
        ...feature.properties,
        yield_target: feature.yield_target
      }
    }));

    const changesetGeoJSON = {
      type: 'FeatureCollection' as const,
      features: changesetFeatures
    };

    // Upload changeset using Mapbox Tiling Service API
    // Note: This requires MTS to be enabled and the tileset to support incremental updates
    const response = await fetch(
      `https://api.mapbox.com/tilesets/v1/${tilesetId}/changesets?access_token=${mapboxSecretToken}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          changeset: changesetGeoJSON
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mapbox API error:', errorText);
      return NextResponse.json(
        { 
          error: 'Failed to update tileset',
          details: errorText
        },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json({
      success: true,
      changesetId: result.changeset_id,
      tilesetId,
      message: 'Tileset update initiated. It may take a few minutes to process.'
    });

  } catch (error) {
    console.error('Error updating tileset:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

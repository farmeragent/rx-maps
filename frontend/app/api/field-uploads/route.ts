import { NextRequest, NextResponse } from 'next/server';
import { getAll } from '@vercel/edge-config';

interface FieldUploads {
  [fieldName: string]: {
    yieldGoal: boolean;
    soilSample: boolean;
  };
}

const EDGE_CONFIG_KEY = 'field-uploads';

const defaultFieldUploads: FieldUploads = {
  'North of Road': { yieldGoal: true, soilSample: true },
  'South of Road': { yieldGoal: true, soilSample: true },
  'Railroad Pivot': { yieldGoal: true, soilSample: false }
};

async function getEdgeConfigValue(key: string): Promise<any> {
  try {
    const allItems = await getAll([key]);
    const value = allItems[key];
    
    if (!value) {
      return null;
    }
    
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (parseError) {
        return value;
      }
    }
    
    return value;
  } catch (error) {
    console.error('Error reading from Edge Config:', error);
    return null;
  }
}

export async function GET() {
  try {
    const uploads = await getEdgeConfigValue(EDGE_CONFIG_KEY);
    
    if (!uploads) {
      return NextResponse.json(defaultFieldUploads);
    }
    
    return NextResponse.json(uploads);
  } catch (error) {
    console.error('Error fetching field uploads:', error);
    return NextResponse.json(defaultFieldUploads, { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fieldName, uploadType, uploaded } = body;
    
    if (!fieldName || !uploadType || typeof uploaded !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    
    const currentUploads = await getEdgeConfigValue(EDGE_CONFIG_KEY) || defaultFieldUploads;
    
    const updatedUploads: FieldUploads = {
      ...currentUploads,
      [fieldName]: {
        ...currentUploads[fieldName],
        [uploadType]: uploaded
      }
    };
    
    // Update Edge Config
    const edgeConfigId = process.env.EDGE_CONFIG_ID;
    const edgeConfigToken = process.env.EDGE_CONFIG_TOKEN;
    
    if (!edgeConfigId || !edgeConfigToken) {
      return NextResponse.json({ error: 'Edge Config not configured' }, { status: 500 });
    }
    
    const response = await fetch(
      `https://api.vercel.com/v1/edge-config/${edgeConfigId}/items`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${edgeConfigToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          items: [
            {
              operation: 'upsert',
              key: EDGE_CONFIG_KEY,
              value: JSON.stringify(updatedUploads)
            }
          ]
        })
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error updating Edge Config:', errorText);
      return NextResponse.json({ error: 'Failed to update Edge Config' }, { status: 500 });
    }
    
    return NextResponse.json(updatedUploads);
  } catch (error) {
    console.error('Error updating field uploads:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


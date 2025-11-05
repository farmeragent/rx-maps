import { NextRequest, NextResponse } from 'next/server';
import { getAll } from '@vercel/edge-config';

const EDGE_CONFIG_KEY = 'nutrient-goals';

// Helper function to read from Edge Config using SDK
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

// Helper function to update Edge Config via REST API
async function updateEdgeConfig(key: string, value: any) {
  const token = process.env.VERCEL_MAIN_TOKEN;
  const edgeConfigId = process.env.EDGE_CONFIG_ID;
  
  if (!token || !edgeConfigId) {
    throw new Error('Missing VERCEL_MAIN_TOKEN or EDGE_CONFIG_ID');
  }
  
  let configValue: string | number | boolean | null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
    configValue = value;
  } else {
    configValue = JSON.stringify(value);
  }
  
  const response = await fetch(
    `https://api.vercel.com/v1/edge-config/${edgeConfigId}/items`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [
          {
            operation: 'upsert',
            key,
            value: configValue,
          },
        ],
      }),
    }
  );
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update Edge Config: ${errorText}`);
  }
  
  return response.json();
}

// GET - Fetch nutrient goals
export async function GET() {
  try {
    const value = await getEdgeConfigValue(EDGE_CONFIG_KEY);
    return NextResponse.json({ value: value || '' });
  } catch (error) {
    console.error('Error fetching nutrient goals from Edge Config:', error);
    return NextResponse.json({ value: '' });
  }
}

// POST - Save nutrient goals
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { value } = body as { value: string };
    
    if (value === undefined) {
      return NextResponse.json(
        { error: 'Missing value' },
        { status: 400 }
      );
    }
    
    await updateEdgeConfig(EDGE_CONFIG_KEY, value);
    
    return NextResponse.json({ success: true, value });
  } catch (error) {
    console.error('Error saving nutrient goals:', error);
    return NextResponse.json(
      { error: 'Failed to save nutrient goals' },
      { status: 500 }
    );
  }
}


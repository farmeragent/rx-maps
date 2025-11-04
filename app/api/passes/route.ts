import { NextRequest, NextResponse } from 'next/server';
import { getAll } from '@vercel/edge-config';

type Phase = 'pre-plant' | 'plant' | 'post-plant';

interface PassTile {
  id: string;
  passNumber: string;
  machine: string;
  fertilizerType: string;
}

interface PhaseData {
  passes: PassTile[];
}

type TimelineData = Record<Phase, PhaseData>;

const EDGE_CONFIG_KEY = 'fertility-timeline-data';

const defaultTimelineData: TimelineData = {
  'pre-plant': { passes: [] },
  'plant': { passes: [] },
  'post-plant': { passes: [] }
};

// Helper function to read from Edge Config using SDK
async function getEdgeConfigValue(key: string): Promise<any> {
  try {
    // getAll() reads from the EDGE_CONFIG environment variable connection string
    // If you pass a key array, it returns only those keys
    const allItems = await getAll([key]);
    const value = allItems[key];
    
    if (!value) {
      return null;
    }
    
    // If the value is a string that looks like JSON, parse it
    // Edge Config stores complex objects as JSON strings
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (parseError) {
        // If parsing fails, return the string as-is
        return value;
      }
    }
    
    // If it's already an object/number/boolean, return as-is
    return value;
  } catch (error) {
    console.error('Error reading from Edge Config:', error);
    return null;
  }
}

// Helper function to update Edge Config via REST API
// Reference: https://vercel.com/docs/edge-config/vercel-api#update-your-edge-config-items
async function updateEdgeConfig(key: string, value: any) {
  const token = process.env.VERCEL_MAIN_TOKEN;
  const edgeConfigId = process.env.EDGE_CONFIG_ID;
  
  if (!token || !edgeConfigId) {
    throw new Error('Missing VERCEL_MAIN_TOKEN or EDGE_CONFIG_ID');
  }
  
  // The value should be a string, number, boolean, or null
  // For complex objects, we need to stringify them
  let configValue: string | number | boolean | null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
    configValue = value;
  } else {
    // For objects/arrays, stringify them
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
    throw new Error(`Failed to update Edge Config: ${response.statusText} - ${errorText}`);
  }
  
  return response.json();
}

// GET - Fetch all passes
export async function GET() {
  try {
    const data = await getEdgeConfigValue(EDGE_CONFIG_KEY);
    
    if (!data) {
      console.log('No data found in Edge Config, returning default');
      return NextResponse.json(defaultTimelineData);
    }
    
    // Validate the data structure matches TimelineData
    if (typeof data === 'object' && data !== null) {
      // Ensure all phases exist with proper structure
      const validatedData: TimelineData = {
        'pre-plant': data['pre-plant'] && Array.isArray(data['pre-plant'].passes) 
          ? data['pre-plant'] 
          : { passes: [] },
        'plant': data['plant'] && Array.isArray(data['plant'].passes) 
          ? data['plant'] 
          : { passes: [] },
        'post-plant': data['post-plant'] && Array.isArray(data['post-plant'].passes) 
          ? data['post-plant'] 
          : { passes: [] },
      };
      
      console.log('Successfully fetched timeline data from Edge Config');
      return NextResponse.json(validatedData);
    }
    
    console.warn('Invalid data structure from Edge Config, returning default');
    return NextResponse.json(defaultTimelineData);
  } catch (error) {
    console.error('Error fetching passes from Edge Config:', error);
    return NextResponse.json(defaultTimelineData);
  }
}

// POST - Create a new pass
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phase, pass } = body as { phase: Phase; pass: PassTile };
    
    if (!phase || !pass) {
      return NextResponse.json(
        { error: 'Missing phase or pass data' },
        { status: 400 }
      );
    }
    
    const currentData = await getEdgeConfigValue(EDGE_CONFIG_KEY) || defaultTimelineData;
    
    const updatedData: TimelineData = {
      ...currentData,
      [phase]: {
        passes: [...currentData[phase].passes, pass]
      }
    };
    
    await updateEdgeConfig(EDGE_CONFIG_KEY, updatedData);
    
    return NextResponse.json(updatedData);
  } catch (error) {
    console.error('Error creating pass:', error);
    return NextResponse.json(
      { error: 'Failed to create pass' },
      { status: 500 }
    );
  }
}

// PUT - Update a pass
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { phase, passId, updates } = body as { 
      phase: Phase; 
      passId: string; 
      updates: Partial<PassTile> 
    };
    
    if (!phase || !passId || !updates) {
      return NextResponse.json(
        { error: 'Missing phase, passId, or updates' },
        { status: 400 }
      );
    }
    
    const currentData = await getEdgeConfigValue(EDGE_CONFIG_KEY) || defaultTimelineData;
    
    const updatedData: TimelineData = {
      ...currentData,
      [phase]: {
        passes: currentData[phase].passes.map((p: PassTile) =>
          p.id === passId ? { ...p, ...updates } : p
        )
      }
    };
    
    await updateEdgeConfig(EDGE_CONFIG_KEY, updatedData);
    
    return NextResponse.json(updatedData);
  } catch (error) {
    console.error('Error updating pass:', error);
    return NextResponse.json(
      { error: 'Failed to update pass' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a pass
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phase = searchParams.get('phase') as Phase;
    const passId = searchParams.get('passId');
    
    if (!phase || !passId) {
      return NextResponse.json(
        { error: 'Missing phase or passId' },
        { status: 400 }
      );
    }
    
    const currentData = await getEdgeConfigValue(EDGE_CONFIG_KEY) || defaultTimelineData;
    
    const updatedData: TimelineData = {
      ...currentData,
      [phase]: {
        passes: currentData[phase].passes.filter((p: PassTile) => p.id !== passId)
      }
    };
    
    await updateEdgeConfig(EDGE_CONFIG_KEY, updatedData);
    
    return NextResponse.json(updatedData);
  } catch (error) {
    console.error('Error deleting pass:', error);
    return NextResponse.json(
      { error: 'Failed to delete pass' },
      { status: 500 }
    );
  }
}


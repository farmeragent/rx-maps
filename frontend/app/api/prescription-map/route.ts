import { NextRequest, NextResponse } from 'next/server';

/**
 * API proxy route for prescription map backend
 * Proxies requests to the FastAPI backend
 */

const BACKEND_URL = process.env.QUERY_SERVICE_API_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { field_name } = body;

    // Build URL with query parameter
    const url = new URL(`${BACKEND_URL}/api/prescription-map`);
    if (field_name) {
      url.searchParams.append('field_name', field_name);
    }

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.detail || 'Failed to create prescription map' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to backend' },
      { status: 500 }
    );
  }
}

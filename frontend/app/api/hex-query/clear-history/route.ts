import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.QUERY_SERVICE_API_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/query/clear-history`, {
      method: 'POST'
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to clear history' },
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


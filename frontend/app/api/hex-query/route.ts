import { NextRequest, NextResponse } from 'next/server';

/**
 * API proxy route for hex query backend
 * Proxies requests to the FastAPI backend
 *
 * POST /api/hex-query - Submit a query
 * GET /api/hex-query?result_id=<uuid> - Fetch full results from cache
 */

const BACKEND_URL = process.env.QUERY_SERVICE_API_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resultId = searchParams.get('result_id');

    if (!resultId) {
      return NextResponse.json(
        { error: 'result_id parameter is required' },
        { status: 400 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/api/results/${resultId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.detail || 'Result not found' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Fetch result error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch result from backend' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${BACKEND_URL}/api/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.detail || 'Query failed' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // If result has a result_id but no full results, optionally fetch them
    // (For now, we'll let the frontend decide when to fetch)
    return NextResponse.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to backend' },
      { status: 500 }
    );
  }
}


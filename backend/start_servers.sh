#!/bin/bash
# Helper script to start both ADK and Custom API servers

# Set PYTHONPATH to include the farm-pulse directory
# This allows backend.agents.tools to import from backend.results_cache
export PYTHONPATH="/Users/davidevans/code/farm-pulse:$PYTHONPATH"

echo "🚀 Starting Farm Pulse Servers..."
echo ""

# Start ADK agent server in background
echo "Starting ADK Agent Server on port 8001..."
adk web --port 8001 &
ADK_PID=$!

# Wait a moment for ADK to start
sleep 2

# Start Custom API server in background
echo "Starting Custom API Server on port 8000..."
python server.py &
API_PID=$!

echo ""
echo "✅ Both servers started!"
echo ""
echo "📡 Endpoints:"
echo "   ADK Agent:  http://localhost:8001/run"
echo "   Custom API: http://localhost:8000/api/results/{uuid}"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Function to handle shutdown
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill $ADK_PID $API_PID 2>/dev/null
    echo "✅ Servers stopped"
    exit 0
}

# Trap Ctrl+C and call cleanup
trap cleanup INT

# Wait indefinitely
wait

#!/bin/bash
# Start MTG Leaderboard development servers

echo "🚀 Starting MTG Leaderboard development servers..."

# Start backend in background
echo "📦 Starting backend on port 7777..."
cd backend && uv run uvicorn app.main:app --reload --port 7777 &
BACKEND_PID=$!

# Start frontend in background
echo "⚛️  Starting frontend on port 5173..."
cd ../frontend && npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Servers started!"
echo "   Backend:  http://localhost:7777"
echo "   Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait

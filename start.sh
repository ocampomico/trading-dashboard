#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "Starting Trading Dashboard..."

cd backend
source venv/bin/activate
python -W ignore -m uvicorn main:app --port 8000 &
BACKEND_PID=$!
cd ..

cd frontend
npm start &
FRONTEND_PID=$!
cd ..

echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:3000"
echo "Press Ctrl+C to stop."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait

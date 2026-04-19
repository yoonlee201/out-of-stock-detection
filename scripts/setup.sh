#!/bin/bash

if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

docker compose -f compose.dev.yml down 2>/dev/null

# backend environment setup
if [ ! -f backend/.env ] || ! grep -q "BACKEND_PORT" backend/.env || ! grep -q "SQLALCHEMY_DATABASE_URI" backend/.env; then
    read -p "Enter backend port (default: 8000): " PORT
    PORT=${PORT:-8000}
    echo "Setting up backend on port $PORT..."
    {
        echo "BACKEND_PORT=$PORT"
        cat env/.env.example.back
    } > backend/.env
    echo "BACKEND_PORT=$PORT" > .env
    echo "Backend environment setup complete."
else
    echo "Backend environment already configured. Skipping setup."
    PORT=$(grep "^BACKEND_PORT=" backend/.env | cut -d= -f2)
    echo "BACKEND_PORT=${PORT:-8000}" > .env
fi

# frontend environment setup
if [ ! -f frontend/.env ] || ! grep -q "VITE_BACKEND_URL" frontend/.env; then
    PORT=$(grep "^BACKEND_PORT=" backend/.env | cut -d= -f2)
    PORT=${PORT:-8000}
    echo "Setting up frontend environment..."
    echo "VITE_BACKEND_URL=http://localhost:$PORT" > frontend/.env
    echo "Frontend environment setup complete."
else
    echo "Frontend environment already configured. Skipping setup."
fi

# Build and start all services in detached mode
echo "Building and starting services..."
if ! docker compose -f compose.dev.yml up --build -d; then
    echo "Failed to start services."
    exit 1
fi

# Wait for backend to become ready (up to 60 seconds)
echo "Waiting for backend to become ready..."
for i in $(seq 1 30); do
    if docker exec oos_detection-backend curl -sf http://localhost:8000/ > /dev/null 2>&1; then
        echo "Backend is ready."
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "Backend did not become ready in time. Check logs with:"
        echo "  docker compose -f compose.dev.yml logs backend"
        exit 1
    fi
    sleep 2
done

# Initialize database (create tables, optionally seed)
echo "Initializing database..."
read -p "Seed the database with sample data? [y/N]: " SEED_CHOICE
if [[ "$SEED_CHOICE" =~ ^[Yy]$ ]]; then
    docker exec oos_detection-backend python -m db.init_db --seed
else
    docker exec oos_detection-backend python -m db.init_db
fi

# Attach file-watch to the already-running services
echo "Starting watch mode (Ctrl+C to stop)..."
docker compose -f compose.dev.yml watch --no-up

#!/bin/bash

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if docker compose is down and clean up
docker compose -f compose.dev.yml down 2>/dev/null

# backend environment setup
if [ ! -f backend/.env ] || ! grep -q "BACKEND_PORT" backend/.env || ! grep -q "SQLALCHEMY_DATABASE_URI" backend/.env; then
    touch backend/.env
    # Set backend port in .env file and compose.dev.yml
    read -p "Enter backend port (default: 8000): " PORT
    PORT=${PORT:-8000}
    echo "Setting up backend on port $PORT... backend/.env and .env will be updated with the port you entered."

    # Setting env variable in backend/.env
    echo "BACKEND_PORT=$PORT" >> backend/.env
    cat env/.env.example.back >> backend/.env

    # Write BACKEND_PORT to root .env for docker compose variable substitution
    echo "BACKEND_PORT=$PORT" > .env

    echo "Backend environment setup complete."

    # frontend environment setup
    if [ ! -f frontend/.env ] || ! grep -q "VITE_BACKEND_URL" frontend/.env; then
        echo "Setting up frontend environment..."
        cp env/.env.example.front frontend/.env
        echo "VITE_BACKEND_URL=http://localhost:$PORT" >> frontend/.env
        echo "Frontend environment setup complete."
    else
        echo "Frontend environment already configured. Skipping setup."
    fi
else
    echo "Backend environment already configured. Skipping setup."
fi
if ! docker compose -f compose.dev.yml up --build -d; then
    echo "Docker compose failed. Cleaning up .env files..."
    rm -f backend/.env frontend/.env .env
    exit 1
fi

docker compose -f compose.dev.yml logs -f
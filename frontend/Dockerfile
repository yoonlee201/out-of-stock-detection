# syntax=docker/dockerfile:1
FROM node:22-alpine

WORKDIR /usr/src/app

# Copy package files first for efficient caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY . .

# Expose port used by Vite/Next/React dev server
# - Vite → 5173
EXPOSE 5173

# RUN npm run lint
RUN npm run build

# Run the dev server
CMD ["npm", "run", "dev"]
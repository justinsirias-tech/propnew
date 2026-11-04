# ==========================================
# Multi-Stage Production Dockerfile (100% Pure TypeScript & Node.js)
# Stage 1: Build React/Vite Frontend
# Stage 2: Build & Run Node.js / Express Backend
# ==========================================

FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Stage 2: Production TypeScript / Node.js Backend
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8000

# Install build dependencies for better-sqlite3 native compilation if needed
RUN apk add --no-cache python3 make g++

# Install backend dependencies
COPY backend/package*.json ./backend/
RUN npm install --prefix backend

# Copy backend source & compile TypeScript
COPY backend/ ./backend/
RUN npm run build --prefix backend

# Copy compiled frontend assets to frontend/dist for static SPA serving
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose web server port
EXPOSE 8000

# Start Node.js Express server
CMD ["sh", "-c", "node backend/dist/server.js"]

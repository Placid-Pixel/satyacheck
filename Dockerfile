# ============================================================
# SatyaCheck — AICTE Trust Layer Production Dockerfile
# Multi-stage build: Frontend Vite build + Backend FastAPI
# ============================================================

# --- Stage 1: Build Frontend ---
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# --- Stage 2: Production Python Backend ---
FROM python:3.12-slim AS runner

# Install essential system dependencies for OpenCV and PyMuPDF
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libzbar0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python requirements
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r ./backend/requirements.txt

# Copy Backend Code
COPY backend/ ./backend/

# Copy Frontend Built Distribution from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Set working directory to backend
WORKDIR /app/backend

# Create necessary storage directories
RUN mkdir -p storage/uploads storage/synthetic storage/processed

# Default environment configuration
ENV PYTHONUNBUFFERED=1 \
    PORT=8000 \
    FRONTEND_DIST=/app/frontend/dist

# Expose HTTP port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Seed baseline data and launch production ASGI server
CMD ["sh", "-c", "python scripts/seed_demo_data.py && uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]

# Multi-stage build: frontend -> backend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build


FROM node:20-alpine AS backend-builder

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --production


FROM node:20-alpine

# Install docker-cli for container discovery
RUN apk add --no-cache docker-cli

# Create non-root user (use 1001 to avoid conflicts)
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

WORKDIR /app

# Copy backend production dependencies
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY backend/ ./backend/

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./backend/public

# Copy config
COPY config.yaml ./

# Create directory for logs and give ownership to appuser
RUN mkdir -p /app/backend/logs && chown -R appuser:appgroup /app

USER 1001

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "backend/index.js"]
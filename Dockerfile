# Stage 1: Build & Prepare Dependencies
FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies for native compilation (better-sqlite3)
RUN apk add --no-cache python3 make g++

# Copy backend package files and install production dependencies
COPY backend/package.json backend/package-lock.json* ./backend/
WORKDIR /app/backend
RUN npm ci --only=production

# Stage 2: Final Minimal Runtime Image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy production node_modules from builder
COPY --from=builder /app/backend/node_modules ./backend/node_modules

# Copy application source code and frontend static assets
COPY backend/src ./backend/src
COPY backend/package.json ./backend/
COPY frontend ./frontend
COPY package.json ./

# Create data directory for SQLite persistence
RUN mkdir -p /app/backend/data

# Expose dynamic application port
EXPOSE 8080

# Start full-stack server
CMD ["node", "backend/src/server.js"]

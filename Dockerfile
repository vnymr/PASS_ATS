# Multi-stage build for production
FROM node:18-alpine AS builder

# Install system dependencies for LaTeX compilation
RUN apk add --no-cache \
    curl \
    ca-certificates \
    && curl -L https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.15.0/tectonic-0.15.0-x86_64-unknown-linux-musl.tar.gz \
    | tar -xz -C /usr/local/bin/

WORKDIR /app

# Copy package files
COPY server/package*.json ./server/
COPY package*.json ./

# Install dependencies
RUN cd server && npm ci --only=production

# Copy source code
COPY server/ ./server/
COPY extension/ ./extension/

# Production stage
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache curl ca-certificates

# Copy tectonic binary
COPY --from=builder /usr/local/bin/tectonic /usr/local/bin/

WORKDIR /app

# Copy built application
COPY --from=builder /app/server ./server
COPY --from=builder /app/extension ./extension

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "server/server.js"]

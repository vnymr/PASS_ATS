# Optimized Dockerfile for Railway deployment
FROM node:18-alpine AS builder

# Install tectonic for LaTeX compilation
RUN apk add --no-cache curl && \
    curl -L https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.15.0/tectonic-0.15.0-x86_64-unknown-linux-musl.tar.gz \
    | tar -xz -C /usr/local/bin/ && \
    apk del curl

# Production stage
FROM node:18-alpine

# Install runtime dependencies
RUN apk add --no-cache ca-certificates openssl curl

# Copy tectonic from builder
COPY --from=builder /usr/local/bin/tectonic /usr/local/bin/tectonic

WORKDIR /app

# Copy only necessary files for server
COPY server/package*.json ./server/
COPY server/prisma ./server/prisma/

# Install dependencies and generate Prisma client
WORKDIR /app/server
RUN npm install --production && \
    npx prisma generate && \
    npm cache clean --force

# Copy server code
COPY server/ ./

# Create required directories
RUN mkdir -p server/temp server/generated && \
    chmod 755 server/temp server/generated

# Set environment defaults
ENV NODE_ENV=production \
    PORT=8080

EXPOSE ${PORT}

# Health check - more robust with longer startup time
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=5 \
  CMD curl -f http://localhost:${PORT}/health || exit 1

WORKDIR /app/server

# Start server
CMD ["node", "server.js"]
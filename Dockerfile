# Simple single-stage build for Railway
FROM node:18-alpine

# Install system dependencies for LaTeX compilation
RUN apk add --no-cache curl ca-certificates && \
    curl -L https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.15.0/tectonic-0.15.0-x86_64-unknown-linux-musl.tar.gz \
    | tar -xz -C /usr/local/bin/

WORKDIR /app

# Copy all files
COPY . .

# Install server dependencies
RUN cd server && npm install

# Create temp directories
RUN mkdir -p server/temp server/generated

# Railway will set PORT env variable
EXPOSE ${PORT}

# Health check (Railway doesn't need this)
# HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
#   CMD curl -f http://localhost:${PORT}/health || exit 1

# Set working directory to server
WORKDIR /app/server

# Start the server
CMD ["node", "server.js"]
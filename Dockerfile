# Simple single-stage build for Railway
FROM node:18-alpine

# Install system dependencies for LaTeX compilation and Prisma
RUN apk add --no-cache curl ca-certificates openssl1.1-compat && \
    curl -L https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.15.0/tectonic-0.15.0-x86_64-unknown-linux-musl.tar.gz \
    | tar -xz -C /usr/local/bin/

WORKDIR /app

# Copy all files
COPY . .

# Install server dependencies and generate Prisma client
RUN cd server && npm install && \
    npx prisma generate

# Create temp directories
RUN mkdir -p server/temp server/generated

# Railway sets PORT dynamically - using 8080 as default
ENV PORT=8080
EXPOSE ${PORT}

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + process.env.PORT + '/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Set working directory to server
WORKDIR /app/server

# Start the server
CMD ["node", "server.js"]
# Optimized Dockerfile for Railway deployment
FROM node:18-alpine AS builder

# Install tectonic for LaTeX compilation
RUN apk add --no-cache curl && \
    curl -L https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.15.0/tectonic-0.15.0-x86_64-unknown-linux-musl.tar.gz \
    | tar -xz -C /usr/local/bin/ && \
    apk del curl

# Build frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./

# Set build-time environment variables for frontend
ENV VITE_API_URL=https://api.happyresumes.com
ENV VITE_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsuaGFwcHlyZXN1bWVzLmNvbSQ

RUN npm run build

# Production stage
FROM node:18-alpine

# Install Chromium and ALL dependencies for Playwright
# Critical: Alpine needs extra libs for headless Chromium to work
RUN apk add --no-cache \
    ca-certificates \
    openssl \
    curl \
    chromium \
    chromium-chromedriver \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ttf-freefont \
    font-noto-emoji \
    # Additional libs often missing in Alpine
    libstdc++ \
    mesa-gl \
    mesa-egl \
    libxcomposite \
    libxdamage \
    libxrandr \
    libxshmfence \
    libxkbcommon \
    pango \
    cairo \
    alsa-lib \
    cups-libs \
    dbus-libs \
    libdrm \
    libxfixes \
    at-spi2-core

# CRITICAL: Alpine uses musl libc, Playwright's bundled Chromium needs glibc
# We MUST use the system chromium package instead
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy tectonic from builder
COPY --from=builder /usr/local/bin/tectonic /usr/local/bin/tectonic

WORKDIR /app

# Copy built frontend from builder stage
COPY --from=builder /app/frontend/dist ./frontend/dist

# Copy only necessary files for server
COPY server/package*.json ./server/
COPY server/prisma ./server/prisma/
COPY server/scripts ./server/scripts/

# Install dependencies and generate Prisma client
# NOTE: We use system chromium (/usr/bin/chromium-browser) instead of Playwright's bundled browser
# because Alpine uses musl libc while Playwright's Chromium requires glibc
WORKDIR /app/server
RUN npm install --production && \
    npx prisma generate && \
    npm cache clean --force

# Copy rest of server code
COPY server/ ./

# Create required directories
RUN mkdir -p temp generated && \
    chmod 755 temp generated

# Set environment defaults
ENV NODE_ENV=production \
    PORT=8080 \
    TRUST_PROXY=true

EXPOSE ${PORT}

# Health check - more robust with longer startup time
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=5 \
  CMD curl -f http://localhost:${PORT}/health || exit 1

WORKDIR /app/server

# Run start script (handles migrations, server, and worker)
CMD node start.js
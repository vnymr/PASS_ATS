# Optimized Dockerfile for Railway deployment
# Using Debian-slim for better LibreOffice support
FROM node:18-slim AS builder

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
FROM node:18-slim

# Install Chromium, LibreOffice and dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    openssl \
    curl \
    gnupg \
    # Chromium dependencies
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    # LibreOffice for DOCX to PDF conversion
    libreoffice-writer-nogui \
    libreoffice-common \
    # Professional fonts for resumes
    fonts-dejavu \
    fonts-freefont-ttf \
    fonts-noto \
    fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Set browser and LibreOffice paths
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
ENV LIBREOFFICE_PATH=/usr/bin/soffice

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
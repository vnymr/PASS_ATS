FROM node:20-slim

# Install system dependencies for Playwright and LibreOffice
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
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
    libreoffice-writer \
    libreoffice-common \
    # Additional fonts for professional resumes
    fonts-dejavu \
    fonts-freefont-ttf \
    fonts-noto \
    && rm -rf /var/lib/apt/lists/*

# Set LibreOffice path
ENV LIBREOFFICE_PATH=/usr/bin/soffice

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (skip postinstall script for now)
RUN npm ci --only=production --ignore-scripts

# Install Playwright browsers (for fallback)
RUN npx playwright install chromium
RUN npx playwright install-deps chromium

# Generate Prisma client
RUN npx prisma generate

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); });"

# Start server
CMD ["npm", "start"]

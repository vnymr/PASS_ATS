FROM python:3.10-slim

# Install system dependencies for Firefox/Camoufox (includes GTK)
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    fontconfig \
    fonts-liberation \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libgtk-3-0 \
    libgtk-3-dev \
    libgdk-pixbuf-2.0-0 \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libdbus-glib-1-2 \
    libxt6 \
    libx11-xcb1 \
    xvfb \
    curl \
    socat \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip
RUN pip install --upgrade pip

# Set working directory
WORKDIR /app

# Copy requirements and install Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy and run the patch script to fix camoufox bug
COPY patch_camoufox.py .
RUN python patch_camoufox.py

# Download Camoufox browser binaries
RUN python -m camoufox fetch

# Copy server script
COPY server.py .

# Expose ports
# 3000-3004: Browser WebSocket ports (pool)
# 8080: Health check HTTP port
EXPOSE 3000 3001 3002 3003 3004 8080

# Environment variables with defaults
ENV BROWSER_POOL_SIZE=3
ENV HEALTH_PORT=8080
ENV BROWSER_PORT=3000
ENV CAMOUFOX_HEADLESS=true
ENV ENVIRONMENT=production

# Health check using the new HTTP endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/ready || exit 1

# Run the server
CMD ["python", "server.py"]

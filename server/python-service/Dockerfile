FROM python:3.10-slim

# Install system dependencies for Firefox (Camoufox is Firefox-based)
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
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip
RUN pip install --upgrade pip

# Install Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download Camoufox browser binaries
RUN python -m camoufox fetch

# Set working directory
WORKDIR /app

# Copy server script
COPY server.py .

# Expose WebSocket port
EXPOSE 3000

# Run the server
CMD ["python", "server.py"]

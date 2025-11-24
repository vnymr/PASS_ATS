# Camoufox Browser Microservice

This Python microservice provides a **Camoufox browser server** that the Node.js application connects to via WebSocket for maximum stealth in automated job applications.

## Why Camoufox?

Camoufox is a **Firefox-based anti-detect browser** with:
- **C++ Level Stealth**: Bot detection evasion at the browser core (not JavaScript)
- **Best-in-Class Detection Evasion**: Passes CreepJS and other advanced detection systems
- **Python-Only**: Requires this microservice architecture since it doesn't support Node.js natively

## Architecture

```
┌─────────────────────┐      WebSocket/CDP       ┌──────────────────────┐
│  Node.js App        │ ◄────────────────────►   │  Python Service      │
│  (Port 3000)        │                          │  (Port 3000)         │
│                     │                          │                      │
│ - All Logic         │    page.click('#btn')    │ - Camoufox Browser   │
│ - AI Form Filler    │ ─────────────────────►   │ - WebSocket Server   │
│ - Form Intelligence │                          │                      │
└─────────────────────┘                          └──────────────────────┘
```

## Files

- `server.py` - WebSocket server that launches Camoufox browser
- `Dockerfile` - Container configuration
- `requirements.txt` - Python dependencies

## Local Development

### Option 1: Docker Compose (Recommended)

```bash
# From /server directory
docker-compose up --build

# Node.js app will automatically connect to Python service
```

### Option 2: Run Python Service Standalone

```bash
# Install dependencies
pip install -r requirements.txt

# Download Camoufox browser binaries
python -m camoufox fetch

# Run server
python server.py
```

The server will start on `ws://localhost:3000/ws`

## Configuration

The Node.js application connects via environment variables:

```bash
USE_CAMOUFOX=true
CAMOUFOX_WS_ENDPOINT=ws://python-browser:3000/ws  # Docker Compose
# OR
CAMOUFOX_WS_ENDPOINT=ws://localhost:3000/ws       # Standalone
```

## Proxy Support

Proxies are configured in Node.js but run in this Python container:

```bash
# In Node.js .env
PROXY_SERVER=http://residential-proxy.com:80
PROXY_USERNAME=user
PROXY_PASSWORD=pass
```

When Node.js calls `browser.newContext({ proxy: {...} })`, Playwright automatically forwards the proxy configuration to this container.

## Production Deployment (Railway)

### Create Two Services

**1. Node.js Service** (existing)
- Root: `/server`
- Port: 3000

**2. Python Browser Service** (new)
- Root: `/server/python-service`
- Port: 3000 (internal)

### Configure Internal Networking

In Node.js service environment:
```bash
USE_CAMOUFOX=true
CAMOUFOX_WS_ENDPOINT=ws://python-browser.railway.internal:3000/ws
```

Railway provides internal DNS: `python-browser.railway.internal`

## Monitoring

### Health Check

```bash
# Docker health check runs every 30 seconds
python -c "import socket; s=socket.socket(); s.connect(('localhost', 3000))"
```

### Logs

```bash
# Docker Compose
docker-compose logs python-browser

# Railway
railway logs --service python-browser
```

## Troubleshooting

### Connection Refused

**Problem:** Node.js can't connect to Python service

**Solution:**
```bash
# Check if Python service is running
docker-compose ps

# Check logs
docker-compose logs python-browser

# Verify WebSocket endpoint
echo $CAMOUFOX_WS_ENDPOINT
```

### Browser Launch Fails

**Problem:** Camoufox browser won't start

**Solution:**
```bash
# Re-fetch browser binaries
docker-compose exec python-browser python -m camoufox fetch

# Check system dependencies
docker-compose exec python-browser dpkg -l | grep firefox
```

### Disconnections

**Problem:** Browser disconnects frequently

**Solution:**
- Add restart policy in docker-compose.yml (already configured)
- Increase connection timeout in browser-launcher.js
- Check network latency between services

## Performance

- **Memory**: ~400-600MB per browser instance
- **Startup**: ~5-10 seconds for first connection
- **Latency**: <50ms for commands (WebSocket)

## Dependencies

- **camoufox[geoip]**: Anti-detect browser with GeoIP support
- **playwright**: Browser automation framework
- **patchright**: Playwright patches for enhanced stealth

## Security

- Browser runs in isolated container
- No sensitive data stored in Python service
- All authentication/session management in Node.js
- Proxy credentials forwarded securely via CDP

## Maintenance

- **Update Camoufox**: `pip install --upgrade "camoufox[geoip]"`
- **Re-fetch Browser**: `python -m camoufox fetch`
- **Monitor GitHub**: Watch https://github.com/daijro/camoufox for updates

## Support

If Camoufox connection fails, the system automatically falls back to:
1. Browserless Cloud (if configured)
2. Local Playwright with stealth mode

Set `USE_CAMOUFOX=false` to disable Camoufox and use fallback.

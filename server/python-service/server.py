"""
Camoufox Remote Browser Server
Launches Camoufox in server mode for Node.js Playwright to connect to
"""

import os
import sys
from camoufox.server import launch_server

def main():
    print("🚀 Starting Camoufox Remote Browser Server...", flush=True)
    print(f"🔧 Environment: {os.getenv('ENVIRONMENT', 'development')}", flush=True)

    # Get configuration from environment
    port = int(os.getenv('CAMOUFOX_PORT', '3000'))
    ws_path = os.getenv('CAMOUFOX_WS_PATH', 'browser')
    headless = os.getenv('CAMOUFOX_HEADLESS', 'true').lower() == 'true'

    # Proxy configuration (optional)
    proxy_config = None
    if os.getenv('PROXY_SERVER'):
        proxy_config = {
            'server': os.getenv('PROXY_SERVER'),
        }
        if os.getenv('PROXY_USERNAME'):
            proxy_config['username'] = os.getenv('PROXY_USERNAME')
        if os.getenv('PROXY_PASSWORD'):
            proxy_config['password'] = os.getenv('PROXY_PASSWORD')

    print(f"📡 Launching server on ws://0.0.0.0:{port}/{ws_path}", flush=True)
    print(f"🦊 Headless: {headless}", flush=True)
    print(f"🌍 GeoIP: enabled", flush=True)
    if proxy_config:
        print(f"🔐 Proxy: {proxy_config['server']}", flush=True)

    try:
        # Launch Camoufox remote server
        # This blocks forever - Node.js can connect to ws://host:port/ws_path

        # Build launch arguments (only include proxy if configured)
        launch_args = {
            'headless': headless,
            'geoip': True,  # Enable realistic IP geolocation
            'port': port,
            'ws_path': ws_path,
            'os': None,  # Auto-detect OS for best fingerprint
            'addons': [],
        }

        # Only add proxy if it's configured (Camoufox doesn't accept None)
        if proxy_config:
            launch_args['proxy'] = proxy_config

        launch_server(**launch_args)

        print("✅ Camoufox server started successfully", flush=True)
        print(f"📞 Node.js can connect to: ws://localhost:{port}/{ws_path}", flush=True)
        print("⏳ Server will run indefinitely...", flush=True)

    except KeyboardInterrupt:
        print("\n🔌 Shutting down Camoufox server...", flush=True)
        sys.exit(0)
    except Exception as e:
        print(f"❌ Failed to start server: {e}", flush=True)
        sys.exit(1)

if __name__ == "__main__":
    main()

"""
Camoufox Remote Browser Server
Launches Camoufox in server mode for Node.js Playwright to connect to
"""

import os
import sys
import time

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

    # GeoIP requires proxy configuration in some versions
    # Disable geoip if no proxy is configured to avoid "proxy: expected object, got null" error
    use_geoip = os.getenv('CAMOUFOX_GEOIP', 'false').lower() == 'true'
    if use_geoip and not proxy_config:
        print("⚠️  GeoIP requested but no proxy configured - disabling GeoIP to avoid errors", flush=True)
        use_geoip = False

    print(f"📡 Launching server on ws://0.0.0.0:{port}/{ws_path}", flush=True)
    print(f"🦊 Headless: {headless}", flush=True)
    print(f"🌍 GeoIP: {'enabled' if use_geoip else 'disabled'}", flush=True)
    if proxy_config:
        print(f"🔐 Proxy: {proxy_config['server']}", flush=True)

    max_retries = 3
    retry_count = 0

    while retry_count < max_retries:
        try:
            # Import here to catch import errors
            from camoufox.server import launch_server

            # Build launch arguments (only include optional params if configured)
            launch_args = {
                'headless': headless,
                'port': port,
                'ws_path': ws_path,
            }

            # Only add geoip if proxy is configured (geoip internally uses proxy)
            if use_geoip and proxy_config:
                launch_args['geoip'] = True
                launch_args['proxy'] = proxy_config
            elif proxy_config:
                # Proxy without geoip
                launch_args['proxy'] = proxy_config

            # Debug: Show what we're passing
            print(f"📋 Launch arguments: {list(launch_args.keys())}", flush=True)
            print("Launching server...", flush=True)

            launch_server(**launch_args)

            print("✅ Camoufox server started successfully", flush=True)
            print(f"📞 Node.js can connect to: ws://localhost:{port}/{ws_path}", flush=True)
            print("⏳ Server will run indefinitely...", flush=True)
            break  # Success, exit retry loop

        except KeyboardInterrupt:
            print("\n🔌 Shutting down Camoufox server...", flush=True)
            sys.exit(0)
        except Exception as e:
            error_msg = str(e)
            print(f"Error launching server: {error_msg}", flush=True)

            # Check if this is the proxy error - try without geoip
            if 'proxy' in error_msg.lower() and use_geoip:
                print("⚠️  Proxy-related error detected, retrying without GeoIP...", flush=True)
                use_geoip = False
                retry_count += 1
                time.sleep(1)
                continue

            print(f"❌ Failed to start server: {e}", flush=True)
            retry_count += 1

            if retry_count < max_retries:
                print(f"🔄 Retrying ({retry_count}/{max_retries})...", flush=True)
                time.sleep(2)
            else:
                print("❌ Max retries exceeded, exiting...", flush=True)
                sys.exit(1)

if __name__ == "__main__":
    main()

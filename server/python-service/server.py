"""
Camoufox Remote Browser Server
Launches Camoufox in server mode for Node.js Playwright to connect to

Tries multiple approaches to launch the server:
1. Python launch_server API
2. CLI subprocess as fallback
"""

import os
import sys
import time
import subprocess

def launch_via_cli(port, ws_path, headless):
    """Launch camoufox server via CLI as fallback"""
    print("🔄 Attempting CLI launch method...", flush=True)

    cmd = [
        sys.executable, "-m", "camoufox", "server",
        "--port", str(port),
        "--ws-path", ws_path,
    ]

    if headless:
        cmd.append("--headless")

    print(f"📋 CLI command: {' '.join(cmd)}", flush=True)

    # Run the CLI command - this should block
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )

    # Stream output
    for line in process.stdout:
        print(line.rstrip(), flush=True)

    return process.wait()

def launch_via_api(port, ws_path, headless, proxy_config, use_geoip):
    """Launch camoufox server via Python API"""
    from camoufox.server import launch_server

    # Build launch arguments
    launch_args = {
        'headless': headless,
        'port': port,
        'ws_path': ws_path,
    }

    # Configure proxy if provided
    if proxy_config:
        launch_args['proxy'] = proxy_config
        if use_geoip:
            launch_args['geoip'] = True

    print(f"📋 Launch arguments: {list(launch_args.keys())}", flush=True)
    print("Launching server...", flush=True)

    launch_server(**launch_args)

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

    # GeoIP - only with proxy
    use_geoip = os.getenv('CAMOUFOX_GEOIP', 'false').lower() == 'true'
    if use_geoip and not proxy_config:
        print("⚠️  GeoIP requested but no proxy configured - disabling GeoIP", flush=True)
        use_geoip = False

    print(f"📡 Launching server on ws://0.0.0.0:{port}/{ws_path}", flush=True)
    print(f"🦊 Headless: {headless}", flush=True)
    print(f"🌍 GeoIP: {'enabled' if use_geoip else 'disabled'}", flush=True)
    if proxy_config:
        print(f"🔐 Proxy: {proxy_config['server']}", flush=True)

    # Try Python API first, then CLI as fallback
    methods = [
        ("Python API", lambda: launch_via_api(port, ws_path, headless, proxy_config, use_geoip)),
        ("CLI subprocess", lambda: launch_via_cli(port, ws_path, headless)),
    ]

    for method_name, launch_func in methods:
        print(f"\n🔄 Trying {method_name} method...", flush=True)

        max_retries = 2
        retry_count = 0

        while retry_count < max_retries:
            try:
                launch_func()
                print(f"✅ Camoufox server started successfully via {method_name}!", flush=True)
                return  # Success

            except KeyboardInterrupt:
                print("\n🔌 Shutting down Camoufox server...", flush=True)
                sys.exit(0)
            except Exception as e:
                error_msg = str(e)
                print(f"Error with {method_name}: {error_msg}", flush=True)
                retry_count += 1

                if retry_count < max_retries:
                    print(f"🔄 Retrying {method_name} ({retry_count}/{max_retries})...", flush=True)
                    time.sleep(2)
                else:
                    print(f"❌ {method_name} failed after {max_retries} attempts", flush=True)
                    break

    # All methods failed
    print("\n❌ All launch methods failed. Exiting...", flush=True)
    print("\nPossible solutions:", flush=True)
    print("  1. Check if all dependencies are installed: pip install 'camoufox[geoip]'", flush=True)
    print("  2. Re-fetch browser binaries: python -m camoufox fetch", flush=True)
    print("  3. Check for camoufox updates: pip install --upgrade camoufox", flush=True)
    sys.exit(1)

if __name__ == "__main__":
    main()

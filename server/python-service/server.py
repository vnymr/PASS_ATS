"""
Camoufox Remote Browser Server - Production Ready
Launches Camoufox browser pool for Node.js Playwright to connect to

Features:
- HTTP health endpoint for container health checks
- Browser pool for concurrent applications
- Fixed WebSocket endpoints for service discovery
- Graceful shutdown handling
"""

import os
import sys
import re
import asyncio
import subprocess
import signal
import json
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from threading import Thread
from datetime import datetime, timezone
from typing import Optional, Dict, List

# Configuration
ENDPOINT_FILE = Path("/tmp/camoufox_endpoint.txt")
HEALTH_PORT = int(os.getenv('HEALTH_PORT', '9090'))  # Health check endpoint
BROWSER_PORT = int(os.getenv('BROWSER_PORT', '8080'))  # Browser WebSocket - NOT 3000 (Node server uses 3000)
POOL_SIZE = int(os.getenv('BROWSER_POOL_SIZE', '3'))
ENVIRONMENT = os.getenv('ENVIRONMENT', 'development')
# Hostname to advertise for WebSocket connections (for Railway internal networking)
ADVERTISE_HOST = os.getenv('ADVERTISE_HOST', 'localhost')

# Global state
browser_pool: Dict[str, dict] = {}
socat_processes: List[subprocess.Popen] = []
server_ready = False
shutdown_requested = False


class HealthHandler(BaseHTTPRequestHandler):
    """HTTP handler for health checks and metrics"""

    def log_message(self, format, *args):
        # Suppress default logging to reduce noise
        pass

    def do_GET(self):
        if self.path == '/health' or self.path == '/healthz':
            self._handle_health()
        elif self.path == '/ready' or self.path == '/readiness':
            self._handle_ready()
        elif self.path == '/metrics':
            self._handle_metrics()
        elif self.path == '/browsers':
            self._handle_browsers()
        else:
            self.send_response(404)
            self.end_headers()

    def _handle_health(self):
        """Liveness probe - is the service running?"""
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        response = {
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'service': 'camoufox-browser',
            'version': '2.0.0'
        }
        self.wfile.write(json.dumps(response).encode())

    def _handle_ready(self):
        """Readiness probe - is the service ready to accept traffic?"""
        if server_ready and len(browser_pool) > 0:
            self.send_response(200)
            status = 'ready'
        else:
            self.send_response(503)
            status = 'not_ready'

        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        response = {
            'status': status,
            'browsers_available': len([b for b in browser_pool.values() if b.get('status') == 'ready']),
            'browsers_total': len(browser_pool),
            'pool_size': POOL_SIZE
        }
        self.wfile.write(json.dumps(response).encode())

    def _handle_metrics(self):
        """Prometheus-style metrics endpoint"""
        self.send_response(200)
        self.send_header('Content-Type', 'text/plain')
        self.end_headers()

        ready_count = len([b for b in browser_pool.values() if b.get('status') == 'ready'])
        busy_count = len([b for b in browser_pool.values() if b.get('status') == 'busy'])

        metrics = f"""# HELP camoufox_browsers_total Total number of browser instances
# TYPE camoufox_browsers_total gauge
camoufox_browsers_total {len(browser_pool)}

# HELP camoufox_browsers_ready Number of ready browser instances
# TYPE camoufox_browsers_ready gauge
camoufox_browsers_ready {ready_count}

# HELP camoufox_browsers_busy Number of busy browser instances
# TYPE camoufox_browsers_busy gauge
camoufox_browsers_busy {busy_count}

# HELP camoufox_pool_size Configured pool size
# TYPE camoufox_pool_size gauge
camoufox_pool_size {POOL_SIZE}
"""
        self.wfile.write(metrics.encode())

    def _handle_browsers(self):
        """List all browser endpoints"""
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()

        def rewrite_endpoint(endpoint):
            """Replace localhost with ADVERTISE_HOST for external access"""
            if endpoint and ADVERTISE_HOST != 'localhost':
                # ADVERTISE_HOST can be "hostname" or "hostname:port"
                # If it includes a port, replace the entire host:port part
                if ':' in ADVERTISE_HOST:
                    # Extract just the path from the original endpoint
                    # ws://localhost:3000/sessionid -> ws://newhost:newport/sessionid
                    import re
                    path_match = re.search(r'(wss?://)([^/]+)(/.+)?', endpoint)
                    if path_match:
                        protocol = path_match.group(1)
                        path = path_match.group(3) or ''
                        return f"{protocol}{ADVERTISE_HOST}{path}"
                else:
                    return endpoint.replace('localhost', ADVERTISE_HOST).replace('127.0.0.1', ADVERTISE_HOST)
            return endpoint

        browsers = []
        for browser_id, info in browser_pool.items():
            browsers.append({
                'id': browser_id,
                'endpoint': rewrite_endpoint(info.get('endpoint')),
                'status': info.get('status', 'unknown'),
                'started_at': info.get('started_at')
            })

        response = {
            'browsers': browsers,
            'primary_endpoint': rewrite_endpoint(browser_pool.get('browser_0', {}).get('endpoint'))
        }
        self.wfile.write(json.dumps(response).encode())


def start_health_server():
    """Start HTTP health check server in background thread"""
    server = HTTPServer(('0.0.0.0', HEALTH_PORT), HealthHandler)
    print(f"Health server started on port {HEALTH_PORT}", flush=True)
    server.serve_forever()


def start_socat_proxy(proxy_port: int, target_port: int, browser_id: str) -> Optional[subprocess.Popen]:
    """Start socat to proxy from 0.0.0.0:proxy_port to localhost:target_port"""
    try:
        # socat forwards TCP connections from external port to internal localhost port
        process = subprocess.Popen(
            ['socat', f'TCP-LISTEN:{proxy_port},fork,reuseaddr,bind=0.0.0.0', f'TCP:localhost:{target_port}'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        print(f"[{browser_id}] socat proxy started: 0.0.0.0:{proxy_port} -> localhost:{target_port}", flush=True)
        socat_processes.append(process)
        return process
    except Exception as e:
        print(f"[{browser_id}] Failed to start socat proxy: {e}", flush=True)
        return None


def launch_browser_instance(browser_id: str, port: int, headless: bool = True) -> Optional[subprocess.Popen]:
    """Launch a single Camoufox browser instance"""
    from camoufox.server import launch_options, get_nodejs, to_camel_case_dict, LAUNCH_SCRIPT
    import base64
    import orjson
    import hashlib

    # Build launch arguments - OPTIMAL CONFIGURATION
    # See: https://camoufox.com/python/usage/
    #
    # Key features:
    # - humanize: C++ level cursor simulation (undetectable)
    # - disable_coop: Allow cross-origin iframes (Cloudflare Turnstile)
    # - block_webrtc: Prevent IP leaks when using proxy
    # - os: Match operating system to proxy country for consistency
    #
    launch_args = {
        'headless': headless,
        'humanize': 2.0,  # C++ cursor movement, max 2 seconds (more realistic than default 1.5)
        'disable_coop': True,  # CRITICAL: Allow Cloudflare Turnstile iframes
        'block_webrtc': True,  # Prevent WebRTC IP leaks (important with proxy)
        'os': ['windows', 'macos'],  # Randomize between common OS (not linux - less common)
        'i_know_what_im_doing': True,  # Acknowledge disable_coop warning
    }

    # Configure proxy if provided
    # Support both PROXY_SERVER (full URL) and PROXY_HOST+PROXY_PORT (separate)
    proxy_server = os.getenv('PROXY_SERVER')
    if not proxy_server:
        proxy_host = os.getenv('PROXY_HOST')
        proxy_port = os.getenv('PROXY_PORT')
        if proxy_host and proxy_port:
            proxy_server = f"http://{proxy_host}:{proxy_port}"

    if proxy_server:
        proxy_username = os.getenv('PROXY_USERNAME')
        proxy_password = os.getenv('PROXY_PASSWORD')
        proxy_country = os.getenv('PROXY_COUNTRY', 'us')

        # Create sticky session password for iproyal
        # IPRoyal format: password_country-XX_session-XXXXXXXX_lifetime-30m
        # Session ID must be exactly 8 alphanumeric characters
        # This ensures each browser instance gets a consistent IP for the session lifetime
        if proxy_password:
            # Generate 8-char session ID from browser_id hash
            session_id = hashlib.md5(browser_id.encode()).hexdigest()[:8]
            sticky_password = f"{proxy_password}_country-{proxy_country}_session-{session_id}_lifetime-30m"
            print(f"[{browser_id}] Using sticky proxy session: {session_id} (30min lifetime)", flush=True)
        else:
            sticky_password = proxy_password

        proxy_config = {'server': proxy_server}
        if proxy_username:
            proxy_config['username'] = proxy_username
        if sticky_password:
            proxy_config['password'] = sticky_password
        launch_args['proxy'] = proxy_config

        # GeoIP is enabled by default when using proxy
        # This auto-matches timezone, locale, and geolocation to proxy IP
        # Can be disabled with CAMOUFOX_GEOIP=false
        if os.getenv('CAMOUFOX_GEOIP', 'true').lower() == 'true':
            launch_args['geoip'] = True
            print(f"[{browser_id}] GeoIP enabled - auto-matching location to proxy IP", flush=True)

        print(f"[{browser_id}] Proxy configured: {proxy_server} (country: {proxy_country})", flush=True)

    try:
        config = launch_options(**launch_args)
        nodejs = get_nodejs()
        data = orjson.dumps(to_camel_case_dict(config))

        # Launch browser process
        process = subprocess.Popen(
            [nodejs, str(LAUNCH_SCRIPT)],
            cwd=Path(nodejs).parent / "package",
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )

        if process.stdin:
            process.stdin.write(base64.b64encode(data).decode())
            process.stdin.close()

        # Capture WebSocket endpoint
        ws_endpoint = None
        for line in process.stdout:
            if not shutdown_requested:
                print(f"[{browser_id}] {line.rstrip()}", flush=True)

            if 'ws://' in line or 'wss://' in line:
                match = re.search(r'(wss?://[^\s\x1b]+)', line)
                if match:
                    ws_endpoint = match.group(1).strip()

                    # Extract the dynamic port from the endpoint
                    port_match = re.search(r':(\d+)/', ws_endpoint)
                    if port_match:
                        dynamic_port = int(port_match.group(1))
                        # Extract browser index for fixed proxy port
                        browser_index = int(browser_id.split('_')[1])
                        proxy_port = BROWSER_PORT + browser_index  # 3000, 3001, 3002...

                        # Try to start socat proxy to forward external connections
                        socat_proc = start_socat_proxy(proxy_port, dynamic_port, browser_id)

                        # Use proxied endpoint if socat succeeded, otherwise use dynamic endpoint directly
                        if socat_proc:
                            # socat proxy is running - use fixed port
                            path = ws_endpoint.split('/', 3)[-1] if ws_endpoint.count('/') >= 3 else ''
                            final_endpoint = f"ws://localhost:{proxy_port}/{path}"
                            print(f"[{browser_id}] Ready at: {final_endpoint} (proxied from {dynamic_port})", flush=True)
                        else:
                            # socat not available - use dynamic endpoint directly
                            final_endpoint = ws_endpoint
                            print(f"[{browser_id}] Ready at: {final_endpoint} (direct, no socat)", flush=True)

                        browser_pool[browser_id] = {
                            'endpoint': final_endpoint,
                            'original_endpoint': ws_endpoint,
                            'proxy_port': proxy_port if socat_proc else None,
                            'dynamic_port': dynamic_port,
                            'process': process,
                            'status': 'ready',
                            'started_at': datetime.now(timezone.utc).isoformat()
                        }
                    else:
                        # Fallback if port extraction fails
                        browser_pool[browser_id] = {
                            'endpoint': ws_endpoint,
                            'process': process,
                            'status': 'ready',
                            'started_at': datetime.now(timezone.utc).isoformat()
                        }
                        print(f"[{browser_id}] Ready at: {ws_endpoint}", flush=True)

                    # Write primary endpoint to file for backward compatibility
                    if browser_id == 'browser_0':
                        ENDPOINT_FILE.write_text(browser_pool[browser_id]['endpoint'])
                        print(f"Primary endpoint written to: {ENDPOINT_FILE}", flush=True)
                    break

        return process

    except Exception as e:
        print(f"[{browser_id}] Failed to launch: {e}", flush=True)
        return None


def cleanup_browsers():
    """Gracefully shutdown all browser instances and socat proxies"""
    global shutdown_requested
    shutdown_requested = True

    print("\nShutting down browser pool...", flush=True)

    # Terminate browser processes
    for browser_id, info in browser_pool.items():
        process = info.get('process')
        if process and process.poll() is None:
            print(f"Terminating {browser_id}...", flush=True)
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()

    # Terminate socat proxies
    print("Shutting down socat proxies...", flush=True)
    for socat_proc in socat_processes:
        if socat_proc and socat_proc.poll() is None:
            socat_proc.terminate()
            try:
                socat_proc.wait(timeout=2)
            except subprocess.TimeoutExpired:
                socat_proc.kill()

    # Clean up endpoint file
    if ENDPOINT_FILE.exists():
        ENDPOINT_FILE.unlink()

    print("Cleanup complete", flush=True)


def signal_handler(signum, frame):
    """Handle shutdown signals"""
    cleanup_browsers()
    sys.exit(0)


def main():
    global server_ready

    print("=" * 60, flush=True)
    print("Camoufox Browser Pool Server v2.0.0", flush=True)
    print("=" * 60, flush=True)
    print(f"Environment: {ENVIRONMENT}", flush=True)
    print(f"Pool Size: {POOL_SIZE}", flush=True)
    print(f"Health Port: {HEALTH_PORT}", flush=True)
    print(f"Browser Port: {BROWSER_PORT}", flush=True)
    print(f"Advertise Host: {ADVERTISE_HOST}", flush=True)

    headless = os.getenv('CAMOUFOX_HEADLESS', 'true').lower() == 'true'
    print(f"Headless Mode: {headless}", flush=True)

    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Start health server in background
    health_thread = Thread(target=start_health_server, daemon=True)
    health_thread.start()

    print("\nLaunching browser pool...", flush=True)

    # Launch browser pool
    processes = []
    for i in range(POOL_SIZE):
        browser_id = f"browser_{i}"
        port = BROWSER_PORT + i
        print(f"\nStarting {browser_id}...", flush=True)

        process = launch_browser_instance(browser_id, port, headless)
        if process:
            processes.append(process)

        # Small delay between launches to avoid resource contention
        if i < POOL_SIZE - 1:
            import time
            time.sleep(2)

    if not processes:
        print("ERROR: No browsers launched successfully!", flush=True)
        sys.exit(1)

    server_ready = True
    print(f"\n{'=' * 60}", flush=True)
    print(f"Browser pool ready! {len(processes)}/{POOL_SIZE} instances running", flush=True)
    print(f"Health endpoint: http://localhost:{HEALTH_PORT}/health", flush=True)
    print(f"Primary browser: {browser_pool.get('browser_0', {}).get('endpoint')}", flush=True)
    print(f"{'=' * 60}\n", flush=True)

    # Wait for all processes
    try:
        for process in processes:
            process.wait()
    except KeyboardInterrupt:
        pass
    finally:
        cleanup_browsers()


if __name__ == "__main__":
    main()

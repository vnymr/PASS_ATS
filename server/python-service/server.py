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
from datetime import datetime
from typing import Optional, Dict, List

# Configuration
ENDPOINT_FILE = Path("/tmp/camoufox_endpoint.txt")
HEALTH_PORT = int(os.getenv('HEALTH_PORT', '8080'))
BROWSER_PORT = int(os.getenv('BROWSER_PORT', '3000'))
POOL_SIZE = int(os.getenv('BROWSER_POOL_SIZE', '3'))
ENVIRONMENT = os.getenv('ENVIRONMENT', 'development')
# Hostname to advertise for WebSocket connections (for Railway internal networking)
ADVERTISE_HOST = os.getenv('ADVERTISE_HOST', 'localhost')

# Global state
browser_pool: Dict[str, dict] = {}
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


def launch_browser_instance(browser_id: str, port: int, headless: bool = True) -> Optional[subprocess.Popen]:
    """Launch a single Camoufox browser instance"""
    from camoufox.server import launch_options, get_nodejs, to_camel_case_dict, LAUNCH_SCRIPT
    import base64
    import orjson

    # Build launch arguments
    launch_args = {
        'headless': headless,
    }

    # Configure proxy if provided
    proxy_server = os.getenv('PROXY_SERVER')
    if proxy_server:
        proxy_config = {'server': proxy_server}
        if os.getenv('PROXY_USERNAME'):
            proxy_config['username'] = os.getenv('PROXY_USERNAME')
        if os.getenv('PROXY_PASSWORD'):
            proxy_config['password'] = os.getenv('PROXY_PASSWORD')
        launch_args['proxy'] = proxy_config

        if os.getenv('CAMOUFOX_GEOIP', 'false').lower() == 'true':
            launch_args['geoip'] = True

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
                    browser_pool[browser_id] = {
                        'endpoint': ws_endpoint,
                        'process': process,
                        'status': 'ready',
                        'started_at': datetime.utcnow().isoformat()
                    }
                    print(f"[{browser_id}] Ready at: {ws_endpoint}", flush=True)

                    # Write primary endpoint to file for backward compatibility
                    if browser_id == 'browser_0':
                        ENDPOINT_FILE.write_text(ws_endpoint)
                        print(f"Primary endpoint written to: {ENDPOINT_FILE}", flush=True)
                    break

        return process

    except Exception as e:
        print(f"[{browser_id}] Failed to launch: {e}", flush=True)
        return None


def cleanup_browsers():
    """Gracefully shutdown all browser instances"""
    global shutdown_requested
    shutdown_requested = True

    print("\nShutting down browser pool...", flush=True)

    for browser_id, info in browser_pool.items():
        process = info.get('process')
        if process and process.poll() is None:
            print(f"Terminating {browser_id}...", flush=True)
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()

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

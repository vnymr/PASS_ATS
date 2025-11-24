import asyncio
import os
from playwright.async_api import async_playwright
from camoufox.async_api import AsyncCamoufox

async def main():
    print("🚀 Starting Camoufox Stealth Server...")
    print(f"🔧 Environment: {os.getenv('ENVIRONMENT', 'development')}")

    # Launch Camoufox with stealth configuration
    async with AsyncCamoufox(headless=True, geoip=True) as camoufox:
        # Start browser server on port 3000
        # This creates a WebSocket endpoint that Node.js can connect to
        browser_server = await camoufox.browser_type.launch_server(
            port=3000,
            ws_path="ws",  # WebSocket endpoint will be ws://host:3000/ws
            headless=True  # Camoufox handles stealth even in headless mode
        )

        print(f"✅ Server listening at: {browser_server.ws_endpoint}")
        print("📡 Waiting for Node.js connections...")

        # Keep the server alive indefinitely
        # This prevents the container from exiting
        await asyncio.Future()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n⚠️ Server shutting down...")
    except Exception as e:
        print(f"❌ Server error: {e}")
        raise

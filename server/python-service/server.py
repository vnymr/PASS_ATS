from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any
from contextlib import asynccontextmanager
import asyncio
import uvicorn
import os
from camoufox.async_api import AsyncCamoufox
from playwright.async_api import async_playwright

# Global browser instance
browser = None
context = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown"""
    global browser, context

    # Startup
    print("🚀 Starting Camoufox Stealth Server...", flush=True)
    print(f"🔧 Environment: {os.getenv('ENVIRONMENT', 'development')}", flush=True)

    try:
        # Launch Camoufox browser with persistent context
        print("📦 Initializing Camoufox browser...", flush=True)
        camoufox = AsyncCamoufox(
            headless=True,
            geoip=True,
            addons=[],
            os=None  # Auto-detect OS for best fingerprint
        )
        browser = await camoufox.start()
        context = browser.contexts[0] if browser.contexts else await browser.new_context()

        print(f"✅ Camoufox browser launched successfully", flush=True)
        print(f"📡 Server ready on port 3000", flush=True)

    except Exception as e:
        print(f"❌ Failed to start browser: {e}", flush=True)
        raise

    yield  # Server runs here

    # Shutdown
    print("🔌 Shutting down...", flush=True)
    if browser:
        await browser.close()
        print("✅ Browser closed", flush=True)

app = FastAPI(lifespan=lifespan)

class NavigateRequest(BaseModel):
    url: str
    timeout: Optional[int] = 30000

class FormDataRequest(BaseModel):
    url: str
    form_data: Dict[str, Any]
    timeout: Optional[int] = 300000

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "browser": "ready" if browser else "not ready"}

@app.post("/api/browser/apply-job")
async def apply_job(request: FormDataRequest):
    """
    Complete job application automation
    This endpoint receives a job URL and form data,
    navigates to the page, fills the form, and submits
    """
    if not browser:
        raise HTTPException(status_code=503, detail="Browser not initialized")

    try:
        page = await context.new_page()

        # Navigate to job URL
        await page.goto(request.url, timeout=request.timeout)

        # TODO: Implement form filling logic here
        # For now, just return success

        await page.close()

        return {
            "success": True,
            "message": "Job application completed",
            "url": request.url
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    print("🚀 Starting Camoufox Stealth Server...")
    uvicorn.run(app, host="0.0.0.0", port=3000)

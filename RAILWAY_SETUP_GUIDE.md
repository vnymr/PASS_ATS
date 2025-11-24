# Railway Setup Guide - Complete Fix

## Overview

You have **3 services** across **2 Railway projects**:

### Project 1: **heartfelt-education** (Frontend)
- 1 service: Frontend React app

### Project 2: **happy-expression** (Backend)
- 2 services:
  - Node.js backend (main app)
  - Python Camoufox browser

## Current Issues:

1. ❌ **Frontend**: Build failing - can't find Dockerfile
2. ⚠️ **Backend - Camoufox**: Not configured yet
3. ⚠️ **Backend - Node.js**: Needs Camoufox env vars

---

## Fix 1: Frontend (heartfelt-education)

### Step 1: Verify Railway Service Settings

1. Go to: https://railway.app/dashboard
2. Open project: **heartfelt-education**
3. Click on your frontend service
4. Go to **Settings** → **Service Settings**

**Verify these settings:**
```
Root Directory: frontend
  (or leave empty if your GitHub repo root is the frontend folder)

Builder: Dockerfile

Dockerfile Path: Dockerfile
  (NOT frontend/Dockerfile)
```

### Step 2: Add Environment Variables

Go to **Variables** tab and add:

```bash
# Backend API URL (replace with your actual backend URL)
VITE_API_URL=https://your-backend.up.railway.app/api

# Clerk Auth (get from Clerk dashboard)
VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxxxx
```

### Step 3: Redeploy

Click **"Redeploy"** or wait for auto-deploy from GitHub push.

**Expected logs:**
```
[builder] FROM node:18-alpine
[builder] WORKDIR /app
[builder] COPY package*.json ./
[builder] RUN npm ci
✅ Build completed successfully
```

---

## Fix 2: Backend - Camoufox (happy-expression)

### Check Python Service Status

1. Go to project: **happy-expression**
2. Find service: **python-browser**
3. Check logs

**Expected logs (after latest fix):**
```
🚀 Starting Camoufox Remote Browser Server...
🔧 Environment: development
📡 Launching server on ws://0.0.0.0:3000/browser
🦊 Headless: True
🌍 GeoIP: enabled
📋 Launch arguments: ['headless', 'geoip', 'port', 'ws_path']
Launching server...
✅ Camoufox server started successfully
📞 Node.js can connect to: ws://localhost:3000/browser
⏳ Server will run indefinitely...
```

**If still showing errors:**
- Click **Redeploy** to pull latest code (commit `cfce3ab`)
- Wait 5-10 minutes for build

---

## Fix 3: Backend - Node.js (happy-expression)

### Add Camoufox Environment Variables

1. In project: **happy-expression**
2. Click on your **Node.js backend service** (NOT python-browser)
3. Go to **Variables** tab
4. Add these:

```bash
# Camoufox Configuration
USE_CAMOUFOX=true
CAMOUFOX_WS_ENDPOINT=ws://python-browser.railway.internal:3000/browser

# Database (should already exist)
DATABASE_URL=postgresql://...

# Redis (should already exist)
REDIS_URL=redis://...

# OpenAI (should already exist)
OPENAI_API_KEY=sk-...

# Clerk Auth (should already exist)
CLERK_SECRET_KEY=sk_...
CLERK_PUBLISHABLE_KEY=pk_...
```

### Redeploy Node.js Service

Click **"Redeploy"** or it will auto-redeploy after adding env vars.

**Expected logs:**
```
Server starting...
Database connected
Redis connected
🦊 Using Camoufox for maximum stealth (C++ level detection evasion)
🦊 Connecting to Camoufox remote browser (Firefox-based stealth)...
✅ Connected to Camoufox browser server successfully
📌 All auto-apply logic runs in Node.js - Python only provides stealth browser
✅ Server started on port 3000
```

---

## Verification Checklist

### Frontend (heartfelt-education)
- [ ] Service deploys successfully
- [ ] Can access frontend URL in browser
- [ ] Login works (Clerk auth)
- [ ] Can navigate to dashboard

### Backend Node.js (happy-expression)
- [ ] Service shows "✅ Connected to Camoufox browser server"
- [ ] API health check works: `curl https://your-backend.railway.app/health`
- [ ] Can make API requests from frontend

### Python Camoufox (happy-expression)
- [ ] Service shows "✅ Camoufox server started successfully"
- [ ] Service stays running (doesn't crash loop)
- [ ] Node.js connects to it successfully

---

## Test End-to-End Flow

1. Open frontend in browser
2. Log in
3. Go to Jobs page
4. Try to auto-apply to ONE job
5. Watch Railway logs for both services:
   ```bash
   # Terminal 1
   railway logs --service <nodejs-service-name>

   # Terminal 2
   railway logs --service python-browser
   ```

6. Check for:
   - ✅ Node.js receives job application request
   - ✅ Node.js connects to Camoufox
   - ✅ Browser launches and navigates
   - ✅ Form gets filled
   - ✅ Application submits

---

## Troubleshooting

### Frontend: Still can't find Dockerfile

**Check Railway service Root Directory:**
```
Option A (Recommended):
  Root Directory: frontend
  Dockerfile Path: Dockerfile

Option B (Alternative):
  Root Directory: (empty)
  Dockerfile Path: frontend/Dockerfile
```

### Camoufox: Still crashing with proxy error

**Make sure you pulled latest code:**
```bash
cd /Users/vinaymuthareddy/RESUME_GENERATOR
git pull origin main
```

Latest commit should be `cfce3ab` or later.

Then redeploy in Railway dashboard.

### Node.js: Can't connect to Camoufox

**Check these:**
1. Both services in same Railway project? (happy-expression)
2. Env var correct? `ws://python-browser.railway.internal:3000/browser`
3. Python service running? Check its logs
4. Internal networking enabled? (Should be default in Railway)

### CORS errors

**Add to Node.js env vars:**
```bash
FRONTEND_URL=https://your-frontend.railway.app
```

---

## Quick Commands

```bash
# Check which Railway project you're linked to
railway status

# Link to backend project
cd /Users/vinaymuthareddy/RESUME_GENERATOR/server
railway link

# View logs
railway logs --service python-browser
railway logs --service <your-nodejs-service>

# Force redeploy
railway redeploy --service python-browser
railway redeploy --service <your-nodejs-service>
```

---

## Success Indicators

✅ **All working when you see:**

**Frontend:**
- Page loads without errors
- Can log in
- Dashboard shows jobs

**Backend:**
```
✅ Connected to Camoufox browser server successfully
Server started on port 3000
```

**Python:**
```
✅ Camoufox server started successfully
⏳ Server will run indefinitely...
```

**Auto-Apply Test:**
```
🦊 Connecting to Camoufox remote browser...
✅ Connected
🤖 AI analyzing and filling form...
✅ AI successfully filled form!
✅ Application submitted
```

---

Last Updated: 2025-11-24
Commit: 2435ef6

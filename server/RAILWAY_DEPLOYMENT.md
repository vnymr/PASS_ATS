# Railway Deployment Guide - Camoufox Setup

## 🚀 Quick Deploy to Railway (No Docker Required)

### Step 1: Prepare Repository

```bash
cd /Users/vinaymuthareddy/RESUME_GENERATOR/server

# Add and commit all Camoufox files
git add .
git commit -m "feat: add Camoufox microservice for bot detection evasion"
git push origin main
```

### Step 2: Deploy Python Camoufox Service

1. **Go to Railway Dashboard**: https://railway.app/dashboard
2. **Click "New Project"** → **"Deploy from GitHub repo"**
3. **Select your repository**
4. **Configure service**:
   - **Name**: `python-browser`
   - **Root Directory**: `server/python-service`
   - **Builder**: Dockerfile
   - **Dockerfile Path**: `server/python-service/Dockerfile`

5. **Click "Deploy"**

Railway will automatically:
- Build the Docker image
- Download Camoufox browser (~500MB)
- Start the WebSocket server
- This takes ~5-10 minutes

### Step 3: Get Python Service URL

After deployment completes:

1. Click on `python-browser` service
2. Go to **"Settings"** tab
3. Under **"Networking"**, note the **Private Network URL**
   - It will be something like: `python-browser.railway.internal`

### Step 4: Deploy/Update Node.js Service

Your Node.js app is already on Railway. Just add environment variables:

1. Click on your **Node.js service**
2. Go to **"Variables"** tab
3. **Add these variables**:

```bash
USE_CAMOUFOX=true
CAMOUFOX_API_ENDPOINT=http://python-browser.railway.internal:3000
```

4. **Click "Deploy"** to restart with new config

### Step 5: Test the Setup

```bash
# Get your Railway app URL
# Example: https://resume-generator-production.up.railway.app

# Test health endpoint
curl https://your-app.railway.app/health

# Test auto-apply (replace with your auth token)
curl -X POST https://your-app.railway.app/api/auto-apply \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jobId": "your-job-id"}'
```

### Step 6: Monitor Logs

```bash
# Railway CLI (if installed)
railway logs --service python-browser
railway logs --service node-app

# Or view in Railway Dashboard:
# Click service → "Deployments" → Click latest deployment → "View Logs"
```

---

## 🎯 Expected Results

After deployment, you should see:

**Python Service Logs:**
```
🚀 Starting Camoufox Stealth Server...
🔧 Environment: production
✅ Camoufox browser launched successfully
📡 Server listening on port 3000
INFO:     Application startup complete.
```

**Node.js Service Logs:**
```
🦊 Using Camoufox for maximum stealth
📡 Camoufox API endpoint: http://python-browser.railway.internal:3000
✅ Ready to process job applications
Server started on port 3000
```

---

## 🔧 Troubleshooting

### Issue: Python service won't start

**Check logs:**
```bash
railway logs --service python-browser
```

**Common causes:**
- Out of memory (increase to 2GB in Railway settings)
- Build timeout (increase timeout in settings)

**Solution:**
1. Go to service settings
2. Under "Resources", increase memory to 2GB
3. Redeploy

### Issue: Node.js can't connect to Python

**Check:**
1. Both services are in the **same Railway project**
2. Private networking is enabled (default)
3. `CAMOUFOX_API_ENDPOINT` uses `.railway.internal` domain

**Fix:**
```bash
# Correct format (internal Railway network):
CAMOUFOX_API_ENDPOINT=http://python-browser.railway.internal:3000

# NOT (public URL):
CAMOUFOX_API_ENDPOINT=http://python-browser.railway.app:3000
```

### Issue: Connection timeout

**Increase timeout in browser-launcher.js:**

Already set to 30 seconds, but you can increase:
```javascript
timeout: 60000  // 60 seconds
```

Commit and push to redeploy.

---

## 📊 Monitoring

### Check Service Health

```bash
# Python service (internal only, use railway CLI)
railway run --service python-browser curl localhost:3000/health

# Node.js service (public)
curl https://your-app.railway.app/health
```

### View Metrics

Railway Dashboard → Service → "Metrics" tab:
- CPU usage
- Memory usage
- Network traffic
- Request rate

### Expected Resource Usage

**Python Service:**
- Memory: 400-800MB
- CPU: 5-15%
- Network: Low (just WebSocket)

**Node.js Service:**
- Memory: 300-600MB
- CPU: 10-30%
- Network: Medium (API + WebSocket)

---

## 💰 Costs

Railway pricing (as of 2024):

**Free Tier:**
- $5 free credit/month
- Good for testing

**Hobby Plan ($5/month):**
- Covers light usage
- ~100 applications/day

**Pro Plan ($20/month):**
- Unlimited usage
- Production ready
- ~1000+ applications/day

**Estimated costs for Camoufox:**
- Python service: ~$3-5/month (512MB RAM)
- Total with Node.js: ~$10-15/month

---

## 🚀 Quick Deploy Commands

```bash
# From server directory
git add .
git commit -m "feat: add Camoufox microservice"
git push origin main

# Railway auto-deploys from GitHub
# Check dashboard for deployment status
```

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] Python service shows "✅ Server listening" in logs
- [ ] Node.js service shows "✅ Connected to Camoufox" in logs
- [ ] Health endpoint returns 200: `curl https://your-app/health`
- [ ] Auto-apply works: Test with a real job application
- [ ] Success rate improves: Check stats endpoint

---

## 🎉 Success Criteria

You'll know it's working when:

1. ✅ Services communicate (no connection errors)
2. ✅ Job applications complete successfully
3. ✅ Success rate is 85%+ (up from 50-70%)
4. ✅ Low CAPTCHA rate (5-10% vs 30-40%)
5. ✅ No "bot detected" errors

---

## 📞 Support

If issues persist:
1. Check Railway logs for both services
2. Verify environment variables
3. Test with single job first
4. Review [CAMOUFOX_MIGRATION_GUIDE.md](./CAMOUFOX_MIGRATION_GUIDE.md)

Good luck! 🚀

# 🚀 Deploy Auto-Apply Worker - Step by Step

## What You're Deploying

A **separate Railway service** that runs the worker process continuously in the background.

---

## Prerequisites

- ✅ Railway account (you already have this)
- ✅ Main API server deployed (PASS_ATS)
- ✅ Redis deployed on Railway
- ✅ PostgreSQL deployed on Railway

---

## Option 1: Deploy via Railway Dashboard (Easiest)

### Step 1: Create New Service

1. Go to Railway dashboard: https://railway.app
2. Open your project (where PASS_ATS is)
3. Click **"+ New"** button
4. Select **"GitHub Repo"**
5. Choose your repository (same as PASS_ATS)
6. Name it: `auto-apply-worker`

### Step 2: Configure the Service

In the new service settings:

1. **Root Directory**: `/server`
2. **Start Command**: `node auto-apply-worker.js`
3. **Build Command**: `npm install`

### Step 3: Add Environment Variables

Copy ALL environment variables from your PASS_ATS service, PLUS add these Puppeteer-specific ones:

```bash
# Copy from PASS_ATS service:
DATABASE_URL=postgresql://...        # Same as API
REDIS_URL=redis://...               # Same as API
OPENAI_API_KEY=sk-...               # Same as API
JWT_SECRET=...                      # Same as API
NODE_ENV=production                 # Same as API

# ADD these new ones for Puppeteer:
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
PUPPETEER_HEADLESS=true
PUPPETEER_ARGS=--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage

# Queue config (optional):
CONCURRENCY=2                       # Max 2 jobs at once
MAX_BROWSERS=6                      # Browser pool size
APPLY_STRATEGY=AI_FIRST            # AI → Recipe fallback
```

### Step 4: Configure Puppeteer Buildpack

In Railway service settings:

1. Go to **Settings** → **Deploy**
2. Add custom **Start Command**:
   ```
   node auto-apply-worker.js
   ```

3. Create a file in your repo: `server/nixpacks.toml`
   ```toml
   [phases.setup]
   nixPkgs = ['nodejs_20', 'chromium']
   ```

### Step 5: Deploy

1. Click **Deploy** in Railway
2. Wait 2-3 minutes for build
3. Check logs for: `✅ Auto-apply worker ready to process jobs`

---

## Option 2: Deploy via Railway CLI (Faster)

### Step 1: Install Railway CLI

```bash
npm install -g @railway/cli
railway login
```

### Step 2: Link to Your Project

```bash
cd /Users/vinaymuthareddy/RESUME_GENERATOR
railway link
# Select your project (where PASS_ATS is)
```

### Step 3: Create Worker Service

```bash
# Create new service
railway service create auto-apply-worker

# Set root directory
railway service --service auto-apply-worker
```

### Step 4: Create nixpacks.toml

```bash
cat > server/nixpacks.toml << 'EOF'
[phases.setup]
nixPkgs = ['nodejs_20', 'chromium']

[start]
cmd = 'node auto-apply-worker.js'
EOF
```

### Step 5: Set Environment Variables

```bash
# Copy variables from PASS_ATS service
railway variables --service auto-apply-worker set \
  DATABASE_URL=$DATABASE_URL \
  REDIS_URL=$REDIS_URL \
  OPENAI_API_KEY=$OPENAI_API_KEY \
  JWT_SECRET=$JWT_SECRET \
  NODE_ENV=production \
  PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
  PUPPETEER_HEADLESS=true \
  PUPPETEER_ARGS=--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage \
  CONCURRENCY=2 \
  APPLY_STRATEGY=AI_FIRST
```

### Step 6: Deploy

```bash
# Push to Railway
railway up --service auto-apply-worker

# Watch logs
railway logs --service auto-apply-worker
```

---

## ✅ Verify It's Working

### Check 1: Logs Show Worker is Ready

```bash
railway logs --service auto-apply-worker --tail

# You should see:
# 🔧 Starting auto-apply worker...
#    Redis: redis://...
#    Database: Connected
# ✅ Auto-apply worker ready to process jobs
```

### Check 2: Test with Real Application

```bash
# 1. Go to your frontend
# 2. Find a job with "🤖 AI Can Apply" badge
# 3. Click "Auto-Apply"
# 4. Check logs:

railway logs --service auto-apply-worker --tail

# You should see:
# Processing job...
# 🚀 Applying with optimized engine...
# ✅ Optimized application successful!
```

### Check 3: Check Queue Stats

```bash
# Via API
curl https://your-api.com/api/auto-apply/stats \
  -H "Authorization: Bearer YOUR_TOKEN"

# Should show:
{
  "queue": {
    "waiting": 0,
    "active": 0,
    "completed": 1,
    "failed": 0
  }
}
```

---

## 🐛 Troubleshooting

### Problem: "Chromium not found"

**Solution**: Add nixpacks.toml file

```bash
cat > server/nixpacks.toml << 'EOF'
[phases.setup]
nixPkgs = ['nodejs_20', 'chromium']
EOF

git add server/nixpacks.toml
git commit -m "Add Chromium for Puppeteer"
git push
```

### Problem: "Worker keeps restarting"

**Check logs**:
```bash
railway logs --service auto-apply-worker --tail
```

Common causes:
- Missing environment variables (DATABASE_URL, REDIS_URL)
- Redis not accessible
- Port conflict (worker doesn't need a port!)

**Fix**: Worker should NOT expose a port. Remove any PORT variable.

### Problem: "Jobs stuck in QUEUED status"

**Cause**: Worker not running or can't connect to Redis

**Fix**:
```bash
# Check worker is running
railway status --service auto-apply-worker

# Check Redis URL is correct
railway variables --service auto-apply-worker | grep REDIS_URL

# Should match Redis instance in same project
```

### Problem: "Browser crashes / Out of memory"

**Fix**: Reduce concurrency

```bash
railway variables set CONCURRENCY=1 --service auto-apply-worker
railway variables set MAX_BROWSERS=2 --service auto-apply-worker
```

---

## 💰 Cost Estimate

### Railway Worker Service
- **Free tier**: $5 credit/month
- **Hobby plan**: $5/month (recommended)
- **Pro plan**: $20/month (if needed)

### Worker typically uses:
- ~200-500MB RAM (with 2 concurrent jobs)
- ~10% CPU average
- Fits in Hobby plan ✅

### Total Cost per Application:
- Railway worker: ~$0.01
- OpenAI API: ~$0.03
- **Total: ~$0.04/application**

With recipe optimization:
- Railway worker: ~$0.01
- OpenAI API: ~$0.01 (cached)
- **Total: ~$0.02/application** (50% cheaper!)

---

## 📊 Monitoring

### Watch in Real-Time

```bash
# Tail logs
railway logs --service auto-apply-worker --tail

# Check resource usage
railway status --service auto-apply-worker
```

### Set Up Alerts

In Railway dashboard:
1. Go to worker service
2. Settings → Notifications
3. Enable:
   - Deploy failed
   - Service crashed
   - High memory usage

---

## 🎯 Success Checklist

After deployment, verify:

- [ ] Worker service shows "Active" in Railway
- [ ] Logs show "✅ Auto-apply worker ready"
- [ ] Can trigger auto-apply from frontend
- [ ] Job status changes: QUEUED → APPLYING → SUBMITTED
- [ ] Applications appear in dashboard
- [ ] No crash loops in logs

---

## Next Steps After Worker is Running

1. **Test with 5 applications** - Make sure they complete successfully
2. **Set user limits** - Prevent abuse (10 apps/day per user)
3. **Monitor costs** - Track OpenAI API usage
4. **Add analytics** - Track success rates

---

## Quick Reference

```bash
# Create service
railway service create auto-apply-worker

# Deploy
railway up --service auto-apply-worker

# Watch logs
railway logs --service auto-apply-worker --tail

# Check status
railway status --service auto-apply-worker

# Restart service
railway restart --service auto-apply-worker

# Get service info
railway info --service auto-apply-worker
```

---

## Support

If you get stuck:

1. Check logs first: `railway logs --service auto-apply-worker --tail`
2. Verify environment variables match PASS_ATS service
3. Make sure Redis and Database are accessible
4. Test locally first: `cd server && node auto-apply-worker.js`

**Most common issue**: Missing Chromium (fixed by nixpacks.toml)

---

**Ready to deploy?** Start with Option 1 (Railway Dashboard) - it's the easiest! 🚀

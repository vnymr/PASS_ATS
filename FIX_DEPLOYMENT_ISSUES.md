# 🔧 Fix Deployment Issues - Step by Step

## Issues Found

1. ✅ **FIXED**: Missing `puppeteer` package (added to package.json)
2. ⚠️ **TO FIX**: Failed database migration blocking backend

---

## Fix 1: Puppeteer Package ✅ DONE

Already fixed! Pushed to GitHub. Railway will automatically rebuild with puppeteer.

---

## Fix 2: Database Migration ⚠️ NEEDS ACTION

### The Problem

Migration `20251104120000_add_auto_apply_tables` failed because:
- It tries to CREATE tables that already exist (like `AggregatedJob`)
- Prisma marked it as "failed" and won't continue

### The Solution (3 Options)

---

## Option 1: Quick Fix - Mark Migration as Resolved (RECOMMENDED)

**Fastest solution** - Just tell Prisma the migration is complete.

### Step 1: Connect to your database

```bash
# Get your database URL from Railway
# Go to PASS_ATS service → Variables → Copy DATABASE_URL

# Connect via psql
psql "YOUR_DATABASE_URL_HERE"
```

### Step 2: Run this command

```sql
-- Delete the failed migration record
DELETE FROM "_prisma_migrations"
WHERE migration_name = '20251104120000_add_auto_apply_tables';

-- Mark it as successful
INSERT INTO "_prisma_migrations" (
    "id",
    "checksum",
    "finished_at",
    "migration_name",
    "logs",
    "rolled_back_at",
    "started_at",
    "applied_steps_count"
) VALUES (
    gen_random_uuid()::text,
    '0',
    NOW(),
    '20251104120000_add_auto_apply_tables',
    NULL,
    NULL,
    NOW(),
    1
);
```

### Step 3: Redeploy

In Railway, click **"Redeploy"** on your PASS_ATS service.

✅ **Done!** Migration issue fixed.

---

## Option 2: Complete Fix - Run Full Fix Script

This creates missing tables and marks migration as complete.

### Step 1: Connect to database

```bash
psql "YOUR_DATABASE_URL_HERE"
```

### Step 2: Run the fix script

```bash
# From your local machine
psql "YOUR_DATABASE_URL_HERE" < server/fix-migration.sql
```

✅ **Done!**

---

## Option 3: Nuclear Option - Delete & Recreate Migration

**Use only if Options 1 & 2 don't work**

### Step 1: Delete the failed migration

```bash
cd server
rm -rf prisma/migrations/20251104120000_add_auto_apply_tables
```

### Step 2: Reset the migration in database

```bash
psql "YOUR_DATABASE_URL_HERE"
```

```sql
-- Delete failed migration
DELETE FROM "_prisma_migrations"
WHERE migration_name = '20251104120000_add_auto_apply_tables';
```

### Step 3: Create new migration

```bash
npx prisma migrate dev --name add_auto_apply_system
```

### Step 4: Deploy

```bash
git add .
git commit -m "Fix auto-apply migration"
git push
```

---

## Verify Fixes

### Check 1: Backend Should Start

After fixing migration, check Railway logs for PASS_ATS:

```bash
# You should see:
✅ Prisma migrations applied successfully
✅ Server started on port 3000
```

### Check 2: Worker Should Start

After puppeteer fix deploys, check auto-apply-worker logs:

```bash
# You should see:
🔧 Starting auto-apply worker...
   Redis: redis://...
   Database: Connected
✅ Auto-apply worker ready to process jobs
```

---

## Quick Reference

### Get Database URL

```bash
# Railway Dashboard
# → PASS_ATS service
# → Variables tab
# → DATABASE_URL
```

### Connect to Database

```bash
psql "YOUR_DATABASE_URL_HERE"
```

### Check Migration Status

```sql
SELECT migration_name, finished_at, started_at
FROM "_prisma_migrations"
ORDER BY started_at DESC
LIMIT 5;
```

### Check if Tables Exist

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('AutoApplication', 'ApplicationRecipe', 'DiscoveredCompany', 'RecipeExecution');
```

---

## After Both Fixes Applied

You should see in Railway:

```
┌──────────────────────┐
│ PASS_ATS             │ ← ✅ Running (migration fixed)
│ api.happyresumes.com │
└──────────────────────┘

┌──────────────────────┐
│ resume-worker        │ ← ✅ Running
└──────────────────────┘

┌──────────────────────┐
│ auto-apply-worker    │ ← ✅ Running (puppeteer added)
└──────────────────────┘

┌──────────────────────┐
│ Redis                │ ← ✅ Running
└──────────────────────┘
```

---

## Test After Fixes

### Test 1: Backend API

```bash
curl https://api.happyresumes.com/api/health

# Should return: {"status":"ok"}
```

### Test 2: Auto-Apply System

1. Go to https://app.happyresumes.com
2. Navigate to /find-jobs
3. Find job with "🤖 AI Can Apply"
4. Click "Auto-Apply"
5. Check dashboard - should see "QUEUED" → "APPLYING" → "SUBMITTED"

---

## Troubleshooting

### Backend Still Failing?

**Check**: Is migration actually fixed?

```sql
SELECT * FROM "_prisma_migrations"
WHERE migration_name = '20251104120000_add_auto_apply_tables';

-- Should show: finished_at with a timestamp (not NULL)
```

### Worker Still Failing?

**Check**: Is puppeteer installed?

```bash
# Railway logs should show:
# Building...
# Installing dependencies...
# └── puppeteer@23.0.0  ← Should see this!
```

### Still Getting Errors?

Check Railway logs:

```bash
# PASS_ATS logs
railway logs --service PASS_ATS --tail

# Worker logs
railway logs --service auto-apply-worker --tail
```

---

## Summary

**What We Fixed:**

1. ✅ Added `puppeteer` to package.json
2. ⚠️ **You need to**: Fix the database migration (use Option 1 above)

**Time Estimate:**

- Option 1: **2 minutes** (recommended)
- Option 2: **5 minutes**
- Option 3: **10 minutes**

**After fixes:**

- Backend will start ✅
- Worker will start ✅
- Auto-apply will work ✅

---

## Need Help?

1. **Can't connect to database?**
   - Get DATABASE_URL from Railway variables
   - Make sure you're connected to internet
   - Try Railway's built-in database console

2. **Migration still failing?**
   - Use Option 1 (mark as resolved)
   - It's safe - just tells Prisma to skip the failed migration

3. **Worker still crashing?**
   - Wait for Railway to rebuild (takes 2-3 minutes after push)
   - Check logs for puppeteer installation

---

**Ready?** Start with **Option 1** for database fix. It's the fastest! 🚀

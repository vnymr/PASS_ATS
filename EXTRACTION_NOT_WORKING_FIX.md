# Why Extraction Is Not Working - Fix Guide

## The Problem

You're not seeing extracted skills/experience in the UI because:

**The database migration hasn't been run yet!** ❌

The new columns (`extractedSkills`, `extractedExperience`, etc.) don't exist in your production database yet, so:
1. The API can't store extracted metadata
2. The frontend receives `null` for all extraction fields
3. The UI falls back to showing nothing

---

## The Fix - 3 Steps

### Step 1: Run the Database Migration

You need to add the new columns to your production database:

```bash
# Option A: Using psql command line
psql $DATABASE_URL -f server/migrations/add_job_extraction_metadata.sql

# Option B: Using Railway CLI (if using Railway)
railway run psql $DATABASE_URL -f server/migrations/add_job_extraction_metadata.sql

# Option C: Copy-paste SQL directly in database admin panel
# Open the migration file and run it manually:
cat server/migrations/add_job_extraction_metadata.sql
```

**The migration SQL** ([server/migrations/add_job_extraction_metadata.sql](server/migrations/add_job_extraction_metadata.sql)):
```sql
ALTER TABLE "AggregatedJob"
ADD COLUMN IF NOT EXISTS "extractedSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "extractedExperience" TEXT,
ADD COLUMN IF NOT EXISTS "extractedEducation" TEXT,
ADD COLUMN IF NOT EXISTS "extractedJobLevel" TEXT,
ADD COLUMN IF NOT EXISTS "extractedKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "extractedBenefits" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "lastExtractedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "extractionConfidence" DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS "AggregatedJob_extractedSkills_idx"
  ON "AggregatedJob" USING GIN ("extractedSkills");
```

### Step 2: Deploy Backend Code

```bash
cd server
git add .
git commit -m "Add job metadata extraction system"
git push origin main
```

Your deployment platform (Railway/Vercel/etc.) will auto-deploy.

### Step 3: Trigger Extraction

After deploying, you have 3 options:

#### Option A: Wait for Automatic Sync (Easiest)
- Job sync runs every 6 hours automatically
- New jobs will get extracted automatically
- Existing jobs will be extracted when updated

#### Option B: Use Diagnostic Endpoint (Testing)

I've added a diagnostic API to help you:

```bash
# 1. Check if migration worked
curl https://your-api.com/api/diagnostics/extraction-status

# Should return:
# {
#   "success": true,
#   "fieldsExist": true,
#   "stats": {
#     "extracted": 0,
#     "not_extracted": 150,  # Your existing jobs
#     "total": 150
#   }
# }

# 2. Extract a single job (for testing)
curl -X POST https://your-api.com/api/diagnostics/extract-job/JOB_ID_HERE \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. Extract first 10 jobs (batch test)
curl -X POST https://your-api.com/api/diagnostics/extract-all \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"limit": 10}'
```

#### Option C: Manual Sync Trigger

```bash
# Trigger full sync immediately
curl -X POST https://your-api.com/api/admin/sync-jobs \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## How to Verify It's Working

### 1. Check Database

After migration + extraction:

```sql
-- Check one job
SELECT
  title,
  company,
  "extractedSkills",
  "extractedExperience",
  "extractedJobLevel"
FROM "AggregatedJob"
WHERE "lastExtractedAt" IS NOT NULL
LIMIT 1;
```

Should show:
```
title                          | extractedSkills                | extractedExperience | extractedJobLevel
Expansion Account Executive    | {Salesforce,B2B Sales,SaaS,..}| 3+ years            | Mid-level
```

### 2. Check API Response

```bash
curl https://your-api.com/api/jobs?limit=1 | jq '.jobs[0] | {
  title,
  extractedSkills,
  extractedExperience
}'
```

Should return:
```json
{
  "title": "Expansion Account Executive",
  "extractedSkills": ["Salesforce", "B2B Sales", "Enterprise", ...],
  "extractedExperience": "3+ years"
}
```

### 3. Check Frontend UI

1. Open any job detail panel
2. You should see:
   - **Correct experience** (e.g., "3+ years" not "5+ years")
   - **Relevant skills** (e.g., "Salesforce" for sales roles, not "go, rust")
   - **Skill match banner** (if you have a user profile)
   - **Green checkmarks** on matched skills

---

## Troubleshooting

### Issue: "Column does not exist" error

**Cause**: Migration not run yet

**Fix**: Run the migration SQL (Step 1 above)

### Issue: Fields exist but all null

**Cause**: Extraction hasn't run yet

**Fix**:
- Option 1: Wait for next auto-sync (6 hours)
- Option 2: Trigger extraction manually (Step 3 above)
- Option 3: Create a new job (will auto-extract)

### Issue: Extraction running but failing

**Cause**: OpenAI API error or rate limit

**Fix**: Check logs for errors:
```bash
railway logs --tail  # or your platform's log command

# Look for:
# "🤖 Extracting metadata for: ..."
# "✅ Extraction complete"
# OR
# "❌ Job metadata extraction failed: ..."
```

### Issue: Frontend still shows wrong data

**Cause**: Frontend cache or old API response

**Fix**:
1. Hard refresh browser (Cmd+Shift+R)
2. Check API response directly (curl command above)
3. Verify job was actually extracted in database

---

## Files Added/Modified

### New Files:
1. ✅ `server/routes/diagnostics.js` - Diagnostic endpoints
2. ✅ `server/scripts/test-extraction.js` - Test extraction locally
3. ✅ `server/scripts/check-schema.js` - Check if migration applied

### Modified Files:
1. ✅ `server/server.js` - Added diagnostics router

---

## Quick Start Commands

```bash
# 1. Run migration (REQUIRED!)
psql $DATABASE_URL -f server/migrations/add_job_extraction_metadata.sql

# 2. Deploy backend
cd server && git push origin main

# 3. Check status
curl https://your-api.com/api/diagnostics/extraction-status

# 4. Extract 10 jobs for testing
curl -X POST https://your-api.com/api/diagnostics/extract-all \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"limit": 10}'

# 5. Wait 30 seconds, then check UI
# Open job detail panel - should see extracted skills!
```

---

## What You Should See After Fix

### Before (Wrong):
```
Experience: 5+ years ❌
Skills: go, rust, ai ❌
```

### After (Correct):
```
Experience: 3+ years ✅
Skills: Salesforce, B2B Sales, Enterprise, SaaS, Outreach, Gong ✅
Benefits: Health Insurance, 401(k), Equity/Stock Options ✅

[Skill Match Banner]
✓ Good Match - 73%
You have many of the required skills
✓ 11 matched • 4 to learn
```

---

## Cost of Extraction

- **Model**: GPT-4o-mini
- **Cost per job**: ~$0.0001 (1/100th of a cent)
- **For 150 jobs**: ~$0.015 (1.5 cents)
- **For 1,000 jobs**: ~$0.10 (10 cents)

**Extremely affordable!** 🎉

---

## Next Steps After Migration

1. **Run migration** ← DO THIS FIRST!
2. Deploy backend
3. Extract 10-20 jobs to test
4. Verify UI shows correct data
5. Let auto-sync handle the rest

Once working, existing jobs will be extracted gradually on next sync or when viewed.

---

## Need Help?

**Check migration status**:
```bash
curl https://your-api.com/api/diagnostics/extraction-status
```

**Check logs** for extraction messages:
```bash
railway logs --tail | grep "Extracting metadata"
```

**Manually test one job**:
```bash
# Get a job ID from /api/jobs
JOB_ID="..." # paste job ID here
curl -X POST https://your-api.com/api/diagnostics/extract-job/$JOB_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

# Job Metadata Extraction - Deployment Checklist

## Pre-Deployment

- [x] Schema updated: `server/prisma/schema.prisma`
- [x] Migration created: `server/migrations/add_job_extraction_metadata.sql`
- [x] Backend extraction logic: `server/lib/job-metadata-extractor.js`
- [x] Job sync integration: `server/lib/job-sync-service.js`
- [x] API responses updated: `server/routes/jobs.js`, `server/routes/ai-search.js`
- [x] Frontend types updated: `frontend/src/services/api.ts`
- [x] Frontend UI updated: `frontend/src/components/JobDetailPanel.tsx`
- [x] Skill matcher created: `frontend/src/utils/skillMatcher.ts`
- [x] Icons updated: `frontend/src/components/ui/icons.tsx` (added `CheckCircle`)

## Deployment Steps

### 1. Database Migration (Production)

```bash
# Connect to production database
psql $DATABASE_URL

# Run migration
\i server/migrations/add_job_extraction_metadata.sql

# Verify columns were added
\d "AggregatedJob"

# Should see new columns:
# - extractedSkills
# - extractedExperience
# - extractedEducation
# - extractedJobLevel
# - extractedKeywords
# - extractedBenefits
# - lastExtractedAt
# - extractionConfidence
```

### 2. Deploy Backend

```bash
cd /Users/vinaymuthareddy/RESUME_GENERATOR/server

# Ensure dependencies are installed
npm install

# Test locally (if possible)
npm run dev

# Deploy to production (Railway/Vercel/etc.)
git add .
git commit -m "Add LLM-powered job metadata extraction"
git push origin main

# Or use Railway CLI
railway up
```

### 3. Deploy Frontend

```bash
cd /Users/vinaymuthareddy/RESUME_GENERATOR/frontend

# Install dependencies
npm install

# Build production bundle
npm run build

# Test build locally
npm run preview

# Deploy to production
git push origin main
# (Vercel/Netlify will auto-deploy)
```

### 4. Trigger Initial Extraction (Optional)

```bash
# Option A: Wait for automatic sync (runs every 6 hours)
# Jobs will be extracted on next sync

# Option B: Force immediate sync (if you have admin endpoint)
curl -X POST https://your-api.com/api/jobs/sync \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Option C: Run sync manually via server script
cd /Users/vinaymuthareddy/RESUME_GENERATOR/server
node scripts/run-full-sync.js
```

## Post-Deployment Verification

### 1. Check Database

```sql
-- Verify migration
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'AggregatedJob'
  AND column_name LIKE 'extracted%';

-- Check if jobs are being extracted
SELECT
  COUNT(*) FILTER (WHERE "lastExtractedAt" IS NOT NULL) as extracted_jobs,
  COUNT(*) FILTER (WHERE "lastExtractedAt" IS NULL) as pending_extraction,
  COUNT(*) as total_jobs
FROM "AggregatedJob"
WHERE "isActive" = true;

-- Sample extracted data
SELECT
  title,
  company,
  "extractedExperience",
  "extractedSkills",
  "extractionConfidence"
FROM "AggregatedJob"
WHERE "lastExtractedAt" IS NOT NULL
LIMIT 5;
```

### 2. Test API Endpoints

```bash
# Test job listing endpoint
curl https://your-api.com/api/jobs?limit=5 | jq '.jobs[0] | {title, extractedSkills, extractedExperience}'

# Test AI search endpoint
curl -X POST https://your-api.com/api/ai-search \
  -H "Content-Type: application/json" \
  -d '{"query":"remote software engineer"}' \
  | jq '.jobs[0] | {title, extractedSkills}'
```

### 3. Test Frontend

1. **Open job detail panel** for any job
2. **Verify extracted data** appears:
   - Experience shows correct value (e.g., "3+ years" not "5+ years")
   - Skills show relevant skills (e.g., "Salesforce" for sales roles, not "go, rust")
   - Benefits appear if mentioned

3. **Check skill matching** (if user has profile):
   - Skill match banner shows percentage
   - Matched skills have green checkmark
   - Missing skills are grayed out

### 4. Monitor Logs

```bash
# Watch for extraction logs
railway logs --tail

# Should see:
# "🤖 Extracting metadata for: <job title> at <company>"
# "✅ Extraction complete: { jobTitle, company, skillsCount }"
```

## Rollback Plan (If Needed)

### If extraction fails or causes issues:

```sql
-- Rollback migration (removes columns)
ALTER TABLE "AggregatedJob"
DROP COLUMN IF EXISTS "extractedSkills",
DROP COLUMN IF EXISTS "extractedExperience",
DROP COLUMN IF EXISTS "extractedEducation",
DROP COLUMN IF EXISTS "extractedJobLevel",
DROP COLUMN IF EXISTS "extractedKeywords",
DROP COLUMN IF EXISTS "extractedBenefits",
DROP COLUMN IF EXISTS "lastExtractedAt",
DROP COLUMN IF EXISTS "extractionConfidence";

-- Revert code
git revert HEAD
git push origin main
```

## Success Criteria

- ✅ Migration runs without errors
- ✅ Backend deploys successfully
- ✅ Frontend builds and deploys
- ✅ Jobs show extracted metadata in UI
- ✅ Skills/experience are accurate (not hardcoded)
- ✅ Skill matching works for users with profiles
- ✅ No increase in error rate
- ✅ API response times remain < 200ms

## Monitoring After Deployment

### Week 1: Watch for Issues

- **Extraction failures**: Check for jobs with `extractionConfidence < 0.5`
- **API costs**: Monitor OpenAI usage (should be ~$0.0001 per job)
- **Performance**: Ensure sync doesn't slow down
- **User feedback**: Watch for complaints about inaccurate skills

### Week 2: Optimize

- Re-extract low-confidence jobs
- Add skill taxonomy/normalization
- Consider batch extraction for old jobs

## Questions?

Contact: [Your contact info]

**Documentation**: See [JOB_METADATA_EXTRACTION_COMPLETE.md](JOB_METADATA_EXTRACTION_COMPLETE.md) for full details.

# Job Description Fetching - FIXED ✅

## Problem
The APIs (Greenhouse and Lever) **were** providing full job descriptions, but we were only calling the **LIST** endpoints which return minimal data without complete descriptions and requirements.

## Root Cause
In [smart-aggregator.js](server/lib/job-sources/smart-aggregator.js):
- **Greenhouse**: Was calling `GET /v1/boards/{company}/jobs` (list endpoint)
  - Returns: `{ jobs: [{ id, title, location, updated_at, absolute_url }] }`
  - Missing: Full `content` field with HTML description
- **Lever**: Was already using correct endpoint but not extracting requirements

## Solution Implemented

### 1. Enhanced Greenhouse Fetching (Lines 193-322)
Now uses **two-step process**:
1. **Step 1**: Fetch list of jobs from `GET /v1/boards/{company}/jobs`
2. **Step 2**: For each job, fetch full details from `GET /v1/boards/{company}/jobs/{job_id}`
   - This returns `content` field with full HTML description
   - Includes all sections: "Who we are", "What you'll do", "Requirements", etc.

```javascript
// OLD CODE (minimal data)
const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${company}/jobs`);
const data = await response.json();
return data.jobs.map(job => ({
  description: job.content || '', // Empty!
}));

// NEW CODE (full data)
const listData = await listResponse.json();
const jobsWithDetails = await Promise.all(
  listData.jobs.map(async (job) => {
    const detailResponse = await fetch(
      `https://boards-api.greenhouse.io/v1/boards/${company}/jobs/${job.id}`
    );
    const fullJob = await detailResponse.json();
    return {
      description: fullJob.content || '', // Full HTML description!
      requirements: extractRequirementsFromHTML(fullJob.content)
    };
  })
);
```

### 2. Enhanced Lever Fetching (Lines 328-398)
Already had full descriptions, now also extracts requirements:
```javascript
const jobs = await response.json();
return jobs.map(job => {
  const requirements = this.extractRequirementsFromHTML(job.description || '');
  return {
    description: job.description || '', // Full HTML (already there)
    requirements: requirements // Now extracted!
  };
});
```

### 3. New Helper Method (Lines 628-699)
Added `extractRequirementsFromHTML()` method:
- Parses HTML to find "Requirements", "Qualifications", "Must have", etc. sections
- Extracts text between requirement header and next section
- Returns clean text (max 5000 chars)
- Fallback: Returns first 1000 chars if no requirements section found

## Test Results

Tested with Stripe (Greenhouse):
```
✅ Sample Job from Stripe:
   - Description length: 3,959 characters (was ~0 before)
   - Requirements length: 598 characters (was null before)
   - Full HTML including:
     * "Who we are" section
     * "About Stripe" section
     * "What you'll do" section
     * "Minimum requirements" section
```

## Current Database Status

**Existing Jobs (9,958 jobs)**: Still have minimal descriptions
- These were synced with the OLD code
- Need to be re-synced to get full descriptions

**New Jobs**: Will automatically have full descriptions
- Auto-sync runs every 6 hours
- Next sync will fetch full descriptions for all jobs

## Next Steps

### Option 1: Re-sync All Jobs (Recommended)
```bash
cd /Users/vinaymuthareddy/RESUME_GENERATOR/server
node scripts/run-full-sync.js
```
This will:
- Update all 9,958 existing jobs with full descriptions
- Takes ~15-20 minutes (fetching 2x data per job)
- Updates database with complete job information

### Option 2: Wait for Automatic Sync
- Auto-sync runs every 6 hours
- Will gradually update jobs as they're refreshed
- Takes longer but happens automatically

## API Details

### Greenhouse API
- **List Endpoint**: `GET /v1/boards/{company}/jobs`
  - Returns: Minimal job data
  - Rate limit: None specified
  - Response: `{ jobs: [{ id, title, location, updated_at }] }`

- **Detail Endpoint**: `GET /v1/boards/{company}/jobs/{job_id}` ✅ NOW USING THIS
  - Returns: Full job data including `content` field
  - Rate limit: None specified
  - Response: `{ id, title, content: "<full HTML>", ... }`

### Lever API
- **Postings Endpoint**: `GET /v0/postings/{company}?mode=json`
  - Already returns full descriptions ✅
  - Now also extracts requirements

## Files Modified
1. [server/lib/job-sources/smart-aggregator.js](server/lib/job-sources/smart-aggregator.js)
   - Line 193-322: Enhanced `fetchFromGreenhouse()`
   - Line 328-398: Enhanced `fetchFromLever()`
   - Line 628-699: New `extractRequirementsFromHTML()` method

## Impact
- ✅ All future job syncs will have complete descriptions
- ✅ Requirements are automatically extracted
- ✅ Better data for AI resume generation
- ✅ Better job listings for users
- ⚠️ Existing jobs need re-sync to get full descriptions

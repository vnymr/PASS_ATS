# ATS Platform Testing Guide

## Overview

We have **two systems** for auto-applying to jobs:

1. **AI Form Filler** (Current - Working ✅)
   - Uses GPT-4o-mini to analyze and fill ANY form
   - Cost: $0.0003 per application
   - No pre-recording needed
   - **100% success rate** on test forms
   - Works with any ATS platform

2. **Recipe Engine** (Alternative - Not Yet Tested)
   - Pre-recorded steps for specific ATS platforms
   - Record once ($0.80), replay forever ($0.05)
   - Faster (no AI analysis needed)
   - Limited to known platforms (Greenhouse, Lever, Ashby)

## Current Strategy

The queue uses **AI_FIRST** strategy (configured in `.env`):

```
APPLY_STRATEGY=AI_FIRST
```

Flow:
1. **First**: Try AI form filler (works for any ATS)
2. **Fallback**: If AI fails, try recipe engine (if recipe exists)

Other strategies available:
- `RECIPE_ONLY`: Only use recipes (ignore AI)
- `AI_ONLY`: Only use AI (ignore recipes)

## Testing Plan

### Phase 1: Test AI Form Filler with Real ATS Platforms ✅ READY TO TEST

We already have **100% success** on test forms. Now test with real ATS platforms.

#### Target Platforms to Test

1. **Greenhouse** (Most common)
   - Example: https://boards.greenhouse.io/[company]/jobs/[job-id]
   - Test companies: Stripe, Airbnb, DoorDash, etc.

2. **Lever** (Second most common)
   - Example: https://jobs.lever.co/[company]/[job-id]
   - Test companies: Netflix, Uber, Lyft, etc.

3. **Ashby** (Growing popularity)
   - Example: https://jobs.ashbyhq.com/[company]/[job-id]
   - Test companies: Modern startups

4. **Workday** (Enterprise)
   - Example: https://[company].wd1.myworkdayjobs.com/[job-id]
   - Test companies: Amazon, Netflix, etc.

5. **iCIMS** (Corporate)
   - Example: https://[company].icims.com/jobs/[job-id]
   - Test companies: Various corporations

6. **BambooHR**
   - Example: https://[company].bamboohr.com/jobs/view.php?id=[job-id]
   - Test companies: Small-medium businesses

7. **JazzHR**
   - Example: https://[company].applytojob.com/apply/[job-id]
   - Test companies: Various SMBs

#### How to Test AI Form Filler

**Option 1: Manual Test via Frontend**

1. Start all services:
   ```bash
   # Terminal 1: API + Database
   cd server && npm start

   # Terminal 2: Worker
   node server/auto-apply-worker.js

   # Terminal 3: Frontend
   cd frontend && npm run dev
   ```

2. Login to frontend (http://localhost:5173)

3. Go to "Find Jobs" page

4. Find a job with `aiApplyable: true` (any job from our aggregator)

5. Click "Auto-Apply" button

6. Go to "Agent Dashboard" to watch real-time progress

7. **Observe**:
   - Status changes: QUEUED → APPLYING → SUBMITTED
   - Fields extracted count
   - Fields filled count
   - Success/failure
   - Screenshot (if succeeded)
   - Error details (if failed)

**Option 2: Direct Script Test**

Create a test script for specific ATS platforms:

```bash
# Create test script
node server/scripts/test-ats-platform.js
```

I'll create this script for you below.

**Option 3: Database Direct Insert**

```sql
-- Insert test application
INSERT INTO "AutoApplication" (
  "userId",
  "jobId",
  "jobUrl",
  "atsType",
  "status",
  "createdAt",
  "updatedAt"
) VALUES (
  3, -- Your test user ID
  'test-greenhouse-001',
  'https://boards.greenhouse.io/stripe/jobs/123456', -- Real job URL
  'GREENHOUSE',
  'QUEUED',
  NOW(),
  NOW()
);

-- Then queue it via API or script
```

### Phase 2: Analyze Results

For each platform tested, track:

| Platform | Job URL | Status | Fields Found | Fields Filled | Success Rate | Errors | Notes |
|----------|---------|--------|--------------|---------------|--------------|--------|-------|
| Greenhouse | stripe.com/jobs/123 | ✅ SUBMITTED | 15 | 15 | 100% | None | Perfect |
| Lever | uber.com/jobs/456 | ❌ FAILED | 12 | 8 | 67% | File upload failed | Need to add resume upload |
| Ashby | startup.com/jobs/789 | ✅ SUBMITTED | 10 | 10 | 100% | None | Perfect |
| Workday | amazon.com/jobs/101 | ❌ FAILED | 0 | 0 | 0% | Multi-step form | Need multi-page support |

### Phase 3: Identify Patterns

After testing 10-20 applications, analyze:

1. **Success Rate by Platform**
   - Which ATS platforms work best?
   - Which ones consistently fail?

2. **Common Failure Patterns**
   - File uploads failing?
   - Multi-step forms not handled?
   - Specific field types not working?

3. **Field Type Coverage**
   - Text inputs: ✅
   - Email: ✅
   - Phone: ✅
   - Select dropdowns: ✅
   - Radio buttons: ✅
   - Checkboxes: ✅
   - File upload: ❓ (Not yet tested)
   - Date pickers: ❓ (Not yet tested)
   - Rich text editors: ❓ (Not yet tested)

### Phase 4: Create Recipes for Problem Platforms

If certain platforms consistently fail with AI, create **recipes**:

#### Option A: Manual Recipe Creation

Edit `hardcoded-recipes.js` and add platform-specific recipe:

```javascript
const WORKDAY_RECIPE = {
  platform: 'workday',
  atsType: 'WORKDAY',
  steps: [
    {
      action: 'type',
      selector: 'input[name="firstName"]',
      value: '{{personalInfo.firstName}}',
      fieldName: 'First Name',
      required: true
    },
    // ... more steps
  ]
};
```

Then initialize:

```bash
node -e "
import('./server/lib/hardcoded-recipes.js').then(m => {
  m.initializeHardcodedRecipes();
});
"
```

#### Option B: BrowserUse Recording (Not Implemented Yet)

The recipe engine has `recordWithBrowserUse()` but requires:
1. `BROWSERUSE_API_KEY` in .env
2. `browser-use` npm package installed

This would automatically record steps while AI fills the form, then replay later.

## Test Script

Here's a script to test specific ATS platforms:

```javascript
// server/scripts/test-ats-platform.js

import { queueAutoApply, getQueueStats } from '../lib/auto-apply-queue.js';
import { prisma } from '../lib/prisma-client.js';

const TEST_PLATFORMS = [
  {
    name: 'Greenhouse',
    jobUrl: 'https://boards.greenhouse.io/stripe/jobs/12345',
    atsType: 'GREENHOUSE'
  },
  {
    name: 'Lever',
    jobUrl: 'https://jobs.lever.co/netflix/67890',
    atsType: 'LEVER'
  },
  {
    name: 'Generic Form',
    jobUrl: 'https://httpbin.org/forms/post',
    atsType: 'GENERIC'
  }
];

async function testPlatform(platform, userId) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: ${platform.name}`);
  console.log(`URL: ${platform.jobUrl}`);
  console.log(`${'='.repeat(80)}\n`);

  // Create application record
  const application = await prisma.autoApplication.create({
    data: {
      userId,
      jobId: `test-${platform.atsType.toLowerCase()}-${Date.now()}`,
      jobUrl: platform.jobUrl,
      atsType: platform.atsType,
      status: 'QUEUED'
    }
  });

  console.log(`✅ Application created: ${application.id}`);

  // Queue the job
  const job = await queueAutoApply({
    applicationId: application.id,
    jobUrl: platform.jobUrl,
    atsType: platform.atsType,
    userId
  });

  console.log(`✅ Job queued: ${job.id}`);
  console.log(`   Waiting for worker to process...\n`);

  // Monitor for 60 seconds
  for (let i = 0; i < 30; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000));

    const current = await prisma.autoApplication.findUnique({
      where: { id: application.id }
    });

    console.log(`   [${i * 2}s] Status: ${current.status}`);

    if (current.status === 'SUBMITTED') {
      console.log(`\n✅ SUCCESS!`);
      console.log(`   Method: ${current.method}`);
      console.log(`   Cost: $${current.cost?.toFixed(4)}`);
      console.log(`   Fields extracted: ${current.confirmationData?.fieldsExtracted}`);
      console.log(`   Fields filled: ${current.confirmationData?.fieldsFilled}`);
      console.log(`   Success rate: ${(current.confirmationData?.fieldsFilled / current.confirmationData?.fieldsExtracted * 100).toFixed(1)}%`);
      return { success: true, application: current };
    }

    if (current.status === 'FAILED') {
      console.log(`\n❌ FAILED`);
      console.log(`   Error: ${current.error}`);
      console.log(`   Error type: ${current.errorType}`);
      return { success: false, application: current };
    }
  }

  console.log(`\n⏱️  Timeout - still processing`);
  return { success: false, timeout: true };
}

async function runTests() {
  const TEST_USER_ID = 3; // Change to your test user ID

  console.log(`\n🧪 ATS Platform Testing Suite\n`);
  console.log(`Using test user ID: ${TEST_USER_ID}\n`);

  const results = [];

  for (const platform of TEST_PLATFORMS) {
    const result = await testPlatform(platform, TEST_USER_ID);
    results.push({
      platform: platform.name,
      ...result
    });

    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // Summary
  console.log(`\n\n${'='.repeat(80)}`);
  console.log(`TEST SUMMARY`);
  console.log(`${'='.repeat(80)}\n`);

  for (const result of results) {
    const status = result.success ? '✅ PASSED' : '❌ FAILED';
    console.log(`${status} - ${result.platform}`);

    if (result.application) {
      console.log(`         Fields: ${result.application.confirmationData?.fieldsFilled}/${result.application.confirmationData?.fieldsExtracted}`);
      console.log(`         Cost: $${result.application.cost?.toFixed(4)}`);
    }
  }

  const passed = results.filter(r => r.success).length;
  const total = results.length;
  console.log(`\nOverall: ${passed}/${total} platforms passed (${(passed/total*100).toFixed(1)}%)`);

  await prisma.$disconnect();
}

runTests();
```

Save this and run:

```bash
node server/scripts/test-ats-platform.js
```

## Recommended Testing Sequence

### Week 1: Basic Testing

1. ✅ **Test generic forms** (already done - 100% success)
2. **Test Greenhouse** (3-5 real jobs)
3. **Test Lever** (3-5 real jobs)
4. **Analyze results** - what worked, what didn't?

### Week 2: Expand Coverage

5. **Test Ashby** (2-3 jobs)
6. **Test Workday** (2-3 jobs)
7. **Test other platforms** (iCIMS, BambooHR, etc.)
8. **Identify failure patterns**

### Week 3: Fix Issues

9. **Add file upload support** (if needed)
10. **Handle multi-step forms** (if needed)
11. **Fix specific field types** (date pickers, etc.)
12. **Re-test failed platforms**

### Week 4: Recipe Creation

13. **Create recipes for complex platforms**
14. **Test recipe engine**
15. **Compare AI vs Recipe performance**
16. **Optimize based on results**

## How to Find Test Jobs

### Safe Testing (Recommended)

Use **fake test forms**:

1. **HTTPBin Form** ✅ (already tested)
   - https://httpbin.org/forms/post
   - Safe, no real applications

2. **W3Schools Forms**
   - Various form examples
   - Safe testing environment

3. **Test Job Boards**
   - Create test postings on free platforms
   - Fill your own forms

### Real Testing (Careful!)

**WARNING**: Only test on jobs you actually want to apply to!

1. **LinkedIn Easy Apply**
   - Public job listings
   - Test with real applications
   - Track if you get responses

2. **Indeed Apply**
   - Similar to LinkedIn
   - Real applications

3. **Company Career Pages**
   - Direct applications
   - Various ATS platforms

**Best Practice**: Always review the application before submission in production!

## Monitoring & Debugging

### Check Worker Logs

```bash
# If using PM2
pm2 logs auto-apply-worker

# If running directly
# Check terminal output
```

### Check Database

```sql
-- Recent applications
SELECT
  id,
  "jobUrl",
  "atsType",
  status,
  method,
  cost,
  "confirmationData"->>'fieldsExtracted' as extracted,
  "confirmationData"->>'fieldsFilled' as filled,
  error,
  "createdAt"
FROM "AutoApplication"
ORDER BY "createdAt" DESC
LIMIT 20;

-- Success rate by platform
SELECT
  "atsType",
  COUNT(*) as total,
  SUM(CASE WHEN status = 'SUBMITTED' THEN 1 ELSE 0 END) as succeeded,
  ROUND(
    100.0 * SUM(CASE WHEN status = 'SUBMITTED' THEN 1 ELSE 0 END) / COUNT(*),
    2
  ) as success_rate
FROM "AutoApplication"
GROUP BY "atsType"
ORDER BY total DESC;

-- Common errors
SELECT
  error,
  "errorType",
  COUNT(*) as occurrences
FROM "AutoApplication"
WHERE status = 'FAILED'
GROUP BY error, "errorType"
ORDER BY occurrences DESC
LIMIT 10;
```

### Check Screenshots

Screenshots are stored in `confirmationUrl` field (base64 or file path).

Extract and view:

```javascript
// Get screenshot from database
const app = await prisma.autoApplication.findUnique({
  where: { id: 'app-id-here' }
});

// If base64
if (app.confirmationUrl.startsWith('data:image')) {
  // Save to file
  const base64Data = app.confirmationUrl.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync('screenshot.png', buffer);
}
```

## Expected Results

### Ideal Scenario

- ✅ 90%+ success rate on standard forms
- ✅ <5 seconds per application
- ✅ <$0.001 cost per application
- ✅ Clear error messages for failures
- ✅ Screenshots for verification

### Realistic Scenario

- ✅ 70-80% success rate (some platforms will fail)
- ✅ 5-10 seconds per application
- ✅ $0.0003-0.0005 cost per application
- ⚠️ Some failures due to:
  - CAPTCHAs
  - Multi-step forms
  - Custom widgets
  - File upload requirements
  - Authentication walls

## Next Steps After Testing

Based on test results:

1. **If 80%+ success** → Deploy to production, collect real user feedback

2. **If 50-80% success** → Fix common issues, add file upload, re-test

3. **If <50% success** → Focus on recipe creation for problem platforms

4. **Long-term**:
   - Build recipe library for top 20 ATS platforms
   - Add BrowserUse integration for auto-recording
   - Implement multi-step form navigation
   - Add resume upload functionality
   - Create admin dashboard for monitoring

## Summary

**Ready to test right now**:
- ✅ AI form filler is working (100% on test forms)
- ✅ Worker is ready
- ✅ Queue system functional
- ✅ Frontend dashboard for monitoring

**How to start testing**:
1. Pick a Greenhouse job URL
2. Queue it via frontend or script
3. Watch worker logs + dashboard
4. Analyze results
5. Repeat with more platforms

**Goal**: Get data on real-world success rates across different ATS platforms, then optimize based on findings.

The system is **production-ready for testing** - we just need real job URLs to test against! 🚀

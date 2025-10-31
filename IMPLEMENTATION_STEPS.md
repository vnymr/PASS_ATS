# Implementation Steps for CAPTCHA Fix

## Quick Fix (Immediate)

1. **Update the existing auto-apply-queue.js to use improved flow:**

```javascript
// At the top of auto-apply-queue.js, add:
import ImprovedAutoApply from './improved-auto-apply.js';

// Replace the applyWithAI function call (line 566) with:
const improvedApply = new ImprovedAutoApply();
result = await improvedApply.applyToJob(jobUrl, user, jobData, resumePath);
```

2. **Test with a real job:**
```bash
# Test with debugging enabled
DEBUG=* node scripts/test-real-job.js "https://job-boards.greenhouse.io/tenstorrent/jobs/4738082007"
```

## Full Integration (Recommended)

1. **Backup current files:**
```bash
cp server/lib/auto-apply-queue.js server/lib/auto-apply-queue.js.backup
cp server/lib/ai-form-filler.js server/lib/ai-form-filler.js.backup
```

2. **Update auto-apply-queue.js:**
```javascript
// Replace lines 90-441 (the applyWithAI function) with:
import ImprovedAutoApply from './improved-auto-apply.js';

async function applyWithAI(jobUrl, user, jobData, resumePath) {
  const improvedApply = new ImprovedAutoApply();
  return await improvedApply.applyToJob(jobUrl, user, jobData, resumePath);
}
```

3. **Update ai-form-filler.js:**
```javascript
// Remove CAPTCHA detection from fillFormIntelligently (lines 65-88)
// The improved flow handles CAPTCHA before form filling
```

## Testing Checklist

- [ ] Test with Greenhouse job (has CAPTCHA often)
- [ ] Test with Lever job (usually no CAPTCHA)
- [ ] Test with Workday job
- [ ] Verify 2Captcha charges are correct (~$0.03 per solve)
- [ ] Check that forms are filled correctly
- [ ] Verify submission works

## Monitoring

Add logging to track:
- CAPTCHA detection rate
- CAPTCHA solve success rate
- Cost per application
- Time per application

## Rollback Plan

If issues occur:
```bash
# Restore backups
cp server/lib/auto-apply-queue.js.backup server/lib/auto-apply-queue.js
cp server/lib/ai-form-filler.js.backup server/lib/ai-form-filler.js

# Restart worker
pm2 restart auto-apply-worker
```

## Environment Variables

Ensure these are set:
```env
TWOCAPTCHA_API_KEY=7bb64c23273cc62f83e1a69cbb6771b2
SKIP_CAPTCHA_FOR_TESTING=false  # Set to true for testing without solving
HEADLESS=true  # Set to false to see browser during testing
```

## Success Metrics

Track these KPIs:
- Application success rate > 80%
- CAPTCHA solve rate > 95%
- Cost per application < $0.10
- Time per application < 30 seconds

## Support

If issues persist:
1. Check 2Captcha balance: `node scripts/check-2captcha-balance.js`
2. Enable debug logging: `DEBUG=* node auto-apply-worker.js`
3. Review screenshots in `test-output/` directory
4. Check Railway logs: `railway logs`
# Puppeteer → Playwright Migration Plan

**Date**: November 5, 2025
**Author**: AI-Assisted Migration
**Backup Commit**: `287409c`
**Backup File**: `server-backup-puppeteer-20251105-184606.tar.gz`

---

## Executive Summary

This document outlines a **safe, phased migration** from Puppeteer to Playwright to solve custom dropdown handling issues and improve long-term maintainability.

**Migration Duration**: Estimated 4-6 hours
**Risk Level**: Medium (with mitigation strategies)
**Rollback Time**: < 5 minutes (git revert)

---

## 1. Why Migrate to Playwright?

### Current Problems with Puppeteer
- ❌ Custom dropdowns (Greenhouse) not filling correctly
- ❌ Manual waits required everywhere
- ❌ Verbose selector strategies
- ❌ Timing issues with async loading
- ❌ Poor ARIA role support

### Benefits of Playwright
- ✅ Built-in auto-waiting (no manual `waitForSelector`)
- ✅ Better ARIA selectors (`getByRole('combobox')`)
- ✅ More reliable with custom components
- ✅ Better error messages
- ✅ Multi-browser support (Chrome, Firefox, WebKit)
- ✅ Industry standard for modern web automation (2024+)

---

## 2. Files Affected (9 files)

### Core Browser Files (High Priority)
1. **lib/browser-launcher.js** - Browser initialization
2. **lib/browser-pool.js** - Connection pooling
3. **lib/improved-auto-apply.js** - Main auto-apply logic

### Form Interaction Files (Critical for Dropdowns)
4. **lib/ai-form-extractor.js** - Form field extraction
5. **lib/ai-form-filler.js** - Form filling logic

### Supporting Files (Medium Priority)
6. **lib/auto-apply-queue.js** - Queue management
7. **lib/browser-recorder.js** - Session recording
8. **lib/recipe-engine.js** - Recipe execution
9. **lib/html-generator.js** - HTML generation

### Configuration
10. **package.json** - Dependencies

---

## 3. API Migration Mapping

### Browser Launch
```javascript
// BEFORE (Puppeteer)
const puppeteer = require('puppeteer');
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox']
});

// AFTER (Playwright)
const { chromium } = require('playwright');
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox']
});
```

### Page Navigation
```javascript
// BEFORE
await page.goto(url, { waitUntil: 'networkidle2' });

// AFTER
await page.goto(url, { waitUntil: 'networkidle' });
```

### Selectors
```javascript
// BEFORE
await page.click('button[type="submit"]');
await page.waitForSelector('.success');

// AFTER
await page.click('button[type="submit"]');  // Auto-waits!
await page.locator('.success').waitFor();   // Explicit if needed
```

### Custom Dropdowns (The Main Win!)
```javascript
// BEFORE (Puppeteer - Complex & Unreliable)
await page.click('input[role="combobox"]');
await page.waitForSelector('ul[role="listbox"]', { visible: true });
const options = await page.$$('li[role="option"]');
// ... complex matching logic ...
await options[0].click();

// AFTER (Playwright - Clean & Reliable)
await page.getByRole('combobox').click();
await page.getByRole('option', { name: 'Option Text' }).click();
// Auto-waits built-in! 🎉
```

### Evaluate
```javascript
// BEFORE & AFTER (Same!)
await page.evaluate(() => { ... });
```

---

## 4. Migration Phases

### Phase 1: Setup & Dependencies (30 minutes)
**Goal**: Install Playwright alongside Puppeteer (run both temporarily)

**Steps**:
1. ✅ Create backups (DONE)
2. Install Playwright: `npm install playwright`
3. Create wrapper module `lib/browser-adapter.js` to support both
4. Test basic launch with Playwright

**Success Criteria**: Both Puppeteer and Playwright can launch browsers

---

### Phase 2: Core Browser Migration (1-2 hours)
**Goal**: Migrate browser launch, pooling, and basic navigation

**Order** (safest first):
1. **lib/browser-launcher.js** (low risk)
   - Update `launch()` method
   - Keep same interface

2. **lib/browser-pool.js** (medium risk)
   - Update connection pooling
   - Test concurrent workers

3. **lib/browser-recorder.js** (low risk)
   - Update recording logic
   - Mostly same API

**Success Criteria**: Browser pool launches successfully, no crashes

---

### Phase 3: Form Interaction Migration (2-3 hours)
**Goal**: Fix custom dropdown handling (the main issue!)

**Order**:
1. **lib/ai-form-extractor.js** (high priority)
   - Update `extractCustomDropdownOptions()` to use Playwright selectors
   - Use `getByRole('combobox')` and `getByRole('option')`
   - Leverage auto-waiting

2. **lib/ai-form-filler.js** (critical)
   - Update `fillCustomDropdown()` with click-based approach
   - Remove manual waits (Playwright auto-waits)
   - Update `fillSelect()`, `fillTextInput()`, etc.

3. **lib/improved-auto-apply.js** (integration)
   - Update page interactions
   - Test full application flow

**Success Criteria**: Greenhouse dropdowns fill correctly in test

---

### Phase 4: Supporting Files (1 hour)
**Goal**: Migrate remaining files

**Order**:
1. **lib/auto-apply-queue.js** - Update queue browser management
2. **lib/recipe-engine.js** - Update recipe execution
3. **lib/html-generator.js** - Update HTML generation (if needed)

**Success Criteria**: All tests pass

---

### Phase 5: Testing & Validation (1 hour)
**Goal**: Ensure everything works

**Tests**:
1. ✅ Browser launches successfully
2. ✅ Browser pool creates 10 workers
3. ✅ Form extraction finds all fields
4. ✅ **Custom dropdowns fill correctly** (Greenhouse test)
5. ✅ Text fields fill correctly
6. ✅ File uploads work
7. ✅ CAPTCHA handling works
8. ✅ Full application submission succeeds
9. ✅ Queue processes multiple jobs
10. ✅ Error handling works

**Success Criteria**: All 10 tests pass

---

### Phase 6: Cleanup (30 minutes)
**Goal**: Remove Puppeteer completely

**Steps**:
1. Remove `puppeteer` from package.json
2. Delete `lib/browser-adapter.js` (if created)
3. Run `npm prune`
4. Update documentation
5. Create final migration commit

**Success Criteria**: No Puppeteer references remain

---

## 5. Risk Mitigation Strategies

### Risk 1: Migration Breaks Production
**Mitigation**:
- ✅ Git backup created (`287409c`)
- ✅ Tar.gz backup created
- ✅ Phase-by-phase approach (test each phase)
- ✅ Keep Puppeteer installed during migration
- ✅ Can rollback instantly: `git reset --hard 287409c`

### Risk 2: API Differences Cause Bugs
**Mitigation**:
- ✅ API mapping document (this file)
- ✅ Test each file after migration
- ✅ Playwright has similar API to Puppeteer (easy migration)
- ✅ Comprehensive test suite

### Risk 3: Performance Degradation
**Mitigation**:
- ✅ Playwright is faster (auto-waiting)
- ✅ Test concurrent workers (browser pool)
- ✅ Monitor memory usage
- ✅ Can tune Playwright config if needed

### Risk 4: Custom Dropdowns Still Don't Work
**Mitigation**:
- ✅ Playwright specifically better at this
- ✅ Test with Greenhouse first
- ✅ Can add custom retry logic
- ✅ Have XPath fallback selectors

---

## 6. Testing Strategy

### Unit Tests (Each Phase)
- Test file in isolation
- Mock dependencies
- Verify API contracts

### Integration Tests (Phase 3)
- Test form extraction + filling together
- Test with real Greenhouse page
- Verify dropdown options extracted and filled

### End-to-End Tests (Phase 5)
- Full application flow
- Real job applications
- Queue processing
- Error scenarios

---

## 7. Rollback Plan

### Quick Rollback (< 5 minutes)
```bash
# Option 1: Git reset
git reset --hard 287409c
npm install

# Option 2: Extract backup
cd /Users/vinaymuthareddy/RESUME_GENERATOR
tar -xzf server-backup-puppeteer-20251105-184606.tar.gz
cd server && npm install
```

### Partial Rollback
- Revert specific files: `git checkout 287409c -- lib/file.js`
- Keep Playwright installed: useful for side-by-side comparison

---

## 8. Success Metrics

### Must Have ✅
- [ ] All 9 files migrated successfully
- [ ] Greenhouse custom dropdowns fill correctly
- [ ] All existing tests pass
- [ ] No performance regression
- [ ] Zero crashes during testing

### Nice to Have 🎯
- [ ] Faster execution (Playwright auto-wait)
- [ ] Better error messages
- [ ] Code is cleaner/simpler
- [ ] Multi-browser support enabled

---

## 9. Post-Migration Checklist

- [ ] Remove Puppeteer from package.json
- [ ] Update README.md with Playwright info
- [ ] Update deployment docs
- [ ] Train team on Playwright differences
- [ ] Create Playwright best practices doc
- [ ] Monitor production for 24 hours
- [ ] Document any issues encountered
- [ ] Create "lessons learned" summary

---

## 10. Timeline

| Phase | Duration | Can Start | Blocker |
|-------|----------|-----------|---------|
| **Phase 1**: Setup | 30 min | Now | None |
| **Phase 2**: Core Browser | 1-2 hrs | After Phase 1 | Phase 1 success |
| **Phase 3**: Form Interaction | 2-3 hrs | After Phase 2 | Phase 2 success |
| **Phase 4**: Supporting Files | 1 hr | After Phase 3 | Phase 3 success |
| **Phase 5**: Testing | 1 hr | After Phase 4 | All phases complete |
| **Phase 6**: Cleanup | 30 min | After Phase 5 | Tests passing |
| **TOTAL** | **4-6 hrs** | | |

---

## 11. Key Differences: Puppeteer vs Playwright

### Auto-Waiting
```javascript
// Puppeteer: Manual waits everywhere
await page.waitForSelector('.element');
await page.click('.element');

// Playwright: Auto-waits built-in
await page.click('.element');  // Automatically waits!
```

### ARIA Selectors
```javascript
// Puppeteer: CSS selectors only
await page.click('input[role="combobox"]');

// Playwright: Semantic selectors
await page.getByRole('combobox').click();
await page.getByText('Submit').click();
await page.getByLabel('Email').fill('test@example.com');
```

### Assertions
```javascript
// Puppeteer: Manual
const text = await page.$eval('.title', el => el.textContent);
expect(text).toBe('Expected');

// Playwright: Built-in
await expect(page.locator('.title')).toHaveText('Expected');
```

---

## 12. Emergency Contacts & Resources

### Documentation
- Playwright Docs: https://playwright.dev/docs/intro
- Migration Guide: https://playwright.dev/docs/migration
- API Reference: https://playwright.dev/docs/api/class-playwright

### Support
- Playwright Discord: https://aka.ms/playwright/discord
- GitHub Issues: https://github.com/microsoft/playwright/issues

### This Project
- **Backup Commit**: `287409c`
- **Backup File**: `server-backup-puppeteer-20251105-184606.tar.gz`
- **Migration Branch**: `migration/puppeteer-to-playwright` (recommended)

---

## 13. Migration Command Reference

### Install Playwright
```bash
npm install playwright
npm install --save-dev @playwright/test  # For testing
```

### Run Tests
```bash
# Test specific file
node test-improved-flow.js

# Test with Playwright
BROWSER=playwright node test-improved-flow.js
```

### Rollback
```bash
# Full rollback
git reset --hard 287409c
npm install

# Partial rollback
git checkout 287409c -- lib/specific-file.js
```

---

## Conclusion

This migration is **low-risk** with proper execution:
- ✅ Backups created
- ✅ Phased approach
- ✅ Test after each phase
- ✅ Quick rollback available
- ✅ Clear success criteria

**Estimated Total Time**: 4-6 hours
**Risk Level**: Medium → Low (with mitigations)
**Benefit**: **Reliable custom dropdown handling** + cleaner code + better maintainability

**Ready to begin Phase 1!** 🚀

# Quick Test Guide - v1.2.4

## 🚀 Quick Start Testing (5 minutes)

### Step 1: Reload Extension
```bash
# Chrome: chrome://extensions
# Find "HappyResumes - AI Resume Builder"
# Click the circular reload icon 🔄
```

### Step 2: Test Authentication Sync
```bash
# Visit: https://happyresumes.com/dashboard
# Make sure you're logged in
# Wait 2 seconds
# Check for green checkmark badge on extension icon
```

**Expected Console Output**:
```
✅ HappyResumes Extension: Dashboard sync script STARTED
🔄 Starting token sync process...
🔍 Requesting token extraction from background service worker...
✅ Token extracted via service worker
✅ Token synced successfully!
```

### Step 3: Test Job Extraction
```bash
# Visit a LinkedIn job posting (example):
# https://www.linkedin.com/jobs/view/3858399999

# Press the keyboard shortcut:
# Mac: Command+Shift+Y
# Windows/Linux: Alt+Shift+R
```

**Expected**:
- Extension popup appears with job details
- Job description shows (length > 100 characters)
- Company and title extracted

### Step 4: Test Full Resume Generation
```bash
# From the popup that appeared:
# 1. Click "Generate Resume" button
# 2. Wait 30-45 seconds
# 3. PDF should auto-download
```

**Expected**:
- Extension badge shows progress: `...` → `25%` → `50%` → `✓`
- Notification: "Resume Ready!"
- PDF downloads automatically

---

## 🔍 Debug Commands

### Check Stored Token
```javascript
// Open DevTools on happyresumes.com
chrome.storage.local.get(['clerk_session_token', 'clerk_token_updated_at', 'user_email'], (result) => {
  console.log('Token:', result.clerk_session_token ? '✅ Present' : '❌ Missing');
  console.log('Email:', result.user_email || 'None');
  console.log('Updated:', new Date(result.clerk_token_updated_at).toLocaleString());
});
```

### Manually Trigger Token Sync
```javascript
// On happyresumes.com dashboard:
chrome.runtime.sendMessage({ type: 'REQUEST_TOKEN_REFRESH' });
```

### Test API Connection
```javascript
// Check if API is reachable:
fetch('https://api.happyresumes.com/health')
  .then(r => r.json())
  .then(d => console.log('✅ API healthy:', d))
  .catch(e => console.error('❌ API error:', e));
```

### Check Extension Background Logs
```bash
# Chrome: chrome://extensions
# Click "service worker" link under HappyResumes extension
# This opens the background script console
```

---

## ❌ Common Issues & Fixes

### Issue 1: "No authentication token found"
**Cause**: Not logged in or Clerk session expired

**Fix**:
1. Go to https://happyresumes.com/dashboard
2. Log in with Clerk
3. Wait 2 seconds for auto-sync
4. Try job extraction again

### Issue 2: "Job description too short (length: 0)"
**Cause**: Selectors not finding content on specific job site

**Fix**:
1. Make sure you're on an actual job posting page (not search results)
2. Wait for page to fully load before activating extension
3. Check console for selector errors

### Issue 3: Extension icon has no badge
**Cause**: Extension not activated on current page

**Fix**:
1. Use keyboard shortcut: **Cmd+Shift+Y** (Mac) or **Alt+Shift+R** (Windows)
2. Extension only activates when shortcut is pressed (not automatic)

### Issue 4: "CSP violation" errors in console
**Cause**: Old extension version still cached

**Fix**:
1. Go to chrome://extensions
2. Click **Remove** on old version
3. Reload the extension folder
4. Hard refresh the web page (Cmd+Shift+R / Ctrl+Shift+R)

---

## ✅ Success Indicators

### Authentication Working:
- ✅ Green checkmark badge appears after visiting dashboard
- ✅ Console shows: `✅ Token synced successfully!`
- ✅ No CSP errors in console
- ✅ Token stored: `chrome.storage.local.get('clerk_session_token')` returns value

### Job Extraction Working:
- ✅ Extension popup appears when shortcut pressed
- ✅ Job title shows correctly
- ✅ Company name shows correctly
- ✅ Description length > 100 characters
- ✅ Console shows: `✅ Job page detected`

### Resume Generation Working:
- ✅ Badge shows progress: `...` → `50%` → `✓`
- ✅ Notification: "Resume Ready!"
- ✅ PDF downloads to ~/Downloads folder
- ✅ PDF opens and looks correct

---

## 🐛 Debugging Flow

If something doesn't work, follow this debugging sequence:

### 1. Check Extension Loaded
```bash
# chrome://extensions
# "HappyResumes - AI Resume Builder" should be enabled
# Version should be 1.2.4
```

### 2. Check Service Worker Running
```bash
# chrome://extensions
# Click "service worker" link
# Should see: "🚀 HappyResumes service worker loaded"
```

### 3. Check Content Script Injected
```bash
# Open DevTools on happyresumes.com/dashboard
# Console should show:
# "✅ HappyResumes Extension: Dashboard sync script STARTED"
```

### 4. Check Token Extraction
```bash
# Console should show within 5 seconds:
# "✅ Token extracted via service worker"
# "✅ Token synced successfully!"
```

### 5. Check Storage
```javascript
chrome.storage.local.get(null, (items) => {
  console.log('All stored data:', items);
  // Should include: clerk_session_token, user_email, apiBaseURL
});
```

### 6. If Still Failing
- Open background service worker console (step 2)
- Look for error messages
- Copy full error and check CSP_FIX_COMPLETE.md

---

## 📊 Expected Timeline

| Step | Expected Time | What's Happening |
|------|--------------|------------------|
| Token Sync | 2-5 seconds | Waiting for Clerk to load, extracting token |
| Job Detection | <1 second | Analyzing page with selectors |
| Job Extraction | 1-2 seconds | Scraping content, sending to API |
| Resume Generation | 30-45 seconds | AI generation + LaTeX compilation |
| PDF Download | 1-2 seconds | Fetching and downloading PDF |

**Total**: ~40-55 seconds from job page → downloaded resume

---

## 🎯 Test Checklist (Copy & Paste)

```
[ ] Extension reloaded and enabled
[ ] Service worker console shows no errors
[ ] Visited happyresumes.com/dashboard while logged in
[ ] Green checkmark badge appeared
[ ] Token stored (checked with chrome.storage command)
[ ] Visited a LinkedIn job posting
[ ] Pressed Cmd+Shift+Y (Mac) or Alt+Shift+R (Windows)
[ ] Extension popup appeared
[ ] Job details populated correctly
[ ] Clicked "Generate Resume"
[ ] Badge showed progress
[ ] PDF downloaded
[ ] PDF looks correct
```

---

## 🆘 Get Help

If tests fail after following this guide:

1. **Check Console Errors**: Open DevTools → Console tab
2. **Check Background Errors**: chrome://extensions → service worker
3. **Read Full Docs**: See `CSP_FIX_COMPLETE.md` for technical details
4. **Check API Status**: Run `fetch('https://api.happyresumes.com/health')`

**Still stuck?** Provide these details:
- Extension version (should be 1.2.4)
- Browser version
- Full console error message
- Which step failed

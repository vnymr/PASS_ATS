# HappyResumes Extension - Authentication Troubleshooting Guide

## Quick Fix Steps

### 1. Reload the Extension
1. Go to `chrome://extensions/`
2. Find "HappyResumes - AI Resume Builder"
3. Click the refresh icon ↻
4. Close all tabs

### 2. Sign In Process
1. Open the extension popup
2. Click "Sign In"
3. You'll be redirected to https://happyresumes.com
4. Sign in with your account
5. **IMPORTANT**: After signing in, you should see:
   - A blue notification: "🔄 Extension: Checking authentication..."
   - Then a green notification: "✅ Authentication synced to extension!"
6. Go back to the extension popup - it should show you're signed in

## Debugging Steps

### Check 1: Is the Content Script Loading?
1. Go to https://happyresumes.com/dashboard
2. Open Developer Console (F12)
3. Look for these messages:
   ```
   🔐 HappyResumes Extension: Dashboard sync script STARTED
   📍 Running on: https://happyresumes.com/dashboard
   ✅ On HappyResumes domain, initiating sync...
   ```

**If you don't see these messages:**
- The content script isn't loading
- Try reloading the extension (Step 1 above)

### Check 2: Is Clerk Available?
1. While on https://happyresumes.com
2. Open Developer Console (F12)
3. Go to Console tab
4. Copy and paste the entire contents of `test-token-extraction.js`
5. Press Enter

**Expected output:**
```
✅ window.Clerk exists
✅ Session exists
✅ User exists
✅ Token retrieved successfully!
```

### Check 3: Check Extension Storage
1. Open the extension popup
2. Right-click and select "Inspect"
3. Go to Console tab
4. Copy and paste the entire contents of `check-extension-storage.js`
5. Press Enter

**Expected output:**
```
✅ Token found in storage!
  - Token (first 50 chars): eyJhbGci...
  - User email: your@email.com
```

## Common Issues & Solutions

### Issue 1: "No Clerk token in chrome.storage"
**Symptoms:** Extension shows not signed in even after signing in on website

**Solutions:**
1. Make sure you're signed in on https://happyresumes.com
2. Refresh the dashboard page
3. Wait 3-5 seconds for sync
4. Check the browser console for sync notifications

### Issue 2: Content Script Not Running
**Symptoms:** No blue notification on happyresumes.com

**Solutions:**
1. Check manifest.json has correct permissions
2. Reload extension from chrome://extensions/
3. Make sure URL is exactly https://happyresumes.com (not http://)

### Issue 3: Token Expires
**Symptoms:** Was working, suddenly stops

**Solutions:**
1. Sign out from happyresumes.com
2. Sign back in
3. Extension should auto-sync within 2 seconds

### Issue 4: Multiple Tab Confusion
**Symptoms:** Token syncs but popup still shows signed out

**Solutions:**
1. Close all tabs except happyresumes.com
2. Reload the extension
3. Refresh the happyresumes.com tab
4. Open popup again

## Manual Token Sync

If automatic sync fails, you can manually trigger it:

1. Open https://happyresumes.com/dashboard
2. Open Developer Console (F12)
3. Run this command:
```javascript
// This will manually trigger the sync
if (window.syncTokenToExtension) {
  window.syncTokenToExtension();
} else {
  location.reload(); // Reload to get the sync script
}
```

## Extension Logs

To see detailed logs:

1. Go to `chrome://extensions/`
2. Find "HappyResumes - AI Resume Builder"
3. Click "background page" or "service worker"
4. This opens the background script console
5. Look for messages like:
   - `🚀 HappyResumes service worker loaded`
   - `📨 Internal message received`
   - `✅ Token from dashboard saved to storage`

## Still Not Working?

### Complete Reset
1. Go to `chrome://extensions/`
2. Remove the extension
3. Clear browser data for happyresumes.com
4. Re-install the extension
5. Sign in fresh

### Check Network
1. Open Network tab in Developer Tools
2. Look for failed requests to:
  - https://api.happyresumes.com
   - https://happyresumes.com

### Report Issue
If nothing works, gather this information:
1. Screenshot of extension popup
2. Console logs from happyresumes.com
3. Console logs from extension background script
4. Your Chrome version (chrome://version/)

## Testing Keyboard Shortcut

The extension uses keyboard shortcuts to activate:
- **Mac**: Cmd+Shift+Y
- **Windows/Linux**: Alt+Shift+R

To test:
1. Go to any job posting page
2. Press the shortcut
3. You should see the resume generation UI

To customize the shortcut:
1. Go to `chrome://extensions/shortcuts`
2. Find "HappyResumes - AI Resume Builder"
3. Set your preferred shortcut

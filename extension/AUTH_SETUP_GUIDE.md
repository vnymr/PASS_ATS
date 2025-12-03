# 🔐 Authentication Setup Guide for Quick Resume AI Extension

## ⚠️ IMPORTANT: Authentication Flow

The extension needs to connect to your HappyResumes account to generate resumes. Follow these steps **exactly** in order:

---

## Step 1: Install the Extension

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `/extension` folder
5. The extension icon should appear in your toolbar

---

## Step 2: Set Up Your Account

### First Time Users:
1. Click the extension icon in your toolbar
2. You'll see **"Sign in to generate resumes"**
3. Click **Sign In** button
4. This opens HappyResumes.com in a new tab
5. **Sign up** with your email or Google account
6. You'll be redirected to the Dashboard automatically

### Existing Users:
1. Click the extension icon
2. Click **Sign In** button
3. Sign in with your existing account
4. You'll see the Dashboard

---

## Step 3: Connect Extension to Your Account

### 🔴 CRITICAL: This step MUST happen on the Dashboard page

1. **After signing in**, make sure you're on the Dashboard page
2. The page URL should be: `https://happyresumes.com/dashboard`
3. **Wait 3-5 seconds** for the extension to sync
4. You should see a brief console message (if DevTools is open)

### How to Verify Connection:
1. Click the extension icon again
2. Instead of "Sign in", you should now see:
   - Your usage (e.g., "0/5")
   - Your tier (FREE or PRO)
   - The keyboard shortcut hint

### ❌ If Still Shows "Sign In":
1. Make sure you're signed in on the website
2. Go back to https://happyresumes.com/dashboard
3. **Refresh the Dashboard page** (Cmd+R or Ctrl+R)
4. Wait 5 seconds
5. Click the extension icon again
6. If still not working, try signing out and back in

---

## Step 4: Using the Extension

### Keyboard Shortcuts:
- **Windows/Linux**: `Alt + Shift + R`
- **Mac**: `⌘ + Shift + Y`

### To Customize Shortcuts:
1. Click extension icon
2. Click "Customize shortcut" link
3. Or go to `chrome://extensions/shortcuts`
4. Find "Quick Resume AI"
5. Click the pencil icon
6. Press your desired key combination

### Common Safe Shortcuts:
- `Ctrl + Shift + U` (Windows/Linux)
- `Cmd + Option + R` (Mac)
- `Alt + Shift + G` (Windows/Linux)
- `Cmd + Shift + 1` (Mac)

---

## Troubleshooting Authentication Issues

### Problem: Extension shows "Sign in" even after logging in

**Solution 1: Manual Refresh**
1. Go to Dashboard: https://happyresumes.com/dashboard
2. Open Chrome DevTools (F12)
3. Go to Console tab
4. You should see: "🔄 Syncing token to extension"
5. If not, refresh the page
6. Check extension popup again

**Solution 2: Check Extension ID**
1. Go to `chrome://extensions`
2. Find "Quick Resume AI"
3. Copy the Extension ID (looks like: abcdefghijklmnopqrstuvwxyz)
4. Go to Dashboard
5. Open DevTools Console
6. Type: `localStorage.setItem('extensionId', 'YOUR_ID_HERE')`
7. Refresh the page

**Solution 3: Clear and Retry**
1. Click extension icon
2. If signed in, sign out from the website
3. Go to `chrome://extensions`
4. Remove the extension
5. Clear browser data for happyresumes.com
6. Reload the extension
7. Start from Step 2 above

### Problem: Keyboard shortcut doesn't work

**Solution:**
1. Check if another extension uses the same shortcut
2. Go to `chrome://extensions/shortcuts`
3. Look for conflicts (shown in red)
4. Change the shortcut to something unique
5. Try these alternatives:
   - `Ctrl + Shift + Period` (.)
   - `Alt + Shift + 1`
   - `Ctrl + Alt + R`

### Problem: "Extension cannot run on this page"

**Solution:**
- This is normal for chrome:// pages
- Navigate to any regular website
- Try on LinkedIn, Indeed, or any other site
- The shortcut works on all normal web pages

---

## How Authentication Works (Technical Details)

1. **Website Login**: You sign in with Clerk Auth on happyresumes.com
2. **Token Generation**: Clerk creates a session token
3. **Extension Sync**: Dashboard sends token to extension via Chrome messaging API
4. **Storage**: Extension stores token in chrome.storage.local
5. **API Calls**: Extension uses token for all API requests

### Security Notes:
- Token is stored locally on your device only
- Token expires after 24 hours
- Extension only activates when you press the shortcut
- No background tracking or data collection

---

## Quick Test After Setup

1. **Test Authentication**:
   - Click extension icon
   - Should show your usage (not "Sign in")

2. **Test Shortcut**:
   - Go to https://www.linkedin.com/jobs/
   - Press your shortcut key
   - Should see "⚡ Scanning for job..."

3. **Test Generation** (if on paid plan or have free credits):
   - Find any job posting
   - Press shortcut
   - Click "Generate Resume"
   - Should start processing

---

## Need Help?

If authentication still doesn't work after following all steps:

1. **Check Browser**:
   - Chrome version 100+ required
   - Try disabling other extensions temporarily

2. **Check Network**:
   - Ensure happyresumes.com is accessible
   - Check if behind corporate firewall/VPN

3. **Report Issue**:
   - Extension version
   - Chrome version
   - Error messages from Console
   - Steps you've tried

---

## Summary Checklist

- [ ] Extension installed
- [ ] Signed in on happyresumes.com
- [ ] On Dashboard page after sign in
- [ ] Waited 5 seconds for sync
- [ ] Extension popup shows usage (not "Sign in")
- [ ] Keyboard shortcut works
- [ ] Can generate resume on job page

✅ Once all checked, you're ready to use Quick Resume AI!
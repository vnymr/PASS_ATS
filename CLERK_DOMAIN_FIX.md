# 🚨 URGENT: Fix Clerk CORS Error

## Problem Identified

Clerk is trying to load but being blocked by CORS because **happyresumes.com is not added as an allowed domain** in your Clerk instance.

Your Clerk instance: `prepared-sailfish-49.clerk.accounts.dev`

Error in browser:
```
Access to script at 'https://clerk.getunlimitedresume.com/...'
from origin 'https://happyresumes.com' has been blocked by CORS policy
```

## ✅ Solution (5 Minutes)

### Step 1: Go to Clerk Dashboard

Visit: https://dashboard.clerk.com

### Step 2: Select Your Application

Look for the application with key: `pk_test_cHJlcGFyZWQtc2FpbGZpc2gtNDkuY2xlcmsuYWNjb3VudHMuZGV2JA`

Or the one named "prepared-sailfish-49"

### Step 3: Add Domains

1. Click **"Domains"** in the left sidebar (under "Configure")
2. You'll see current domains listed
3. Click **"+ Add domain"** button
4. Add these domains **one by one**:
   ```
   happyresumes.com
   www.happyresumes.com
   localhost:5173
   localhost:3000
   ```

5. Click **Save** after each

### Step 4: Verify

1. Wait 1-2 minutes for changes to propagate
2. Go to https://happyresumes.com
3. Hard refresh: **Cmd+Shift+R** (Mac) or **Ctrl+Shift+R** (Windows)
4. You should now see:
   - ✅ "Sign In" button in top-right nav
   - ✅ "Get Started" button in top-right nav
   - ✅ "Start Building Your Resume" button in hero

### Step 5: Test Authentication

1. Click "Sign In" button
2. Clerk modal should open (not CORS error)
3. Try creating an account
4. Should work!

---

## Why This Happened

Your Clerk publishable key (`pk_test_...`) is configured for the test instance `prepared-sailfish-49.clerk.accounts.dev`.

Clerk restricts which domains can use this key for security. When you deployed to `happyresumes.com`, Clerk blocked it because that domain wasn't on the allowed list.

The error message mentions `clerk.getunlimitedresume.com` because that might have been a custom domain configured in Clerk, but now you're using `happyresumes.com`, which isn't allowed yet.

---

## Alternative: Create New Production Instance (Optional)

If you want to keep test and production separate:

### Create Production Clerk Instance

1. Go to https://dashboard.clerk.com
2. Click **"+ Create application"**
3. Name it: "Happy Resumes - Production"
4. Configure sign-in options (Email, Google, etc.)
5. Click **Create**

### Configure New Instance

1. Go to **Domains** → Add:
   - `happyresumes.com`
   - `www.happyresumes.com`

2. Go to **API Keys** → Copy:
   - **Publishable Key** (pk_live_...)
   - **Secret Key** (sk_live_...)

### Update Railway Environment Variables

**Frontend Service:**
```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_live_YOUR_NEW_KEY
```

**Backend Service:**
```bash
CLERK_SECRET_KEY=sk_live_YOUR_NEW_KEY
```

This creates a clean separation between test and production.

---

## Quick Check: Is Domain Already Added?

To check if domain is already added:

1. Go to Clerk Dashboard
2. Select your app
3. Go to **Domains**
4. Look for `happyresumes.com` in the list

If it's there but still not working:
- Wait 2-3 minutes for DNS/cache
- Hard refresh browser (Cmd+Shift+R)
- Try incognito/private window
- Check if you have ad blocker enabled

---

## After Adding Domain

You should see this on https://happyresumes.com:

**In Nav Bar (top right):**
- "Sign In" button (ghost style)
- "Get Started" button (primary style)

**In Hero Section:**
- "Start Building Your Resume" button (large, primary)
- "Download Extension" button (large, outline)

**When Signed In:**
- User avatar/button in nav
- "Go to Dashboard" button in hero

---

## Troubleshooting

### Issue: Still seeing CORS error after adding domain

**Solutions:**
1. Wait 2-3 minutes for propagation
2. Hard refresh (Cmd+Shift+R or Ctrl+Shift+R)
3. Clear browser cache entirely
4. Try incognito window
5. Verify domain is saved in Clerk Dashboard

### Issue: "Domain not found" in Clerk

**Solutions:**
- Make sure you're in the right Clerk application
- Check if domain has typo (should be `happyresumes.com` not `happyresume.com`)
- Verify you clicked "Save" after adding domain

### Issue: Buttons still not appearing

**Check:**
1. Browser console for other errors
2. Network tab → Filter "clerk" → Check if scripts load
3. Disable ad blocker
4. Try different browser

---

## Expected Timeline

- **Adding domain**: 2 minutes
- **Propagation**: 1-2 minutes
- **Testing**: 2 minutes
- **Total**: ~5 minutes

---

## Verification Commands

After adding domain, test with:

```bash
# Check if Clerk script loads
curl -I https://prepared-sailfish-49.clerk.accounts.dev/npm/@clerk/clerk-js@latest/dist/clerk.browser.js

# Check frontend
open https://happyresumes.com

# Check console
# Should see: "Clerk: Authentication initialized" or similar
```

---

## Need Help?

If you're still stuck after adding the domain:

1. Screenshot the Clerk Dashboard → Domains page
2. Screenshot the browser console errors
3. Check Railway logs for any backend errors

The most common issue is:
- ✅ Domain added but waiting for propagation (wait 2-3 min)
- ✅ Domain has typo
- ✅ Ad blocker still blocking
- ✅ Browser cache not cleared

---

**Status**: Waiting for you to add domain in Clerk Dashboard
**Action**: Add `happyresumes.com` to allowed domains
**Time**: 5 minutes

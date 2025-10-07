# Fix Clerk Authentication on happyresumes.com

## Problem
Sign In/Sign Up buttons are not showing on happyresumes.com because Clerk isn't configured for this domain.

## Current Status
- Using test Clerk key: `pk_test_cHJlcGFyZWQtc2FpbGZpc2gtNDkuY2xlcmsuYWNjb3VudHMuZGV2JA`
- This key is configured for a different domain

## Solution Options

### Option 1: Add happyresumes.com to Test Instance (Quick Fix - 5 minutes)

**Use this for testing before going live.**

1. Go to **Clerk Dashboard**: https://dashboard.clerk.com
2. Select your test instance (the one with the current `pk_test_...` key)
3. Go to **Domains** (in left sidebar)
4. Click **Add domain**
5. Add: `happyresumes.com`
6. Add: `www.happyresumes.com`
7. Click **Save**

**That's it!** Clerk will now work on happyresumes.com with your test keys.

No code changes needed - Railway should already have the env var set.

---

### Option 2: Create Production Instance (Recommended for Launch - 15 minutes)

**Use this when you're ready to go live.**

#### Step 1: Create Production Instance

1. Go to **Clerk Dashboard**: https://dashboard.clerk.com
2. Click **Create Application** (or **+ New Application**)
3. Name it: "Happy Resumes - Production"
4. Select authentication methods (Email, Google, etc.)
5. Click **Create Application**

#### Step 2: Configure Domains

1. In your new production instance, go to **Domains**
2. Add these domains:
   - `happyresumes.com`
   - `www.happyresumes.com`
3. Save

#### Step 3: Get Production Keys

1. Go to **API Keys** in left sidebar
2. Copy these keys:
   - **Publishable key** (starts with `pk_live_...`)
   - **Secret key** (starts with `sk_live_...`)

#### Step 4: Update Railway Environment Variables

Go to **Railway Dashboard** → Your Project → Services:

**Frontend Service:**
```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_live_YOUR_NEW_KEY_HERE
```

**Backend Service (PASS_ATS):**
```bash
CLERK_SECRET_KEY=sk_live_YOUR_NEW_KEY_HERE
```

#### Step 5: Configure URLs in Clerk

In your Clerk production instance:

1. Go to **Settings** → **Paths**
2. Configure:
   - **Sign-in URL**: `https://happyresumes.com/sign-in` (or leave as modal)
   - **Sign-up URL**: `https://happyresumes.com/sign-up` (or leave as modal)
   - **After sign-in**: `https://happyresumes.com/dashboard`
   - **After sign-out**: `https://happyresumes.com/`

3. Go to **Settings** → **Home URL**
   - Set to: `https://happyresumes.com`

#### Step 6: Verify

1. Visit https://happyresumes.com
2. Click "Sign In" or "Get Started"
3. Clerk modal should appear
4. Complete sign-up/sign-in
5. Should redirect to dashboard

---

## Quick Diagnosis

To check if Clerk is working:

### Test 1: Check Browser Console
1. Open https://happyresumes.com
2. Open browser DevTools (F12)
3. Go to Console tab
4. Look for Clerk errors (usually domain-related)

### Test 2: Check Network Tab
1. Open DevTools → Network tab
2. Reload https://happyresumes.com
3. Look for failed requests to `clerk.accounts.dev` or `clerk.com`
4. Check error messages

### Common Error Messages

**Error**: `Clerk: Domain not allowed`
**Fix**: Add domain in Clerk Dashboard → Domains

**Error**: `Clerk: Invalid publishable key`
**Fix**: Check that Railway has correct `VITE_CLERK_PUBLISHABLE_KEY`

**Error**: `Clerk: Network request failed`
**Fix**: Check that domain is verified and DNS is propagated

---

## Verification Checklist

After configuring Clerk:

- [ ] Visit https://happyresumes.com
- [ ] "Sign In" button visible in nav
- [ ] "Get Started" button visible in hero
- [ ] Click "Sign In" → Clerk modal opens
- [ ] Can create account
- [ ] Can sign in
- [ ] Redirects to /dashboard after sign-in
- [ ] Can sign out
- [ ] Redirects to / after sign-out

---

## If Buttons Still Don't Show

### Check 1: Verify Environment Variable in Railway
```bash
railway variables --service your-frontend-service
# Look for VITE_CLERK_PUBLISHABLE_KEY
```

### Check 2: Check Frontend Build
Frontend needs to be rebuilt when env vars change:

1. Go to Railway Dashboard
2. Go to Frontend service
3. Go to Deployments tab
4. Click **Deploy** on latest deployment (to trigger rebuild)

### Check 3: Clear Browser Cache
```bash
# Hard refresh:
# Mac: Cmd + Shift + R
# Windows: Ctrl + Shift + R

# Or clear cache:
# DevTools → Application → Clear Storage → Clear site data
```

### Check 4: Check if Clerk Script Loads
1. Open DevTools → Network tab
2. Filter: "clerk"
3. Look for clerk JavaScript files loading
4. If 404 or errors, there's a configuration issue

---

## Current Configuration

**Frontend (.env):**
```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_cHJlcGFyZWQtc2FpbGZpc2gtNDkuY2xlcmsuYWNjb3VudHMuZGV2JA
```

**Backend (.env):**
```bash
CLERK_SECRET_KEY=sk_test_mlhX3WfaKB9XJQ4yLO93a4nRvicJijhM956nWYt7nf
```

These are **test keys** - they work, but you need to add `happyresumes.com` to the allowed domains OR create a production instance.

---

## Recommended Path

**For now (testing):**
1. ✅ Add `happyresumes.com` to your test Clerk instance domains
2. Hard refresh browser
3. Test sign-in/sign-up

**Before launch:**
1. Create production Clerk instance
2. Get production keys
3. Update Railway environment variables
4. Test thoroughly

---

## Support

- Clerk Docs: https://clerk.com/docs
- Clerk Dashboard: https://dashboard.clerk.com
- Clerk Discord: https://clerk.com/discord

---

**Estimated Time**: 5 minutes (Option 1) or 15 minutes (Option 2)
**Action Required**: Configure Clerk domains for happyresumes.com

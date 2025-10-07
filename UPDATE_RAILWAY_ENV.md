# Update Railway Environment Variables for happyresumes.com

## Issue
The backend URL is still pointing to `passats-production.up.railway.app` instead of `happyresumes.com`.

## Solution
You need to update the environment variables in Railway Dashboard.

## Steps to Update

### 1. Go to Railway Dashboard
Visit: https://railway.app/dashboard

### 2. Select Your Project
Navigate to your PASS_ATS project

### 3. Update API Server (PASS_ATS service)

Click on the **PASS_ATS** service, then go to **Variables** tab.

Update these variables:

```bash
PUBLIC_BASE_URL=https://happyresumes.com
ALLOWED_ORIGINS=https://happyresumes.com,https://www.happyresumes.com,http://localhost:5173,http://localhost:3000
```

### 4. Update Worker Service

Click on the **resume-worker** service (if separate), then go to **Variables** tab.

Use the **same environment variables** as the API server (they share the same config).

### 5. Configure Custom Domain

In the **PASS_ATS** service:

1. Go to **Settings** → **Domains**
2. Click **+ Add Domain**
3. Enter: `happyresumes.com`
4. Railway will provide DNS configuration instructions

### 6. Update DNS Records

In your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.):

**Option A: If Railway provides an IP address:**
```
Type: A
Name: @
Value: <Railway-IP-address>
TTL: Auto or 3600

Type: CNAME
Name: www
Value: happyresumes.com
TTL: Auto or 3600
```

**Option B: If Railway provides a CNAME:**
```
Type: CNAME
Name: @
Value: <your-app>.up.railway.app
TTL: Auto or 3600

Type: CNAME
Name: www
Value: happyresumes.com
TTL: Auto or 3600
```

### 7. Wait for DNS Propagation

DNS changes can take:
- **5-30 minutes** (typical)
- **Up to 24-48 hours** (worst case)

Check propagation: https://dnschecker.org

### 8. Verify Deployment

Once DNS propagates:

```bash
# Test health endpoint
curl https://happyresumes.com/health

# Test frontend
curl -I https://happyresumes.com

# Visit in browser
open https://happyresumes.com
```

### 9. Update External Services

#### Clerk (Authentication)
1. Go to https://dashboard.clerk.com
2. Select your production instance
3. Go to **Domains** → Add:
   - `happyresumes.com`
   - `www.happyresumes.com`
4. Update redirect URLs:
   - Sign-in: `https://happyresumes.com/dashboard`
   - Sign-out: `https://happyresumes.com/`

#### Stripe (Payments)
1. Go to https://dashboard.stripe.com
2. Go to **Developers** → **Webhooks**
3. Update webhook endpoint:
   - Old: `https://passats-production.up.railway.app/api/webhooks/stripe`
   - New: `https://happyresumes.com/api/webhooks/stripe`
4. Or add new endpoint if you want to keep both temporarily

## Quick Commands (After Railway Env Update)

```bash
# View Railway logs
railway logs

# Restart services (if needed)
railway restart

# Check environment variables
railway variables
```

## Troubleshooting

### Services Not Redeploying
If Railway doesn't auto-redeploy after environment variable changes:

1. Go to **Deployments** tab
2. Click **Deploy** on the latest deployment
3. Or make a dummy commit to trigger deployment

### CORS Errors After Update
If you see CORS errors:

1. Verify `ALLOWED_ORIGINS` includes both:
   - `https://happyresumes.com`
   - `https://www.happyresumes.com`
2. Restart the API service
3. Clear browser cache

### SSL Certificate Issues
Railway automatically provisions SSL certificates. If you see SSL errors:

1. Wait 5-10 minutes after adding custom domain
2. Verify DNS is pointing correctly
3. Check Railway **Domains** section for certificate status

### Authentication Not Working
1. Verify Clerk domains are configured
2. Check `CLERK_SECRET_KEY` is set in Railway (production key: `sk_live_*`)
3. Verify callback URLs in Clerk dashboard

### Payments Not Working
1. Verify Stripe webhook URL is updated
2. Check `STRIPE_WEBHOOK_SECRET` matches new webhook
3. Verify you're using production keys (`sk_live_*`, `pk_live_*`)

## Status Check

After updating, verify:

- [ ] Railway environment variables updated
- [ ] Custom domain added in Railway
- [ ] DNS records configured
- [ ] DNS propagated (check https://dnschecker.org)
- [ ] HTTPS works: `https://happyresumes.com`
- [ ] API responds: `https://happyresumes.com/health`
- [ ] Clerk domains configured
- [ ] Stripe webhook updated
- [ ] Can sign up/sign in
- [ ] Can generate resume
- [ ] Can process payment

## Alternative: Use Railway CLI

If you prefer CLI:

```bash
# Link to project (if not already linked)
railway link

# Set environment variables
railway variables set PUBLIC_BASE_URL=https://happyresumes.com
railway variables set ALLOWED_ORIGINS=https://happyresumes.com,https://www.happyresumes.com,http://localhost:5173,http://localhost:3000

# Trigger redeploy
railway up
```

## Need Help?

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Clerk Docs: https://clerk.com/docs
- Stripe Docs: https://stripe.com/docs

---

**Current Status**: Code is deployed to GitHub. Railway will auto-deploy.
**Action Required**: Update Railway environment variables + configure custom domain
**Estimated Time**: 10-15 minutes + DNS propagation time

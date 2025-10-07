# Quick Deploy Guide for happyresumes.com

This is a condensed deployment guide. For detailed instructions, see [PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md).

## Prerequisites ✓

- Railway account
- Domain `happyresumes.com` purchased and accessible
- Clerk account (for authentication)
- Stripe account (for payments)
- Supabase account (for database)

## 1. Set Up External Services (30 minutes)

### Supabase (Database)
```bash
1. Create new project at supabase.com
2. Go to Settings → Database
3. Copy "Session Pooler" connection string
4. Save as DATABASE_URL
```

### Railway (Redis)
```bash
railway add redis
# Railway sets REDIS_URL automatically
```

### Clerk (Authentication)
```
1. Create production instance at dashboard.clerk.com
2. Add domain: happyresumes.com
3. Add domain: www.happyresumes.com
4. Get keys:
   - CLERK_SECRET_KEY (sk_live_...)
   - VITE_CLERK_PUBLISHABLE_KEY (pk_live_...)
5. Set redirects:
   - Sign-in: https://happyresumes.com/dashboard
   - Sign-out: https://happyresumes.com/
```

### Stripe (Payments)
```
1. Switch to Production Mode at dashboard.stripe.com
2. Create products:
   - PRO: $10/month
   - UNLIMITED: $20/month
3. Get keys from API Keys section:
   - STRIPE_SECRET_KEY (sk_live_...)
   - STRIPE_PUBLISHABLE_KEY (pk_live_...)
4. Get Price IDs from Products section:
   - STRIPE_PRICE_ID_PRO (price_...)
   - STRIPE_PRICE_ID_UNLIMITED (price_...)
5. Configure webhook (after deploy):
   - URL: https://happyresumes.com/api/webhooks/stripe
   - Events: checkout.session.completed, customer.subscription.*
   - Get STRIPE_WEBHOOK_SECRET (whsec_...)
```

## 2. Configure Environment Variables

### Server Environment (Railway - Server Service)
```bash
NODE_ENV=production
PORT=3000
PUBLIC_BASE_URL=https://happyresumes.com
ALLOWED_ORIGINS=https://happyresumes.com,https://www.happyresumes.com

# Security
JWT_SECRET=<generate-64-byte-random-hex>

# Database
DATABASE_URL=<supabase-connection-string>
SUPABASE_URL=<supabase-url>
SUPABASE_ANON_KEY=<supabase-anon-key>

# AI
OPENAI_API_KEY=<your-openai-key>
GEMINI_API_KEY=<your-gemini-key>

# Redis (auto-set by Railway addon)
REDIS_URL=<railway-redis-url>

# Clerk
CLERK_SECRET_KEY=<sk_live_...>

# Stripe
STRIPE_SECRET_KEY=<sk_live_...>
STRIPE_PUBLISHABLE_KEY=<pk_live_...>
STRIPE_WEBHOOK_SECRET=<whsec_...>
STRIPE_PRICE_ID_PRO=<price_...>
STRIPE_PRICE_ID_UNLIMITED=<price_...>

# LaTeX
TECTONIC_PATH=tectonic
```

### Frontend Environment (Railway - Frontend Service)
```bash
VITE_CLERK_PUBLISHABLE_KEY=<pk_live_...>
VITE_API_URL=https://happyresumes.com
```

## 3. Deploy to Railway (15 minutes)

### Create Services

```bash
# In Railway Dashboard:

# Service 1: API Server
- Name: resume-api
- Source: Connect GitHub repo
- Root Directory: /server
- Build Command: npm install && npx prisma generate
- Start Command: npm start
- Add all server environment variables

# Service 2: Frontend
- Name: resume-frontend
- Source: Connect GitHub repo
- Root Directory: /frontend
- Build Command: npm run build
- Start Command: npm start
- Add frontend environment variables

# Service 3: Worker
- Name: resume-worker
- Source: Connect GitHub repo
- Root Directory: /server
- Build Command: npm install && npx prisma generate
- Start Command: npm run worker
- Add all server environment variables (same as API)
```

### Configure Custom Domain

```bash
# In Railway Dashboard → resume-api service:
1. Go to Settings → Domains
2. Add custom domain: happyresumes.com
3. Follow DNS configuration instructions
```

## 4. Configure DNS (5 minutes)

In your domain registrar (GoDaddy, Namecheap, etc.):

```
Type: A
Name: @
Value: <Railway-IP-from-dashboard>

Type: CNAME
Name: www
Value: happyresumes.com
```

Wait for DNS propagation (5-30 minutes).

## 5. Run Database Migrations (2 minutes)

```bash
# In Railway → resume-api service → Shell:
npx prisma migrate deploy
npx prisma generate
```

## 6. Complete Stripe Setup

```bash
# After deployment, configure webhook:
1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: https://happyresumes.com/api/webhooks/stripe
3. Select events:
   - checkout.session.completed
   - customer.subscription.created
   - customer.subscription.updated
   - customer.subscription.deleted
4. Copy signing secret (whsec_...)
5. Add to Railway env vars: STRIPE_WEBHOOK_SECRET
6. Restart resume-api service
```

## 7. Verify Deployment (10 minutes)

### Health Checks
```bash
# Check API
curl https://happyresumes.com/health
# Expected: {"status":"ok"}

# Check Frontend
curl -I https://happyresumes.com
# Expected: 200 OK
```

### User Flow Test
1. Visit https://happyresumes.com
2. Sign up with email
3. Upload resume
4. Generate resume
5. Download PDF
6. Test payment flow
7. Test Chrome extension (if applicable)

### Monitor Logs
```bash
# In Railway Dashboard:
- Check resume-api logs for errors
- Check resume-worker logs for job processing
- Check resume-frontend logs
```

## 8. Post-Deployment

### Update Clerk Callback URLs
```bash
# If you see authentication errors:
1. Go to Clerk Dashboard → Production Instance
2. Add callback URLs:
   - https://happyresumes.com/*
   - https://www.happyresumes.com/*
```

### Test Payments
```bash
# Use Stripe test cards:
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002

# Verify in Stripe Dashboard:
- Payment received
- Subscription created
- Webhook events delivered
```

## Troubleshooting

### CORS Errors
```bash
# Verify in Railway environment variables:
ALLOWED_ORIGINS=https://happyresumes.com,https://www.happyresumes.com
PUBLIC_BASE_URL=https://happyresumes.com

# Restart services after changing
```

### Authentication Errors
```bash
# Check Clerk configuration:
- Domain added: happyresumes.com
- Callback URLs configured
- Using production keys (pk_live_, sk_live_)
```

### Payment Errors
```bash
# Check Stripe configuration:
- In production mode
- Webhook endpoint added
- STRIPE_WEBHOOK_SECRET set
- Webhook events include checkout.session.completed
```

### Resume Generation Errors
```bash
# Check worker logs in Railway
# Verify:
- REDIS_URL is set
- OPENAI_API_KEY is valid
- Worker service is running
```

## Quick Commands

```bash
# View logs
railway logs -s resume-api
railway logs -s resume-worker

# Restart service
railway restart -s resume-api

# Check environment variables
railway variables -s resume-api

# Run verification script locally
./verify-production.sh
```

## Success Criteria ✓

- [ ] https://happyresumes.com loads with SSL
- [ ] Sign up flow works
- [ ] Resume generation works
- [ ] PDF download works
- [ ] Payments process successfully
- [ ] No errors in logs

## Estimated Time

- **Setup**: 30 minutes
- **Deployment**: 15 minutes
- **Configuration**: 15 minutes
- **Testing**: 10 minutes
- **Total**: ~70 minutes

## Support Documents

- [PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md) - Detailed setup guide
- [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) - Comprehensive checklist
- [DOMAIN_UPDATE_SUMMARY.md](./DOMAIN_UPDATE_SUMMARY.md) - Changes made for domain update

---

**Ready to deploy?** Start with step 1 and follow in order.
**Need help?** Check the detailed guides linked above.

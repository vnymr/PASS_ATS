# Production Setup Guide for happyresumes.com

## Overview
This guide walks you through deploying the Resume Generator application to production with the domain `happyresumes.com`.

## Prerequisites
- Domain `happyresumes.com` configured and pointing to your hosting provider
- Railway account (or alternative hosting)
- Clerk account for authentication
- Stripe account for payments
- Supabase account for database
- Redis instance (Railway addon or external)

## Configuration Checklist

### 1. Domain Configuration

#### DNS Settings
Point your domain to Railway (or your hosting provider):
- **A Record**: `@` → Railway IP address
- **CNAME Record**: `www` → Your Railway app URL

#### SSL/TLS
- Railway automatically provides SSL certificates
- Ensure HTTPS is enforced

### 2. Clerk Authentication Setup

1. Go to [Clerk Dashboard](https://dashboard.clerk.com/)
2. Create a **Production** instance for `happyresumes.com`
3. Configure domains:
   - Add `happyresumes.com` as authorized domain
   - Add `www.happyresumes.com` as authorized domain
4. Get your production keys:
   - `CLERK_SECRET_KEY` (starts with `sk_live_`)
   - `VITE_CLERK_PUBLISHABLE_KEY` (starts with `pk_live_`)
5. Configure redirect URLs in Clerk:
   - Sign-in redirect: `https://happyresumes.com/dashboard`
   - Sign-out redirect: `https://happyresumes.com/`
   - Callback URLs:
     - `https://happyresumes.com/*`
     - `https://www.happyresumes.com/*`

### 3. Stripe Payment Setup

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Switch to **Production Mode** (toggle in top-left)
3. Get API keys from API Keys section:
   - `STRIPE_SECRET_KEY` (starts with `sk_live_`)
   - `STRIPE_PUBLISHABLE_KEY` (starts with `pk_live_`)
4. Create Products:
   - **PRO**: $10/month - 30 resumes/day
   - **UNLIMITED**: $20/month - Unlimited resumes
5. Get Price IDs for each product:
   - `STRIPE_PRICE_ID_PRO` (starts with `price_`)
   - `STRIPE_PRICE_ID_UNLIMITED` (starts with `price_`)
6. Configure Webhooks:
   - Add endpoint: `https://happyresumes.com/api/webhooks/stripe`
   - Events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
   - Get webhook secret: `STRIPE_WEBHOOK_SECRET` (starts with `whsec_`)

### 4. Environment Variables Setup

#### Server Environment Variables (`server/.env`)

Copy from `.env.production.template` and fill in:

```bash
# Server
NODE_ENV=production
PORT=3000
PUBLIC_BASE_URL=https://happyresumes.com
ALLOWED_ORIGINS=https://happyresumes.com,https://www.happyresumes.com

# Security
JWT_SECRET=<64-byte-hex-string>

# Database (Supabase)
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...supabase.co
SUPABASE_ANON_KEY=...

# AI
OPENAI_API_KEY=sk-proj-...
GEMINI_API_KEY=... (optional)

# Redis
REDIS_URL=redis://...

# Clerk
CLERK_SECRET_KEY=sk_live_...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_PRO=price_...
STRIPE_PRICE_ID_UNLIMITED=price_...
```

#### Frontend Environment Variables (`frontend/.env`)

```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
VITE_API_URL=https://happyresumes.com
VITE_EXTENSION_ID=<your-chrome-extension-id>
```

#### Railway Environment Variables

Set these in Railway Dashboard → Your Project → Variables:

**Server Service:**
- All variables from `server/.env`
- Ensure `PUBLIC_BASE_URL=https://happyresumes.com`
- Ensure `ALLOWED_ORIGINS` includes your domain

**Frontend Service:**
- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_API_URL=https://happyresumes.com`

### 5. Database Setup (Supabase)

1. Create Supabase project at [supabase.com](https://supabase.com)
2. Get connection details:
   - Go to Settings → Database
   - Use **Session Pooler** connection string (IPv4)
   - Copy: `SUPABASE_URL`, `SUPABASE_ANON_KEY`
3. Run migrations:
   ```bash
   cd server
   npx prisma migrate deploy
   npx prisma generate
   ```

### 6. Redis Setup

**Option A: Railway Redis Addon**
```bash
railway add redis
# Railway will automatically set REDIS_URL
```

**Option B: External Redis (Upstash, Redis Cloud)**
1. Create Redis instance
2. Get connection URL
3. Set `REDIS_URL` in environment variables

### 7. Deployment Steps

#### Backend (API Server)

```bash
# In Railway Dashboard:
1. Create new service: "resume-api"
2. Connect GitHub repository
3. Set root directory: /server
4. Set build command: npm install && npx prisma generate
5. Set start command: npm start
6. Add all environment variables
7. Deploy
```

#### Frontend

```bash
# In Railway Dashboard:
1. Create new service: "resume-frontend"
2. Connect GitHub repository
3. Set root directory: /frontend
4. Set build command: npm run build
5. Set start command: npm start
6. Add environment variables
7. Deploy
```

#### Worker (Background Jobs)

```bash
# In Railway Dashboard:
1. Create new service: "resume-worker"
2. Connect GitHub repository
3. Set root directory: /server
4. Set build command: npm install && npx prisma generate
5. Set start command: npm run worker
6. Add all environment variables (same as API server)
7. Deploy
```

### 8. Verification Checklist

- [ ] Domain resolves to production: `https://happyresumes.com`
- [ ] SSL certificate is active (green padlock in browser)
- [ ] CORS working: Frontend can call API
- [ ] Clerk authentication working:
  - [ ] Sign up flow
  - [ ] Sign in flow
  - [ ] Sign out redirects correctly
- [ ] Stripe payments working:
  - [ ] Checkout session creates
  - [ ] Redirects to `happyresumes.com/dashboard?session_id=...`
  - [ ] Webhooks receiving events
- [ ] Resume generation working:
  - [ ] Job creation
  - [ ] Queue processing
  - [ ] PDF download
- [ ] Chrome extension connected (if applicable)
- [ ] Database migrations applied
- [ ] Redis connection active

### 9. Testing Production

```bash
# Test API health
curl https://happyresumes.com/health

# Test authentication
# (Open browser to https://happyresumes.com and sign up)

# Test resume generation
# (Upload resume and generate via UI)

# Check logs in Railway dashboard
railway logs -s resume-api
railway logs -s resume-worker
```

### 10. Monitoring

- **Railway Logs**: Check for errors in deployment logs
- **Stripe Dashboard**: Monitor payment events
- **Clerk Dashboard**: Monitor authentication events
- **Supabase Dashboard**: Monitor database performance

## Troubleshooting

### CORS Errors
- Verify `ALLOWED_ORIGINS` includes your domain
- Check `PUBLIC_BASE_URL` is set correctly
- Clear browser cache

### Authentication Errors
- Verify Clerk domain configuration
- Check `CLERK_SECRET_KEY` is production key
- Ensure frontend has correct `VITE_CLERK_PUBLISHABLE_KEY`

### Payment Errors
- Switch Stripe to production mode
- Verify webhook endpoint is accessible
- Check `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
- Test with Stripe test cards first

### Resume Generation Errors
- Check `OPENAI_API_KEY` is valid and has credits
- Verify `REDIS_URL` is set and accessible
- Check worker service is running
- Review worker logs for LaTeX compilation errors

## Security Best Practices

1. **Never commit `.env` files** - Use `.env.example` templates
2. **Rotate secrets regularly** - JWT secret, API keys
3. **Use environment variables** - Never hardcode secrets
4. **Enable rate limiting** - Already configured in server
5. **Monitor logs** - Watch for suspicious activity
6. **Keep dependencies updated** - Run `npm audit` regularly

## Backup & Recovery

1. **Database backups**: Supabase automatic backups enabled
2. **Environment variables**: Keep secure backup of production `.env`
3. **Code**: Ensure all changes are committed to Git

## Support

- Railway: https://railway.app/help
- Clerk: https://clerk.com/support
- Stripe: https://support.stripe.com
- Supabase: https://supabase.com/support

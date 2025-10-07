# Production Readiness Checklist for happyresumes.com

## Pre-Deployment Checklist

### 1. Environment Variables ✓

#### Server (.env)
- [ ] `NODE_ENV=production`
- [ ] `PUBLIC_BASE_URL=https://happyresumes.com`
- [ ] `ALLOWED_ORIGINS=https://happyresumes.com,https://www.happyresumes.com`
- [ ] `JWT_SECRET` (64-byte secure random string)
- [ ] `DATABASE_URL` (Supabase PostgreSQL)
- [ ] `REDIS_URL` (Railway Redis or external)
- [ ] `OPENAI_API_KEY` (valid and has credits)
- [ ] `GEMINI_API_KEY` (optional, for faster generation)
- [ ] `CLERK_SECRET_KEY` (production key, starts with `sk_live_`)
- [ ] `STRIPE_SECRET_KEY` (production key, starts with `sk_live_`)
- [ ] `STRIPE_PUBLISHABLE_KEY` (production key, starts with `pk_live_`)
- [ ] `STRIPE_WEBHOOK_SECRET` (from Stripe webhook configuration)
- [ ] `STRIPE_PRICE_ID_PRO` (PRO tier price ID)
- [ ] `STRIPE_PRICE_ID_UNLIMITED` (Unlimited tier price ID)

#### Frontend (.env)
- [ ] `VITE_CLERK_PUBLISHABLE_KEY` (production key, starts with `pk_live_`)
- [ ] `VITE_API_URL=https://happyresumes.com` (optional, defaults to localhost)
- [ ] `VITE_EXTENSION_ID` (Chrome extension ID after publishing)

### 2. Domain Configuration ✓

- [ ] DNS A record: `@` → Railway/hosting IP
- [ ] DNS CNAME record: `www` → happyresumes.com
- [ ] SSL certificate provisioned (automatic with Railway)
- [ ] HTTPS enforced
- [ ] Both `happyresumes.com` and `www.happyresumes.com` working

### 3. Authentication (Clerk) ✓

- [ ] Production instance created in Clerk Dashboard
- [ ] Domain `happyresumes.com` added as authorized domain
- [ ] Domain `www.happyresumes.com` added as authorized domain
- [ ] Sign-in redirect URL: `https://happyresumes.com/dashboard`
- [ ] Sign-out redirect URL: `https://happyresumes.com/`
- [ ] Callback URLs configured:
  - `https://happyresumes.com/*`
  - `https://www.happyresumes.com/*`
- [ ] Production API keys obtained and set in environment
- [ ] Test sign-up flow
- [ ] Test sign-in flow
- [ ] Test sign-out flow

### 4. Payment Processing (Stripe) ✓

- [ ] Stripe account in **Production Mode**
- [ ] Products created:
  - PRO: $10/month, 30 resumes/day
  - UNLIMITED: $20/month, unlimited resumes
- [ ] Price IDs obtained and set in environment
- [ ] Production API keys obtained and set
- [ ] Webhook endpoint configured: `https://happyresumes.com/api/webhooks/stripe`
- [ ] Webhook events configured:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- [ ] Webhook secret obtained and set in environment
- [ ] Test checkout flow with test cards
- [ ] Verify subscription creation in database
- [ ] Verify webhook events are received

### 5. Database (Supabase) ✓

- [ ] Supabase project created
- [ ] Connection pooler URL obtained (IPv4)
- [ ] `DATABASE_URL` set in environment
- [ ] Migrations applied: `npx prisma migrate deploy`
- [ ] Prisma client generated: `npx prisma generate`
- [ ] Database accessible from Railway services
- [ ] Connection pooling working (max connections configured)

### 6. Redis Cache ✓

- [ ] Redis instance provisioned (Railway addon or external)
- [ ] `REDIS_URL` set in environment
- [ ] Connection tested from API server
- [ ] Connection tested from worker service
- [ ] Queue system operational

### 7. Code Updates ✓

- [x] All domain references updated to `happyresumes.com`
- [x] CORS origins updated in `server/lib/config.js`
- [x] `ALLOWED_ORIGINS` environment variable updated
- [x] Stripe redirect URLs using `PUBLIC_BASE_URL`
- [x] Chrome extension manifest updated with new domain
- [x] Extension config auto-detects production vs development

### 8. Chrome Extension ✓

- [ ] Manifest version updated
- [ ] Host permissions include `https://happyresumes.com/*`
- [ ] Externally connectable includes `https://happyresumes.com/*`
- [ ] Extension packaged for Chrome Web Store
- [ ] Extension published (or in review)
- [ ] Extension ID obtained and set in `VITE_EXTENSION_ID`

### 9. Railway Services Configuration ✓

#### Service 1: API Server
- [ ] Service name: `resume-api` (or similar)
- [ ] Root directory: `/server`
- [ ] Build command: `npm install && npx prisma generate`
- [ ] Start command: `npm start`
- [ ] All server environment variables set
- [ ] Health check endpoint responding: `/health`
- [ ] Custom domain: `happyresumes.com`

#### Service 2: Frontend
- [ ] Service name: `resume-frontend` (or similar)
- [ ] Root directory: `/frontend`
- [ ] Build command: `npm run build`
- [ ] Start command: `npm start`
- [ ] Frontend environment variables set
- [ ] Static files serving correctly
- [ ] Routing working (SPA fallback configured)

#### Service 3: Background Worker
- [ ] Service name: `resume-worker` (or similar)
- [ ] Root directory: `/server`
- [ ] Build command: `npm install && npx prisma generate`
- [ ] Start command: `npm run worker`
- [ ] All server environment variables set (same as API)
- [ ] Queue processing jobs
- [ ] LaTeX compiler (`tectonic`) installed

### 10. Feature Testing

#### Core Features
- [ ] User registration (email + password or social)
- [ ] User login
- [ ] Password reset (if applicable)
- [ ] Profile creation/editing
- [ ] Resume upload (PDF, DOCX)
- [ ] Resume parsing and analysis
- [ ] Job description input
- [ ] Resume generation (AI-powered)
- [ ] PDF download
- [ ] LaTeX source download
- [ ] Resume history/library

#### Payment Features
- [ ] Stripe checkout flow
- [ ] Subscription activation
- [ ] Subscription cancellation
- [ ] Usage quota tracking
- [ ] Free tier limits enforced
- [ ] PRO tier limits enforced
- [ ] Unlimited tier working
- [ ] Payment webhook processing

#### Extension Features
- [ ] Extension installs successfully
- [ ] Extension connects to production API
- [ ] Job detection on LinkedIn, Indeed, etc.
- [ ] One-click resume generation
- [ ] Download from extension
- [ ] Keyboard shortcuts working
- [ ] Notifications working

### 11. Performance & Monitoring

- [ ] API response times acceptable (<2s for most endpoints)
- [ ] Resume generation completes in <30s
- [ ] Database queries optimized (indexes in place)
- [ ] Redis caching working
- [ ] Queue system processing jobs reliably
- [ ] No memory leaks in services
- [ ] Railway logs accessible and readable
- [ ] Error tracking configured (optional: Sentry, LogRocket)

### 12. Security

- [ ] HTTPS enforced (no HTTP access)
- [ ] JWT secret is strong and unique
- [ ] API keys are production keys (not test keys)
- [ ] Environment variables never committed to Git
- [ ] Rate limiting enabled and working
- [ ] CORS properly configured (no `*` in production)
- [ ] SQL injection protection (Prisma ORM)
- [ ] XSS protection (React, Content Security Policy)
- [ ] File upload validation working
- [ ] Authentication required for protected endpoints

### 13. Legal & Compliance

- [ ] Privacy Policy page exists
- [ ] Terms of Service page exists
- [ ] Cookie consent (if applicable for region)
- [ ] GDPR compliance (if serving EU users)
- [ ] Payment processing compliant (Stripe handles PCI)

### 14. Content & SEO

- [ ] Favicon set
- [ ] Meta tags for SEO (title, description, Open Graph)
- [ ] Sitemap.xml (if applicable)
- [ ] Robots.txt configured
- [ ] Google Analytics (optional)
- [ ] Social media preview images

### 15. Backup & Recovery

- [ ] Database backups enabled (Supabase automatic)
- [ ] Environment variables backed up securely (offline)
- [ ] Code repository up to date (Git)
- [ ] Recovery plan documented
- [ ] Rollback procedure tested

## Post-Deployment Verification

### Smoke Tests
```bash
# 1. Health check
curl https://happyresumes.com/health
# Expected: {"status":"ok"}

# 2. Frontend loads
curl -I https://happyresumes.com
# Expected: 200 OK

# 3. API responds
curl https://happyresumes.com/api/health
# Expected: Success response
```

### User Flow Tests
1. **Sign Up Flow**
   - Visit `https://happyresumes.com`
   - Click "Sign Up"
   - Complete registration
   - Verify email (if required)
   - Redirect to dashboard

2. **Resume Generation Flow**
   - Upload resume
   - Enter job description
   - Click "Generate"
   - Wait for completion
   - Download PDF

3. **Payment Flow**
   - Navigate to pricing
   - Select tier (PRO or Unlimited)
   - Complete Stripe checkout
   - Verify subscription activated
   - Check usage quota updated

4. **Extension Flow**
   - Install extension
   - Visit LinkedIn job posting
   - Click extension button
   - Generate resume
   - Download from extension

### Monitoring Checklist (First 24 Hours)

- [ ] Monitor Railway logs for errors
- [ ] Check Stripe dashboard for payment events
- [ ] Monitor Clerk dashboard for auth events
- [ ] Check database for new users
- [ ] Verify queue processing (check Redis)
- [ ] Monitor API response times
- [ ] Check for 4xx/5xx errors

## Rollback Plan

If critical issues are found:

1. **Immediate**: Switch Railway deployment to previous stable version
2. **Update**: Fix issues in staging/development
3. **Test**: Verify fixes thoroughly
4. **Redeploy**: Deploy to production again

## Support & Maintenance

- **Railway**: Check logs daily, monitor resource usage
- **Database**: Monitor connection pool, query performance
- **Redis**: Check memory usage, eviction policies
- **Stripe**: Monitor failed payments, disputes
- **Clerk**: Monitor authentication failures

## Success Criteria

- [ ] ✅ All services deployed and running
- [ ] ✅ Domain resolving correctly with SSL
- [ ] ✅ Users can sign up and log in
- [ ] ✅ Resume generation working end-to-end
- [ ] ✅ Payments processing successfully
- [ ] ✅ Chrome extension functional
- [ ] ✅ No critical errors in logs
- [ ] ✅ Performance meets expectations

## Notes

- Keep all production credentials in a secure password manager
- Document any deviations from this checklist
- Update this checklist as the application evolves
- Schedule regular security audits
- Keep dependencies updated (run `npm audit` monthly)

---

**Last Updated**: 2025-10-07
**Domain**: happyresumes.com
**Hosting**: Railway
**Status**: Ready for Production ✓

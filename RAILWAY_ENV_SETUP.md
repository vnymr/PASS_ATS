# Railway Environment Variables Setup for Clerk Production

## Issue
The frontend is showing "development keys" warning because Clerk detects `pk_test_` keys instead of `pk_live_` keys.

## Current Status
- Frontend `.env.production`: ✅ Has `pk_live_` key
- Backend `.env`: ❌ Has placeholder for `CLERK_SECRET_KEY`
- Frontend build: ✅ Correctly uses production mode

## Required Environment Variables

### Frontend Deployment (passats-production.up.railway.app)
```
VITE_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsuZ2V0cmVzdW1lLnVzJA
VITE_API_URL=https://passats-production.up.railway.app
```

### Backend Deployment (passats-production.up.railway.app)
```
# All existing variables from server/.env PLUS:
CLERK_SECRET_KEY=[YOUR_PRODUCTION_SECRET_KEY_FROM_CLERK_DASHBOARD]
```

## Steps to Fix

### 1. Get Production Clerk Secret Key
1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your production instance (not development)
3. Go to API Keys section
4. Copy the `Secret Key` (starts with `sk_live_`)

### 2. Update Railway Backend Service
1. Go to Railway dashboard
2. Select your backend service
3. Go to Variables tab
4. Add/Update:
   - `CLERK_SECRET_KEY` = `sk_live_[your_actual_key]`
   - Ensure all other variables from `server/.env` are present

### 3. Update Railway Frontend Service
1. Go to Railway dashboard
2. Select your frontend service
3. Go to Variables tab
4. Ensure these are set:
   - `VITE_CLERK_PUBLISHABLE_KEY` = `pk_live_Y2xlcmsuZ2V0cmVzdW1lLnVzJA`
   - `VITE_API_URL` = `https://passats-production.up.railway.app`

### 4. Redeploy Both Services
1. In Railway, trigger a redeploy for both frontend and backend services
2. Wait for deployments to complete

## Verification
After deployment, check:
1. Browser console should NOT show "development keys" warning
2. Authentication should work properly
3. API calls from frontend to backend should authenticate correctly

## Important Notes
- NEVER commit actual secret keys to git
- The `.env` files in the repo should only have placeholders or development keys
- Production keys should ONLY be in Railway environment variables
- Make sure you're using the production Clerk instance, not development
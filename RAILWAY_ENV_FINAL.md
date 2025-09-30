# Railway Environment Variables - FINAL SETUP

## ✅ Frontend Service Environment Variables
Add these to your FRONTEND Railway service:
```
VITE_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsuZ2V0cmVzdW1lLnVzJA
VITE_API_URL=https://passats-production.up.railway.app
```

## ✅ Backend Service Environment Variables
Add these to your BACKEND Railway service:
```
# Clerk Authentication
CLERK_SECRET_KEY=[YOUR_SK_LIVE_KEY_FROM_CLERK_DASHBOARD]

# Server Configuration (from server/.env)
PORT=3000
NODE_ENV=production
PUBLIC_BASE_URL=https://passats-production.up.railway.app
ALLOWED_ORIGINS=https://getresume.us,https://getunlimitedresume.com,http://localhost:5173,http://localhost:3000

# Security
JWT_SECRET=[YOUR_JWT_SECRET_64_BYTES]

# AI Configuration
OPENAI_API_KEY=[YOUR_OPENAI_API_KEY]

# LaTeX Compilation
TECTONIC_PATH=tectonic

# Database - Supabase PostgreSQL
DATABASE_URL=[YOUR_DATABASE_URL]

# Supabase Configuration
SUPABASE_URL=[YOUR_SUPABASE_URL]
SUPABASE_ANON_KEY=[YOUR_SUPABASE_ANON_KEY]

# Rate Limiting
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
```

## 🚀 Deployment Steps

1. **Go to Railway Dashboard**
   - Log in to your Railway account
   - You should have 2 services: Frontend and Backend

2. **Update Frontend Service**
   - Click on your Frontend service
   - Go to "Variables" tab
   - Add the 2 variables listed above
   - Click "Deploy" to trigger redeployment

3. **Update Backend Service**
   - Click on your Backend service
   - Go to "Variables" tab
   - Add ALL the variables listed above
   - Click "Deploy" to trigger redeployment

4. **Verify Deployment**
   - Wait for both services to finish deploying
   - Visit your frontend URL
   - Open browser console (F12)
   - Check that there's NO "development keys" warning
   - Try logging in to verify authentication works

## ✅ Success Indicators
- No "Clerk has been loaded with development keys" warning
- Authentication works properly
- API calls between frontend and backend succeed
- Users can log in and access protected routes

## ⚠️ Troubleshooting
If you still see the development keys warning:
1. Hard refresh the browser (Ctrl+Shift+R or Cmd+Shift+R)
2. Clear browser cache and cookies
3. Verify the frontend build is using production mode
4. Check Railway logs for any build errors
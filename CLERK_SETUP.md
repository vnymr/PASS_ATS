# Clerk Setup for Local Development

## Problem
Clerk production keys (`pk_live_...`) only work on the production domain (`happyresumes.com`). They don't work on `localhost`.

## Solution
Use Clerk **test keys** (`pk_test_...`) for local development.

## Steps to Get Test Keys

1. **Go to Clerk Dashboard:**
   - Visit https://dashboard.clerk.com
   - Sign in to your account

2. **Select Your Application:**
   - Choose the application that matches your production keys

3. **Navigate to API Keys:**
   - Go to **Developers** → **API Keys**
   - Or go to: https://dashboard.clerk.com/last-active?path=api-keys

4. **Copy Test Publishable Key:**
   - Look for the **Test** section (not Production)
   - Copy the **Publishable key** (starts with `pk_test_...`)

5. **Update Frontend `.env`:**
   ```env
   VITE_CLERK_PUBLISHABLE_KEY="pk_test_YOUR_TEST_KEY_HERE"
   ```

6. **Restart Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

## Alternative: Add localhost to Production Keys

If you want to use production keys on localhost:

1. Go to Clerk Dashboard → Your App → **Domains**
2. Add `localhost` or `localhost:5173` to allowed domains
3. Note: This may not work for all Clerk features

## Environment Files

- **`.env`** - Local development (use test keys)
- **`.env.production`** - Production build (use production keys)

## Current Configuration

- **Local Development**: Uses test keys in `frontend/.env`
- **Production**: Uses production keys (set during build/deploy)

## Troubleshooting

### Error: "Production Keys are only allowed for domain happyresumes.com"
- **Solution**: Use test keys for localhost development

### Error: "Invalid publishable key"
- **Solution**: Make sure you copied the TEST key, not the production key
- Test keys start with `pk_test_`
- Production keys start with `pk_live_`

### Authentication not working
- Check browser console for errors
- Verify the key is correct in `frontend/.env`
- Restart the frontend dev server after changing `.env`



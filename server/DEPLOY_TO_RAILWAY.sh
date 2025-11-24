#!/bin/bash

# Railway Deployment Helper Script
# Run this after creating services in Railway Dashboard

echo "🚀 Railway Deployment Helper"
echo "================================"
echo ""
echo "✅ Step 1: Code pushed to GitHub (DONE)"
echo ""
echo "📋 Step 2: Create Python Service (Manual)"
echo "   1. Go to: https://railway.app/dashboard"
echo "   2. Open project: happy-expression"
echo "   3. Click: '+ New Service'"
echo "   4. Select: 'GitHub Repo'"
echo "   5. Choose: PASS_ATS repository"
echo "   6. Configure:"
echo "      - Service Name: python-browser"
echo "      - Root Directory: server/python-service"
echo "      - Start Command: python server.py"
echo "   7. Click: 'Deploy'"
echo ""
echo "⏳ Wait 5-10 minutes for build..."
echo ""
echo "📋 Step 3: Configure Node.js Service"
echo ""
echo "Getting current Railway project info..."
echo ""

cd /Users/vinaymuthareddy/RESUME_GENERATOR/server

# Check current project
RAILWAY_PROJECT=$(railway status 2>/dev/null | grep "Project:" | cut -d: -f2 | xargs)
RAILWAY_ENV=$(railway status 2>/dev/null | grep "Environment:" | cut -d: -f2 | xargs)

echo "Project: $RAILWAY_PROJECT"
echo "Environment: $RAILWAY_ENV"
echo ""
echo "After Python service is deployed, run these commands:"
echo ""
echo "# Set Camoufox environment variables for Node.js service"
echo "railway variables set USE_CAMOUFOX=true --service <your-nodejs-service-name>"
echo "railway variables set CAMOUFOX_API_ENDPOINT=http://python-browser.railway.internal:3000 --service <your-nodejs-service-name>"
echo ""
echo "================================"
echo "📖 Full guide: server/RAILWAY_DEPLOYMENT.md"
echo "================================"

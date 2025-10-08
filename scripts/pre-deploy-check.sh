#!/bin/bash

# Pre-deployment verification script
# Ensures everything is ready for Railway deployment

echo "🔍 PRE-DEPLOYMENT CHECKLIST FOR RAILWAY"
echo "========================================"

# Track any failures
FAILED=0

# Function to check and report
check() {
    if [ $1 -eq 0 ]; then
        echo "✅ $2"
    else
        echo "❌ $2"
        FAILED=1
    fi
}

# 1. Check if frontend package-lock exists
echo -e "\n📦 Checking Dependencies..."
[ -f "frontend/package-lock.json" ]
check $? "Frontend package-lock.json exists"

[ -f "server/package-lock.json" ]
check $? "Server package-lock.json exists"

# 2. Check Dockerfile
echo -e "\n🐳 Checking Docker Configuration..."
grep -q "frontend/dist" Dockerfile
check $? "Dockerfile builds frontend"

grep -q "prisma migrate deploy" Dockerfile
check $? "Dockerfile runs migrations"

# 3. Check environment variables in code
echo -e "\n🔐 Checking Environment Variable Usage..."
grep -q "trust proxy" server/server.js
check $? "Trust proxy is configured"

# 4. Check for required files
echo -e "\n📁 Checking Required Files..."
[ -f "railway.json" ]
check $? "railway.json exists"

[ -f "server/prisma/schema.prisma" ]
check $? "Prisma schema exists"

# 5. Check for common issues
echo -e "\n⚠️  Checking for Common Issues..."

# Check if .env is in .gitignore
if [ -f ".gitignore" ]; then
    grep -q "^\.env" .gitignore
    check $? ".env is in .gitignore"
else
    echo "⚠️  No .gitignore found"
fi

# Check if node_modules are not committed
if [ -d ".git" ]; then
    git ls-files | grep -q "node_modules"
    if [ $? -eq 0 ]; then
        echo "❌ node_modules should not be committed"
        FAILED=1
    else
        echo "✅ node_modules not in git"
    fi
fi

# 6. Verify server static file serving
echo -e "\n🌐 Checking Static File Serving..."
grep -q "frontend.*dist" server/server.js
check $? "Server serves frontend dist"

# 7. Final Summary
echo -e "\n========================================"
if [ $FAILED -eq 0 ]; then
    echo "✅ ALL CHECKS PASSED - Ready to deploy!"
    echo ""
    echo "📝 Deployment Steps:"
    echo "1. Commit all changes:"
    echo "   git add ."
    echo "   git commit -m 'Ready for production deployment'"
    echo ""
    echo "2. Push to Railway:"
    echo "   git push railway main"
    echo ""
    echo "3. Set environment variables in Railway:"
    echo "   - DATABASE_URL (PostgreSQL)"
    echo "   - REDIS_URL (Redis)"
    echo "   - JWT_SECRET (generate random string)"
    echo "   - GEMINI_API_KEY"
    echo "   - OPENAI_API_KEY (backup)"
    echo "   - STRIPE_SECRET_KEY (if using payments)"
    echo "   - CLERK_SECRET_KEY (if using Clerk auth)"
    echo ""
    echo "4. Monitor deployment:"
    echo "   railway logs"
else
    echo "❌ SOME CHECKS FAILED - Please fix before deploying"
    echo ""
    echo "Common fixes:"
    echo "• Ensure package-lock.json files exist:"
    echo "  cd frontend && npm install"
    echo "  cd ../server && npm install"
    echo ""
    echo "• The updated Dockerfile now builds frontend"
    echo "• Make sure to commit the Dockerfile changes"
    exit 1
fi
#!/bin/bash

# Production Verification Script for happyresumes.com
# This script checks if the production environment is properly configured

set -e

echo "🔍 Production Verification Script"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Helper functions
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

check_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# 1. Check if server/.env exists and has required variables
echo "📋 Checking Server Environment Variables..."
echo "-------------------------------------------"

if [ -f "server/.env" ]; then
    check_pass "server/.env file exists"

    # Required variables
    required_vars=(
        "NODE_ENV"
        "PUBLIC_BASE_URL"
        "ALLOWED_ORIGINS"
        "JWT_SECRET"
        "DATABASE_URL"
        "REDIS_URL"
        "OPENAI_API_KEY"
        "CLERK_SECRET_KEY"
        "STRIPE_SECRET_KEY"
        "STRIPE_PUBLISHABLE_KEY"
        "STRIPE_WEBHOOK_SECRET"
        "STRIPE_PRICE_ID_PRO"
        "STRIPE_PRICE_ID_UNLIMITED"
    )

    for var in "${required_vars[@]}"; do
        if grep -q "^$var=" server/.env && ! grep -q "^$var=$" server/.env && ! grep -q "^$var=YOUR_" server/.env; then
            check_pass "$var is set"
        else
            check_fail "$var is missing or not configured"
        fi
    done

    # Check for production values
    if grep -q "PUBLIC_BASE_URL=https://happyresumes.com" server/.env; then
        check_pass "PUBLIC_BASE_URL points to happyresumes.com"
    else
        check_warn "PUBLIC_BASE_URL is not set to https://happyresumes.com"
    fi

    if grep -q "ALLOWED_ORIGINS=.*happyresumes.com" server/.env; then
        check_pass "ALLOWED_ORIGINS includes happyresumes.com"
    else
        check_fail "ALLOWED_ORIGINS does not include happyresumes.com"
    fi

    if grep -q "NODE_ENV=production" server/.env; then
        check_pass "NODE_ENV is set to production"
    else
        check_warn "NODE_ENV is not set to production"
    fi

else
    check_fail "server/.env file not found"
    check_info "Copy server/.env.example and configure it"
fi

echo ""

# 2. Check frontend environment
echo "🎨 Checking Frontend Environment Variables..."
echo "---------------------------------------------"

if [ -f "frontend/.env" ]; then
    check_pass "frontend/.env file exists"

    if grep -q "^VITE_CLERK_PUBLISHABLE_KEY=" frontend/.env && ! grep -q "^VITE_CLERK_PUBLISHABLE_KEY=$" frontend/.env; then
        check_pass "VITE_CLERK_PUBLISHABLE_KEY is set"

        if grep -q "VITE_CLERK_PUBLISHABLE_KEY=pk_live_" frontend/.env; then
            check_pass "Using production Clerk key (pk_live_)"
        elif grep -q "VITE_CLERK_PUBLISHABLE_KEY=pk_test_" frontend/.env; then
            check_warn "Using test Clerk key (pk_test_) - should be pk_live_ for production"
        fi
    else
        check_fail "VITE_CLERK_PUBLISHABLE_KEY is missing or not configured"
    fi
else
    check_warn "frontend/.env file not found (optional, can use defaults)"
fi

echo ""

# 3. Check code for old domain references
echo "🔎 Checking for Old Domain References..."
echo "----------------------------------------"

OLD_DOMAINS=("getresume.us" "getunlimitedresume.com" "passats-production.up.railway.app")
FOUND_OLD_REFS=false

for domain in "${OLD_DOMAINS[@]}"; do
    # Search in source files (excluding node_modules and .git)
    if grep -r "$domain" --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" --include="*.json" --exclude-dir=node_modules --exclude-dir=.git . 2>/dev/null | grep -v "PRODUCTION_" | grep -v ".md" > /dev/null; then
        check_warn "Found references to old domain: $domain"
        FOUND_OLD_REFS=true
    fi
done

if [ "$FOUND_OLD_REFS" = false ]; then
    check_pass "No old domain references found in source code"
fi

echo ""

# 4. Check Chrome extension manifest
echo "🧩 Checking Chrome Extension Configuration..."
echo "---------------------------------------------"

if [ -f "extension/manifest.json" ]; then
    check_pass "extension/manifest.json exists"

    if grep -q "happyresumes.com" extension/manifest.json; then
        check_pass "Extension manifest includes happyresumes.com"
    else
        check_fail "Extension manifest does not include happyresumes.com"
    fi
else
    check_warn "extension/manifest.json not found"
fi

echo ""

# 5. Check dependencies
echo "📦 Checking Dependencies..."
echo "--------------------------"

if [ -f "server/package.json" ]; then
    check_pass "server/package.json exists"
    cd server
    if [ -d "node_modules" ]; then
        check_pass "Server dependencies installed"
    else
        check_warn "Server dependencies not installed - run 'npm install' in server/"
    fi
    cd ..
else
    check_fail "server/package.json not found"
fi

if [ -f "frontend/package.json" ]; then
    check_pass "frontend/package.json exists"
    cd frontend
    if [ -d "node_modules" ]; then
        check_pass "Frontend dependencies installed"
    else
        check_warn "Frontend dependencies not installed - run 'npm install' in frontend/"
    fi
    cd ..
else
    check_fail "frontend/package.json not found"
fi

echo ""

# 6. Check Prisma setup
echo "🗄️  Checking Database Configuration..."
echo "--------------------------------------"

if [ -f "server/prisma/schema.prisma" ]; then
    check_pass "Prisma schema exists"

    if [ -d "server/node_modules/.prisma" ]; then
        check_pass "Prisma client generated"
    else
        check_warn "Prisma client not generated - run 'npx prisma generate' in server/"
    fi
else
    check_fail "Prisma schema not found"
fi

echo ""

# 7. Security checks
echo "🔒 Security Checks..."
echo "--------------------"

# Check if .env files are in .gitignore
if [ -f ".gitignore" ]; then
    if grep -q ".env" .gitignore; then
        check_pass ".env files are gitignored"
    else
        check_fail ".env files are NOT gitignored - SECURITY RISK!"
    fi
else
    check_warn ".gitignore not found"
fi

# Check for exposed secrets in committed files
if git log --all --full-history --source -- '*.env' 2>/dev/null | grep -q "commit"; then
    check_fail "Found .env files in git history - secrets may be exposed!"
else
    check_pass "No .env files found in git history"
fi

echo ""

# 8. Documentation check
echo "📚 Checking Documentation..."
echo "---------------------------"

if [ -f "PRODUCTION_SETUP.md" ]; then
    check_pass "Production setup guide exists"
else
    check_warn "PRODUCTION_SETUP.md not found"
fi

if [ -f "PRODUCTION_CHECKLIST.md" ]; then
    check_pass "Production checklist exists"
else
    check_warn "PRODUCTION_CHECKLIST.md not found"
fi

if [ -f "README.md" ]; then
    check_pass "README.md exists"
else
    check_warn "README.md not found"
fi

echo ""

# Summary
echo "=========================================="
echo "📊 SUMMARY"
echo "=========================================="
echo ""
echo -e "${GREEN}Passed:${NC}   $PASSED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo -e "${RED}Failed:${NC}   $FAILED"
echo ""

if [ $FAILED -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Ready for production deployment.${NC}"
    exit 0
elif [ $FAILED -eq 0 ]; then
    echo -e "${YELLOW}⚠️  All critical checks passed, but there are warnings to review.${NC}"
    exit 0
else
    echo -e "${RED}❌ Some checks failed. Please fix the issues before deploying to production.${NC}"
    exit 1
fi

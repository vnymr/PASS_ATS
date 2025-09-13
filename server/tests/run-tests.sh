#!/bin/bash

# PASS ATS Test Runner Script
# This script runs all tests for the PASS ATS system

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "======================================"
echo "PASS ATS Test Suite Runner"
echo "======================================"
echo ""

# Check if dependencies are installed
echo -e "${YELLOW}Checking dependencies...${NC}"
if [ ! -d "$PROJECT_DIR/node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    cd "$PROJECT_DIR"
    npm install
fi

# Function to run tests with proper error handling
run_test_suite() {
    local suite_name=$1
    local test_command=$2
    
    echo ""
    echo -e "${YELLOW}Running $suite_name...${NC}"
    echo "--------------------------------------"
    
    if cd "$PROJECT_DIR" && npm run $test_command; then
        echo -e "${GREEN}✓ $suite_name passed${NC}"
        return 0
    else
        echo -e "${RED}✗ $suite_name failed${NC}"
        return 1
    fi
}

# Track failures
FAILED_SUITES=""

# Run different test suites
echo ""
echo "Starting test execution..."
echo ""

# 1. Unit Tests
if ! run_test_suite "Unit Tests" "test:unit"; then
    FAILED_SUITES="$FAILED_SUITES Unit"
fi

# 2. Integration Tests
if ! run_test_suite "Integration Tests" "test:integration"; then
    FAILED_SUITES="$FAILED_SUITES Integration"
fi

# 3. E2E Tests (only if not in CI environment)
if [ -z "$CI" ]; then
    echo ""
    echo -e "${YELLOW}Note: E2E tests require Chrome browser${NC}"
    if ! run_test_suite "E2E Tests" "test:e2e"; then
        FAILED_SUITES="$FAILED_SUITES E2E"
    fi
else
    echo ""
    echo -e "${YELLOW}Skipping E2E tests in CI environment${NC}"
fi

# 4. Coverage Report
echo ""
echo -e "${YELLOW}Generating coverage report...${NC}"
echo "--------------------------------------"
cd "$PROJECT_DIR"
npm run test:coverage

# Summary
echo ""
echo "======================================"
echo "Test Execution Summary"
echo "======================================"

if [ -z "$FAILED_SUITES" ]; then
    echo -e "${GREEN}✓ All tests passed successfully!${NC}"
    exit 0
else
    echo -e "${RED}✗ Failed test suites: $FAILED_SUITES${NC}"
    echo -e "${YELLOW}Please review the test output above for details.${NC}"
    exit 1
fi
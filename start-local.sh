#!/bin/bash

echo "🚀 Starting Resume Generator Local Development Environment"
echo "========================================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if server dependencies are installed
echo -e "${YELLOW}Checking server dependencies...${NC}"
cd server
if [ ! -d "node_modules" ]; then
    echo "Installing server dependencies..."
    npm install
fi

# Start the server with local environment
echo -e "${GREEN}Starting local server on port 3001...${NC}"
echo "Server will be available at: http://localhost:3001"
echo ""

# Use the local env file
export $(cat .env.local | grep -v '^#' | xargs)
npm start
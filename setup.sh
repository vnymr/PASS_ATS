#!/bin/bash
set -e

# Save the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "🚀 Setting up PASS_ATS project..."

# Load nvm if available
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    source "$NVM_DIR/nvm.sh"
    echo "✅ nvm loaded"
    
    # Use Node.js 18 if available, otherwise try to install
    if nvm list 18 &>/dev/null; then
        echo "📦 Using existing Node.js 18..."
        nvm use 18
    elif command -v node &> /dev/null; then
        echo "✅ Node.js already installed: $(node --version)"
    else
        echo "⚠️  Node.js not found. Please install Node.js 18+ first."
        echo "   Run: nvm install 18 && nvm use 18"
        echo "   Or download from https://nodejs.org/"
        exit 1
    fi
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed or not in PATH"
    echo "   Please install Node.js 18+ and try again"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
cd ..

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd server
npm install
cd ..

# Install Python dependencies
echo "📦 Installing Python dependencies..."
cd "$PROJECT_ROOT/server/python-service"
if [ -f "requirements.txt" ]; then
    pip3 install -r requirements.txt
fi

# Generate Prisma client
echo "📦 Generating Prisma client..."
cd "$PROJECT_ROOT/server"
npx prisma generate
cd "$PROJECT_ROOT"

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Copy .env.example to .env and configure your environment variables"
echo "2. Run database migrations: cd server && npx prisma migrate dev"
echo "3. Start the server: npm run dev"
echo "4. Start the frontend: cd frontend && npm run dev"


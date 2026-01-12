# Installation Guide for PASS_ATS

This guide will help you install all dependencies for the PASS_ATS project.

## Prerequisites Check

First, let's verify what's already installed:

```bash
# Check Node.js
node --version || echo "Node.js not installed"

# Check npm
npm --version || echo "npm not installed"

# Check Python
python3 --version

# Check nvm (Node Version Manager)
nvm --version || echo "nvm not installed"
```

## Step 1: Install Node.js (if not already installed)

### Option A: Using nvm (Recommended)

nvm has been installed in your home directory. To use it:

1. **Open a new terminal window** (important - this loads your updated .zshrc)

2. **Load nvm and install Node.js:**
   ```bash
   export NVM_DIR="$HOME/.nvm"
   [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
   nvm install 18
   nvm use 18
   nvm alias default 18
   ```

3. **Verify installation:**
   ```bash
   node --version  # Should show v18.x.x
   npm --version   # Should show version number
   ```

### Option B: Direct Download

If nvm doesn't work, download Node.js 18+ from [nodejs.org](https://nodejs.org/)

## Step 2: Install Project Dependencies

Once Node.js is installed, run the setup script:

```bash
cd /Users/jeevitheshreddynarravulareddy/JOBS/PASS_ATS
bash setup.sh
```

Or install manually:

```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..

# Install backend dependencies
cd server
npm install
cd ..

# Install Python dependencies
cd server/python-service
pip3 install -r requirements.txt
cd ../../..

# Generate Prisma client
cd server
npx prisma generate
cd ..
```

## Step 3: Environment Configuration

1. **Copy environment template:**
   ```bash
   # Check if .env.example exists in server directory
   ls server/.env.example
   ```

2. **Create your .env file:**
   ```bash
   cp server/.env.example server/.env
   # Edit server/.env with your configuration
   ```

## Step 4: Database Setup (if using PostgreSQL)

```bash
cd server
npx prisma migrate dev
# or
npx prisma db push
```

## Troubleshooting

### Node.js installation issues
- Make sure you open a **new terminal window** after nvm installation
- Try: `source ~/.zshrc` to reload your shell configuration
- Verify nvm is loaded: `nvm --version`

### Permission issues
- If you get permission errors, you may need to use `sudo` (not recommended) or fix npm permissions:
  ```bash
  mkdir ~/.npm-global
  npm config set prefix '~/.npm-global'
  export PATH=~/.npm-global/bin:$PATH
  ```

### Network issues
- Ensure you have internet connection
- Some corporate networks may block npm registry - configure proxy if needed

## Next Steps

After installation:
1. Configure your `.env` file with API keys and database URLs
2. Run database migrations
3. Start the development server: `npm run dev` (from root) or `cd server && npm run dev`
4. Start the frontend: `cd frontend && npm run dev`



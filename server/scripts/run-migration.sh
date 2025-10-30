#!/bin/bash
# Run this script on Railway to migrate data from Supabase

echo "🚀 Starting migration from Railway environment..."

# First, run migrations on Railway DB
echo "📦 Setting up schema on Railway..."
DATABASE_URL='postgresql://postgres:WzStSQdrfxlcQBcMoHvEBVjRsXjZGreH@hopper.proxy.rlwy.net:45502/railway' npx prisma migrate deploy

# Run the migration script
echo "📥 Copying data from Supabase to Railway..."
node scripts/migrate-data.js

echo "✅ Migration complete!"

#!/bin/bash
# Migration script: Supabase → Railway PostgreSQL
# Run this script to backup Supabase data and restore to Railway

set -e  # Exit on error

echo "🚀 Starting database migration from Supabase to Railway..."
echo ""

# Step 1: Export from Supabase
echo "📦 Step 1: Exporting data from Supabase..."
SUPABASE_URL="postgresql://postgres:D@dl0ve0@aws-1-us-east-2.pooler.supabase.com:5432/postgres"

pg_dump "$SUPABASE_URL" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  --format=plain \
  --file=supabase-backup.sql

echo "✅ Backup saved to supabase-backup.sql"
echo ""

# Step 2: Get Railway database URL
echo "📝 Step 2: Please provide your Railway DATABASE_URL"
echo "   (Get this from Railway Dashboard → PostgreSQL service → Connect tab)"
echo ""
read -p "Enter Railway DATABASE_URL: " RAILWAY_URL

if [ -z "$RAILWAY_URL" ]; then
  echo "❌ Error: Railway DATABASE_URL is required"
  exit 1
fi

# Step 3: Import to Railway
echo ""
echo "📥 Step 3: Importing data to Railway PostgreSQL..."
psql "$RAILWAY_URL" -f supabase-backup.sql

echo ""
echo "✅ Migration complete!"
echo ""
echo "Next steps:"
echo "1. Verify data in Railway dashboard"
echo "2. Test your application with the new Railway DATABASE_URL"
echo "3. Once confirmed working, you can delete the Supabase project"
echo ""

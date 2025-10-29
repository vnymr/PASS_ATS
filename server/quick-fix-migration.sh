#!/bin/bash

# Quick Migration Fix Script
# Run this to fix the failed Prisma migration

echo "🔧 Fixing failed migration..."
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not set!"
    echo ""
    echo "Please set it first:"
    echo "  export DATABASE_URL='your_database_url_here'"
    echo ""
    echo "Get it from: Railway → PASS_ATS → Variables → DATABASE_URL"
    exit 1
fi

# Run the fix
psql "$DATABASE_URL" << 'EOF'
-- Delete failed migration
DELETE FROM "_prisma_migrations"
WHERE migration_name = '20251104120000_add_auto_apply_tables';

-- Mark it as successful
INSERT INTO "_prisma_migrations" (
    "id",
    "checksum",
    "finished_at",
    "migration_name",
    "logs",
    "rolled_back_at",
    "started_at",
    "applied_steps_count"
) VALUES (
    gen_random_uuid()::text,
    '0',
    NOW(),
    '20251104120000_add_auto_apply_tables',
    NULL,
    NULL,
    NOW(),
    1
);

-- Show result
SELECT 'Migration fixed! ✅' as status;
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration fixed successfully!"
    echo ""
    echo "Now go to Railway and click 'Redeploy' on PASS_ATS service."
else
    echo ""
    echo "❌ Fix failed. Please run manually:"
    echo ""
    echo "psql \"\$DATABASE_URL\" < server/fix-migration.sql"
fi

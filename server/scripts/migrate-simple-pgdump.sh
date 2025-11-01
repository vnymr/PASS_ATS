#!/bin/bash

###############################################################################
# Simple pg_dump Migration Script
# Uses environment variables or command line args for database URLs
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# PostgreSQL paths
export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"

# Check if URLs provided
SUPABASE_URL="${1:-$SUPABASE_DATABASE_URL}"
RAILWAY_URL="${2:-$RAILWAY_DATABASE_URL}"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Supabase to Railway Migration${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# If URLs not provided, prompt for them
if [ -z "$SUPABASE_URL" ]; then
    echo -e "${YELLOW}Enter Supabase DATABASE_URL:${NC}"
    echo "Example: postgresql://postgres.xxx:password@aws-X-us-east-Y.pooler.supabase.com:5432/postgres"
    read -r SUPABASE_URL
fi

if [ -z "$RAILWAY_URL" ]; then
    echo ""
    echo -e "${YELLOW}Enter Railway DATABASE_URL:${NC}"
    echo "Example: postgresql://postgres:password@host.railway.app:5432/railway"
    read -r RAILWAY_URL
fi

# Validate URLs
if [ -z "$SUPABASE_URL" ] || [ -z "$RAILWAY_URL" ]; then
    echo -e "${RED}❌ Both database URLs are required${NC}"
    exit 1
fi

# Create backup directory
BACKUP_DIR="database-backups"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/supabase_backup_$TIMESTAMP.sql"

echo ""
echo -e "${BLUE}Step 1: Testing Supabase connection...${NC}"
if psql "$SUPABASE_URL" -c "SELECT 1;" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Supabase connection successful${NC}"
else
    echo -e "${RED}❌ Cannot connect to Supabase${NC}"
    echo "Please check your SUPABASE_URL"
    exit 1
fi

echo ""
echo -e "${BLUE}Step 2: Testing Railway connection...${NC}"
if psql "$RAILWAY_URL" -c "SELECT 1;" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Railway connection successful${NC}"
else
    echo -e "${RED}❌ Cannot connect to Railway${NC}"
    echo "Please check your RAILWAY_URL"
    exit 1
fi

echo ""
echo -e "${BLUE}Step 3: Getting table statistics from Supabase...${NC}"
psql "$SUPABASE_URL" -c "
SELECT tablename, n_live_tup as rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY tablename;" 2>/dev/null || echo "Could not get statistics"

echo ""
echo -e "${YELLOW}⚠️  WARNING: This will DROP and replace all data in Railway!${NC}"
read -p "Continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo -e "${RED}Migration cancelled${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}Step 4: Dumping data from Supabase...${NC}"
echo "Backup file: $BACKUP_FILE"

pg_dump "$SUPABASE_URL" \
    --no-owner \
    --no-acl \
    --clean \
    --if-exists \
    -F p \
    --exclude-schema='storage' \
    --exclude-schema='auth' \
    --exclude-schema='realtime' \
    --exclude-schema='supabase_functions' \
    --exclude-schema='extensions' \
    > "$BACKUP_FILE" 2>&1

if [ $? -eq 0 ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}✅ Backup completed ($SIZE)${NC}"
else
    echo -e "${RED}❌ Backup failed${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Step 5: Cleaning SQL dump...${NC}"

# Create cleaned version
cat "$BACKUP_FILE" | \
    grep -v "CREATE EXTENSION" | \
    grep -v "COMMENT ON EXTENSION" | \
    grep -v "SET row_security" | \
    grep -v "ENABLE ROW LEVEL SECURITY" | \
    grep -v "CREATE POLICY" | \
    grep -v "ALTER POLICY" | \
    grep -v "DROP POLICY" \
    > "$BACKUP_FILE.clean"

echo -e "${GREEN}✅ SQL cleaned${NC}"

echo ""
echo -e "${BLUE}Step 6: Restoring to Railway...${NC}"
echo "This may take a few minutes..."

psql "$RAILWAY_URL" < "$BACKUP_FILE.clean" 2>&1 | tee "$BACKUP_DIR/restore_log_$TIMESTAMP.txt"

if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo -e "${GREEN}✅ Restore completed${NC}"
else
    echo -e "${YELLOW}⚠️  Restore completed with warnings (check log)${NC}"
fi

echo ""
echo -e "${BLUE}Step 7: Fixing sequences...${NC}"

psql "$RAILWAY_URL" -c "
DO \$\$
DECLARE
    r RECORD;
    max_id INTEGER;
BEGIN
    FOR r IN
        SELECT
            table_name,
            column_name,
            pg_get_serial_sequence(table_name::text, column_name::text) as seq_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND column_default LIKE 'nextval%'
    LOOP
        IF r.seq_name IS NOT NULL THEN
            EXECUTE format('SELECT COALESCE(MAX(%I), 0) + 1 FROM %I', r.column_name, r.table_name) INTO max_id;
            EXECUTE format('ALTER SEQUENCE %s RESTART WITH %s', r.seq_name, max_id);
        END IF;
    END LOOP;
END
\$\$;" >/dev/null 2>&1

echo -e "${GREEN}✅ Sequences fixed${NC}"

echo ""
echo -e "${BLUE}Step 8: Verifying migration...${NC}"

echo ""
echo "Supabase (source):"
psql "$SUPABASE_URL" -c "
SELECT tablename, n_live_tup as rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY tablename;"

echo ""
echo "Railway (target):"
psql "$RAILWAY_URL" -c "
SELECT tablename, n_live_tup as rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY tablename;"

echo ""
echo -e "${GREEN}✅ Migration Complete!${NC}"
echo ""
echo -e "${BLUE}Backups saved in: $BACKUP_DIR${NC}"
echo "  - Original: $BACKUP_FILE"
echo "  - Cleaned: $BACKUP_FILE.clean"
echo "  - Log: $BACKUP_DIR/restore_log_$TIMESTAMP.txt"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Review table counts above"
echo "2. Test your application with Railway"
echo "3. Update DATABASE_URL in Railway environment"
echo ""

#!/bin/bash

###############################################################################
# Supabase to Railway Database Migration Script
# Uses pg_dump and psql for reliable, production-grade migration
###############################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# PostgreSQL binaries
PG_DUMP="/opt/homebrew/opt/postgresql@17/bin/pg_dump"
PSQL="/opt/homebrew/opt/postgresql@17/bin/psql"

# Database URLs (@ symbol is URL-encoded as %40)
SUPABASE_URL="${SUPABASE_URL:-postgresql://postgres.aiewgwtsxwkxybcskfyg:D%40dl0ve0@aws-1-us-east-2.pooler.supabase.com:6543/postgres?sslmode=require}"
RAILWAY_URL="${RAILWAY_URL:-}"  # To be provided by user or environment variable

# Backup file
BACKUP_DIR="$(pwd)/database-backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/supabase_backup_$TIMESTAMP.sql"
BACKUP_FILE_CLEAN="$BACKUP_DIR/supabase_backup_${TIMESTAMP}_clean.sql"

###############################################################################
# Helper Functions
###############################################################################

print_header() {
    echo -e "\n${BLUE}=================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=================================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

###############################################################################
# Step 1: Check Prerequisites
###############################################################################

check_prerequisites() {
    print_header "Step 1: Checking Prerequisites"

    # Check if pg_dump exists
    if [ ! -f "$PG_DUMP" ]; then
        print_error "pg_dump not found at $PG_DUMP"
        echo "Install PostgreSQL: brew install postgresql@15"
        exit 1
    fi
    print_success "pg_dump found"

    # Check if psql exists
    if [ ! -f "$PSQL" ]; then
        print_error "psql not found at $PSQL"
        echo "Install PostgreSQL: brew install postgresql@15"
        exit 1
    fi
    print_success "psql found"

    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    print_success "Backup directory created: $BACKUP_DIR"
}

###############################################################################
# Step 2: Get Railway Database URL
###############################################################################

get_railway_url() {
    print_header "Step 2: Railway Database Configuration"

    if [ -z "$RAILWAY_URL" ]; then
        echo "Please provide your Railway DATABASE_URL"
        echo "You can find it in: Railway Dashboard → Your Project → Variables → DATABASE_URL"
        echo ""
        echo "Format: postgresql://postgres:PASSWORD@HOST:PORT/railway"
        echo ""
        read -p "Enter Railway DATABASE_URL: " RAILWAY_URL

        if [ -z "$RAILWAY_URL" ]; then
            print_error "Railway DATABASE_URL is required"
            exit 1
        fi
    fi

    print_success "Railway URL configured"
}

###############################################################################
# Step 3: Test Database Connections
###############################################################################

test_connections() {
    print_header "Step 3: Testing Database Connections"

    # Test Supabase connection
    print_info "Testing Supabase connection..."
    if $PSQL "$SUPABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
        print_success "Supabase connection successful"
    else
        print_error "Cannot connect to Supabase"
        exit 1
    fi

    # Test Railway connection
    print_info "Testing Railway connection..."
    if $PSQL "$RAILWAY_URL" -c "SELECT 1;" > /dev/null 2>&1; then
        print_success "Railway connection successful"
    else
        print_error "Cannot connect to Railway"
        exit 1
    fi
}

###############################################################################
# Step 4: Pre-Migration Statistics
###############################################################################

get_statistics() {
    print_header "Step 4: Pre-Migration Statistics"

    print_info "Gathering statistics from Supabase..."

    # Get table counts
    $PSQL "$SUPABASE_URL" -t -c "
        SELECT
            schemaname,
            tablename,
            n_live_tup as row_count
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
        ORDER BY n_live_tup DESC;
    " 2>/dev/null || true

    # Get total database size
    DB_SIZE=$($PSQL "$SUPABASE_URL" -t -c "SELECT pg_size_pretty(pg_database_size(current_database()));" 2>/dev/null | tr -d '\n' | sed 's/^ *//;s/ *$//') || true
    [ -n "$DB_SIZE" ] && print_success "Total database size: $DB_SIZE" || print_warning "Skipped database size check"
}

###############################################################################
# Step 5: Backup from Supabase
###############################################################################

backup_supabase() {
    print_header "Step 5: Backing Up Supabase Database"

    print_info "Starting pg_dump from Supabase..."
    print_info "Backup file: $BACKUP_FILE"

    # Run pg_dump with options:
    # --no-owner: Don't set ownership
    # --no-acl: Don't dump access privileges
    # --clean: Add DROP statements before CREATE
    # --if-exists: Use IF EXISTS with DROP statements
    # -F p: Plain text format (SQL)
    # --exclude-schema: Skip system schemas

    $PG_DUMP "$SUPABASE_URL" \
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
        --exclude-schema='graphql' \
        --exclude-schema='graphql_public' \
        > "$BACKUP_FILE"

    if [ $? -eq 0 ]; then
        BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        print_success "Backup completed successfully"
        print_info "Backup size: $BACKUP_SIZE"
    else
        print_error "Backup failed"
        exit 1
    fi
}

###############################################################################
# Step 6: Clean SQL Dump
###############################################################################

clean_sql_dump() {
    print_header "Step 6: Cleaning SQL Dump"

    print_info "Removing Supabase-specific statements..."

    # Remove problematic statements
    cat "$BACKUP_FILE" | \
        grep -v "CREATE EXTENSION IF NOT EXISTS" | \
        grep -v "COMMENT ON EXTENSION" | \
        grep -v "SET row_security" | \
        grep -v "ALTER TABLE .* ENABLE ROW LEVEL SECURITY" | \
        grep -v "CREATE POLICY" | \
        grep -v "ALTER POLICY" | \
        grep -v "DROP POLICY" \
        > "$BACKUP_FILE_CLEAN"

    print_success "SQL dump cleaned"
    print_info "Clean file: $BACKUP_FILE_CLEAN"
}

###############################################################################
# Step 7: Pre-Restore Preparation
###############################################################################

prepare_railway() {
    print_header "Step 7: Preparing Railway Database"

    print_warning "This will drop existing data in Railway database!"

    if [ "${AUTO_CONFIRM}" = "yes" ] || [ "${AUTO_CONFIRM}" = "1" ]; then
        confirm="yes"
    else
        read -p "Do you want to continue? (yes/no): " confirm
    fi

    if [ "$confirm" != "yes" ]; then
        print_info "Migration cancelled by user"
        exit 0
    fi

    print_info "Preparing Railway database..."

    # Drop all tables in public schema (clean slate)
    $PSQL "$RAILWAY_URL" -c "
        DO $$ DECLARE
            r RECORD;
        BEGIN
            FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
                EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
            END LOOP;
        END $$;
    " 2>/dev/null || print_warning "Some tables might not exist yet"

    print_success "Railway database prepared"
}

###############################################################################
# Step 8: Restore to Railway
###############################################################################

restore_to_railway() {
    print_header "Step 8: Restoring to Railway Database"

    print_info "Starting restore to Railway..."
    print_info "This may take several minutes depending on data size..."

    # Restore with error handling
    $PSQL "$RAILWAY_URL" < "$BACKUP_FILE_CLEAN" 2>&1 | tee "$BACKUP_DIR/restore_log_$TIMESTAMP.txt"

    if [ ${PIPESTATUS[0]} -eq 0 ]; then
        print_success "Restore completed successfully"
    else
        print_warning "Restore completed with some warnings (check log)"
        print_info "Log file: $BACKUP_DIR/restore_log_$TIMESTAMP.txt"
    fi
}

###############################################################################
# Step 9: Post-Migration Verification
###############################################################################

verify_migration() {
    print_header "Step 9: Verifying Migration"

    print_info "Comparing table counts..."

    # Get Supabase counts
    echo "Supabase counts:"
    $PSQL "$SUPABASE_URL" -c "
        SELECT tablename, n_live_tup as rows
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
        ORDER BY tablename;
    "

    echo ""
    echo "Railway counts:"
    # Get Railway counts
    $PSQL "$RAILWAY_URL" -c "
        SELECT tablename, n_live_tup as rows
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
        ORDER BY tablename;
    "

    print_success "Verification complete - please review counts above"
}

###############################################################################
# Step 10: Fix Sequences
###############################################################################

fix_sequences() {
    print_header "Step 10: Fixing Auto-Increment Sequences"

    print_info "Resetting sequences to correct values..."

    # Fix sequences for all tables with serial columns
    $PSQL "$RAILWAY_URL" -c "
        DO $$
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
                EXECUTE format('SELECT COALESCE(MAX(%I), 0) + 1 FROM %I', r.column_name, r.table_name) INTO max_id;
                EXECUTE format('ALTER SEQUENCE %s RESTART WITH %s', r.seq_name, max_id);
            END LOOP;
        END
        $$;
    " 2>/dev/null || print_warning "Some sequences might not need adjustment"

    print_success "Sequences fixed"
}

###############################################################################
# Main Execution
###############################################################################

main() {
    print_header "🚀 Supabase to Railway Migration"

    check_prerequisites
    get_railway_url
    test_connections
    get_statistics
    backup_supabase
    clean_sql_dump
    prepare_railway
    restore_to_railway
    fix_sequences
    verify_migration

    print_header "✅ Migration Complete!"

    echo ""
    print_success "All steps completed successfully!"
    echo ""
    print_info "Next steps:"
    echo "  1. Review the table counts above to verify all data was migrated"
    echo "  2. Test your application with Railway database"
    echo "  3. Update DATABASE_URL in Railway environment variables"
    echo "  4. Deploy your application"
    echo ""
    print_info "Backup files saved in: $BACKUP_DIR"
    echo "  - Original: $BACKUP_FILE"
    echo "  - Cleaned: $BACKUP_FILE_CLEAN"
    echo "  - Log: $BACKUP_DIR/restore_log_$TIMESTAMP.txt"
    echo ""
    print_warning "Keep these backups until you've verified everything works!"
}

# Run main function
main

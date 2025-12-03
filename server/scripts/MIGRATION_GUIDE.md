# Supabase to Railway Migration Guide

This guide provides multiple options to migrate your database from Supabase to Railway using the **pg_dump/psql approach** (Option 1).

## Overview

I've created **three migration scripts** for you:

1. **migrate-simple-pgdump.sh** - Simplest, recommended for most users
2. **migrate-supabase-to-railway.sh** - Full-featured with extensive validation
3. **migrate-via-node.js** - Node.js alternative if pg_dump has issues

---

## Prerequisites

- PostgreSQL client tools installed (already done ✅)
- Access to both Supabase and Railway databases
- Railway DATABASE_URL ready

### Get Your Railway DATABASE_URL

```bash
# Option 1: From Railway CLI
railway variables

# Option 2: From Railway Dashboard
# Go to: Railway Dashboard → Your Project → Variables → DATABASE_URL
```

---

## Method 1: Simple pg_dump Migration (Recommended)

This is the **fastest and easiest** method.

### Step 1: Run the migration script

```bash
cd /Users/vinaymuthareddy/RESUME_GENERATOR/server

# Option A: Let the script prompt you for URLs
./scripts/migrate-simple-pgdump.sh

# Option B: Provide URLs as arguments
./scripts/migrate-simple-pgdump.sh \
  "postgresql://postgres.xxx:password@supabase-host:5432/postgres" \
  "postgresql://postgres:password@railway-host:5432/railway"

# Option C: Use environment variables
export SUPABASE_DATABASE_URL="your-supabase-url"
export RAILWAY_DATABASE_URL="your-railway-url"
./scripts/migrate-simple-pgdump.sh
```

### What it does:

1. ✅ Tests both database connections
2. 📊 Shows current table statistics
3. 💾 Creates a backup (saved in `database-backups/`)
4. 🧹 Cleans Supabase-specific SQL
5. 🚀 Restores to Railway
6. 🔧 Fixes auto-increment sequences
7. ✅ Verifies the migration

---

## Method 2: Full-Featured Migration

Uses the comprehensive script with extensive validation.

```bash
cd /Users/vinaymuthareddy/RESUME_GENERATOR/server
./scripts/migrate-supabase-to-railway.sh
```

This script includes:
- Pre-migration validation
- Detailed progress reporting
- Post-migration verification
- Comprehensive error handling

---

## Method 3: Node.js Migration

If you encounter DNS or connectivity issues with psql, use the Node.js approach:

```bash
cd /Users/vinaymuthareddy/RESUME_GENERATOR/server
node scripts/migrate-via-node.js
```

This method:
- Uses Node.js `pg` library (same as your app)
- Works around DNS/SSL issues
- Migrates table by table with progress
- Handles foreign key dependencies automatically

---

## What Gets Migrated

The migration includes all your tables:

- ✅ Users and authentication data
- ✅ Profiles
- ✅ Jobs and artifacts
- ✅ Subscriptions and payments
- ✅ Auto-application data
- ✅ All relationships and foreign keys
- ✅ Indexes and constraints

### What Gets Excluded

These Supabase-specific schemas are automatically excluded:
- ❌ `storage` (Supabase Storage)
- ❌ `auth` (Supabase Auth)
- ❌ `realtime` (Supabase Realtime)
- ❌ `supabase_functions`
- ❌ Row Level Security policies

---

## After Migration

### 1. Verify Data

Compare the table counts shown at the end of migration:

```bash
# Check Railway database
psql "$RAILWAY_DATABASE_URL" -c "
SELECT tablename, n_live_tup as rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY tablename;"
```

### 2. Update Environment Variables

Update your Railway environment:

```bash
# In Railway Dashboard
# Variables → DATABASE_URL → Update to your Railway database URL
```

### 3. Run Prisma Migrations

Ensure schema is up to date:

```bash
DATABASE_URL="your-railway-url" npx prisma migrate deploy
```

### 4. Test Your Application

```bash
# Test locally with Railway database
DATABASE_URL="your-railway-url" npm start

# Then test:
# - User authentication
# - Resume generation
# - Payment processing
# - Auto-apply features
```

### 5. Deploy

Once verified, deploy your application:

```bash
git add .
git commit -m "feat: migrate database from Supabase to Railway"
git push

# Railway will auto-deploy with new DATABASE_URL
```

---

## Backups

All migrations create backups in `database-backups/`:

```
database-backups/
├── supabase_backup_YYYYMMDD_HHMMSS.sql        # Original dump
├── supabase_backup_YYYYMMDD_HHMMSS.sql.clean  # Cleaned version
└── restore_log_YYYYMMDD_HHMMSS.txt            # Restore log
```

**Keep these backups** until you've verified everything works!

### Rollback if Needed

If something goes wrong:

```bash
# Restore from backup to Railway
psql "$RAILWAY_DATABASE_URL" < database-backups/supabase_backup_YYYYMMDD_HHMMSS.sql.clean
```

---

## Troubleshooting

### Connection Issues

If you get connection errors:

1. **Check URL encoding**: Passwords with special characters need encoding
   - `@` becomes `%40`
   - `#` becomes `%23`
   - `$` becomes `%24`

2. **Try the Node.js method**: It's more forgiving with SSL/DNS issues
   ```bash
   node scripts/migrate-via-node.js
   ```

3. **Verify connectivity**:
   ```bash
   psql "$DATABASE_URL" -c "SELECT 1;"
   ```

### Duplicate Key Errors

If you get duplicate key violations:
- The script automatically skips duplicates
- This is normal if you've done a partial migration before
- Check the logs to see what was skipped

### Sequence Issues

If new records start with ID 1 after migration:

```bash
# Run the sequence fix manually
psql "$RAILWAY_DATABASE_URL" -c "
DO \$\$
DECLARE r RECORD; max_id INTEGER;
BEGIN
    FOR r IN
        SELECT table_name, column_name,
               pg_get_serial_sequence(table_name::text, column_name::text) as seq_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND column_default LIKE 'nextval%'
    LOOP
        IF r.seq_name IS NOT NULL THEN
            EXECUTE format('SELECT COALESCE(MAX(%I), 0) + 1 FROM %I', r.column_name, r.table_name) INTO max_id;
            EXECUTE format('ALTER SEQUENCE %s RESTART WITH %s', r.seq_name, max_id);
        END IF;
    END LOOP;
END \$\$;"
```

### Large Database Migration

For databases > 1GB:

1. Use compression:
   ```bash
   pg_dump "$SUPABASE_URL" | gzip > backup.sql.gz
   gunzip -c backup.sql.gz | psql "$RAILWAY_URL"
   ```

2. Or use parallel workers:
   ```bash
   pg_dump "$SUPABASE_URL" -j 4 -F d -f backup_dir/
   pg_restore "$RAILWAY_URL" -j 4 backup_dir/
   ```

---

## Verification Checklist

After migration, verify:

- [ ] All tables migrated with correct row counts
- [ ] User authentication works
- [ ] Existing user data is accessible
- [ ] New records can be created (sequences work)
- [ ] Stripe webhooks/subscriptions still work
- [ ] Auto-apply jobs are accessible
- [ ] No foreign key constraint errors

---

## Getting Help

If you encounter issues:

1. Check the restore log: `database-backups/restore_log_*.txt`
2. Verify both database URLs are correct
3. Try the Node.js migration method
4. Check Railway logs for connection issues

---

## Migration Timeline

Estimated time based on data size:

| Data Size | Estimated Time |
|-----------|----------------|
| < 100 MB  | 2-5 minutes    |
| 100-500 MB| 5-15 minutes   |
| 500 MB-1 GB| 15-30 minutes |
| > 1 GB    | 30+ minutes    |

Your current database appears to be small, so migration should complete in **2-5 minutes**.

---

## Quick Reference

```bash
# Simple migration (recommended)
./scripts/migrate-simple-pgdump.sh

# Node.js method (if pg_dump has issues)
node scripts/migrate-via-node.js

# Verify migration
psql "$RAILWAY_DATABASE_URL" -c "
SELECT tablename, n_live_tup FROM pg_stat_user_tables
WHERE schemaname = 'public';"

# Fix sequences if needed
psql "$RAILWAY_DATABASE_URL" -f scripts/fix-sequences.sql
```

---

## Success!

Once migration is complete:
1. ✅ Your data is in Railway
2. ✅ Backups are saved
3. ✅ Sequences are fixed
4. ✅ Ready to deploy

Update your Railway environment variables and deploy! 🚀

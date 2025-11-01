# pgvector Setup Guide

This guide explains how to enable pgvector for the conversation memory system.

## What is pgvector?

pgvector is a PostgreSQL extension that enables vector similarity search. It's used in this project to store and search conversation summaries using semantic similarity.

## Setup Options

### Option 1: Railway PostgreSQL (Recommended for Production)

Railway PostgreSQL databases support pgvector, but it needs to be enabled:

1. Go to your Railway project dashboard
2. Select your PostgreSQL database service
3. Click on the "Query" tab or connect via `psql`
4. Run the following SQL command:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
5. Verify the extension is enabled:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'vector';
   ```

Then run the initialization script:
```bash
npm run embeddings:init
```

### Option 2: Use Supabase (Built-in pgvector)

Supabase includes pgvector by default. To use Supabase for embeddings:

1. Create a Supabase project at https://supabase.com
2. Get your connection string from Project Settings > Database
3. Set the environment variable:
   ```bash
   EMBEDDINGS_DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres
   ```
4. Run the initialization script:
   ```bash
   npm run embeddings:init
   ```

### Option 3: Local PostgreSQL with pgvector

For local development:

1. Install PostgreSQL
2. Install pgvector:
   ```bash
   # macOS (with Homebrew)
   brew install pgvector

   # Ubuntu/Debian
   sudo apt install postgresql-pgvector

   # Or build from source: https://github.com/pgvector/pgvector
   ```
3. Connect to your database and enable the extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
4. Update your `.env` file:
   ```
   EMBEDDINGS_DATABASE_URL=postgresql://localhost:5432/your_database
   ```
5. Run the initialization script:
   ```bash
   npm run embeddings:init
   ```

## Environment Variables

The embeddings system uses these environment variables (in order of priority):

1. `EMBEDDINGS_DATABASE_URL` - Dedicated database for embeddings (recommended)
2. `DATABASE_URL` - Falls back to main database if embeddings URL not set

Example `.env`:
```bash
# Main database (Railway, Supabase, etc.)
DATABASE_URL=postgresql://...

# Optional: Separate database for embeddings
EMBEDDINGS_DATABASE_URL=postgresql://...
```

## Verification

After setup, verify the integration:

1. Check the database has the extension:
   ```sql
   SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
   ```

2. Check the table exists:
   ```sql
   \d conversation_summaries
   ```

3. Test the connection:
   ```bash
   npm run embeddings:init
   ```

   You should see:
   - "Embeddings DB connection test successful"
   - "Verified pgvector extension"
   - "Verified conversation_summaries table exists"

## Troubleshooting

### "extension 'vector' is not available"

This means pgvector is not installed on your PostgreSQL instance. Follow one of the setup options above.

### Connection errors

- Check that `DATABASE_URL` or `EMBEDDINGS_DATABASE_URL` is set correctly
- Verify SSL is configured (most cloud databases require SSL)
- Test connection with `psql` or a database client

### Memory not loading

If the system works but memories aren't being loaded:

1. Check logs for "Loaded relevant memories" messages
2. Verify summaries are being saved:
   ```sql
   SELECT COUNT(*) FROM conversation_summaries;
   ```
3. Check for errors in conversation flow

## How It Works

1. **After each conversation turn**: A summary is generated and its embedding is stored in `conversation_summaries`
2. **Before planning**: The persona loads top 3 most relevant past conversation summaries
3. **Semantic search**: Uses cosine distance (`<=>` operator) to find similar conversations

## Schema

The `conversation_summaries` table:
- `id` - Unique summary identifier
- `conversation_id` - Links to conversation
- `user_id` - User who owns the conversation
- `summary` - Text summary of conversation
- `embedding` - Vector(1536) - OpenAI embedding
- `importance` - Score 1-10 for weighting
- `created_at` / `updated_at` - Timestamps

## Performance Notes

- For <1000 rows: Sequential scan is fast enough
- For >1000 rows: Add IVFFlat index:
  ```sql
  CREATE INDEX idx_conv_sum_embedding ON conversation_summaries
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
  ```

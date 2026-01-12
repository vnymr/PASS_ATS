# Database Setup Guide

The application requires a PostgreSQL database. You have several options:

## Option 1: Docker (Recommended for Local Development)

If you have Docker installed:

```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Wait for services to be ready (about 10-15 seconds)
docker-compose ps

# Run database migrations
cd server
npx prisma migrate dev
```

The database will be available at:
- **Host:** localhost
- **Port:** 5432
- **Database:** resume_generator
- **User:** resume_user
- **Password:** resume_pass

## Option 2: Install PostgreSQL Locally

### macOS (using Homebrew):
```bash
brew install postgresql@15
brew services start postgresql@15

# Create database and user
createdb resume_generator
psql resume_generator -c "CREATE USER resume_user WITH PASSWORD 'resume_pass';"
psql resume_generator -c "GRANT ALL PRIVILEGES ON DATABASE resume_generator TO resume_user;"
```

### Update .env:
```env
DATABASE_URL=postgresql://resume_user:resume_pass@localhost:5432/resume_generator
```

## Option 3: Cloud Database (Recommended for Production)

### Railway
1. Go to [railway.app](https://railway.app)
2. Create a new PostgreSQL database
3. Copy the connection string
4. Update `DATABASE_URL` in `.env`

### Supabase
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Settings > Database
4. Copy the connection string
5. Update `DATABASE_URL` in `.env`

### Neon
1. Go to [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string
4. Update `DATABASE_URL` in `.env`

## After Database Setup

1. **Run migrations:**
   ```bash
   cd server
   npx prisma migrate dev
   ```

2. **Verify connection:**
   ```bash
   npx prisma db pull  # This will fail if connection is wrong
   ```

3. **Start the server:**
   ```bash
   npm run dev
   ```

## Troubleshooting

### Connection Refused
- Make sure PostgreSQL is running
- Check if port 5432 is available
- Verify DATABASE_URL format: `postgresql://user:password@host:port/database`

### Authentication Failed
- Verify username and password in DATABASE_URL
- Check PostgreSQL user permissions

### Database Does Not Exist
- Create the database first: `createdb resume_generator`
- Or let Prisma create it during migration



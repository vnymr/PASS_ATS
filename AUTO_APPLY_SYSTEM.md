# Auto-Apply System Documentation

## Overview
The Auto-Apply system allows users to automatically apply to jobs using AI-powered form filling. The system uses a queue-based architecture with a separate worker process.

## Architecture

### Components

1. **Frontend (React + TypeScript)**
   - `AgentDashboard.tsx` - Monitor auto-apply applications
   - `FindJob.tsx` - Browse and auto-apply to jobs
   - `JobDetailPanel.tsx` - View job details and trigger auto-apply
   - `api.ts` - API client with auto-apply methods

2. **Backend (Node.js + Express)**
   - `routes/auto-apply.js` - Auto-apply API endpoints
   - `lib/auto-apply-queue.js` - Bull queue processor
   - `lib/ai-form-filler.js` - AI-powered form filling
   - `lib/recipe-engine.js` - Recipe-based application (fallback)
   - `auto-apply-worker.js` - Background worker process

3. **Database (PostgreSQL + Prisma)**
   - `AutoApplication` - Application records
   - `AggregatedJob` - Job listings with ATS metadata
   - `ApplicationRecipe` - Recorded application flows
   - `RecipeExecution` - Recipe usage tracking

## How It Works

### User Flow

1. **User browses jobs** on `/find-job` page
2. **Jobs marked as "AI Applyable"** show auto-apply button
3. **Click "Auto-Apply"** → Creates `AutoApplication` record with status `QUEUED`
4. **Queue job** → Added to Bull queue for processing
5. **Worker processes** → AI fills out application form
6. **Status updates** → `APPLYING` → `SUBMITTED` or `FAILED`
7. **User monitors** → Real-time tracking on `/dashboard`

### Technical Flow

```
User Click → POST /api/auto-apply → Create AutoApplication
                                  ↓
                          Queue Job (Bull/Redis)
                                  ↓
                    Worker picks up job (auto-apply-worker.js)
                                  ↓
                    AI Form Filler analyzes page
                                  ↓
                    Fills form fields with user data
                                  ↓
                    Takes screenshot + submits
                                  ↓
                    Update status to SUBMITTED
```

## Running the System

### Prerequisites

```bash
# Required environment variables
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=sk-...
BROWSERUSE_API_KEY=... (optional, for AI form filling)
JWT_SECRET=...
```

### Start the API Server

```bash
cd server
npm install
npm start
```

The API server runs on port 3000 and handles:
- Job browsing
- Auto-apply requests
- Application status tracking

### Start the Worker

**Option 1: Direct Node**
```bash
cd server
node auto-apply-worker.js
```

**Option 2: PM2 (Recommended for Production)**
```bash
pm2 start server/auto-apply-worker.js --name auto-apply-worker
pm2 logs auto-apply-worker
```

**Option 3: Railway (Production)**
- Add a new service for the worker
- Point to `server/auto-apply-worker.js`
- Use the same environment variables as the API server

### Worker Configuration

The worker uses these settings:

- **Concurrency**: 2 (processes 2 jobs simultaneously)
- **Max Attempts**: 3 (retries failed jobs up to 3 times)
- **Backoff**: Exponential (2s, 4s, 8s between retries)
- **Memory**: ~600MB per worker (2 browsers × 300MB)

## API Endpoints

### POST /api/auto-apply
Queue an auto-apply job.

**Request:**
```json
{
  "jobId": "cmgh123..."
}
```

**Response:**
```json
{
  "success": true,
  "applicationId": "cmgh456...",
  "status": "QUEUED",
  "message": "Application queued - will be submitted automatically",
  "estimatedTime": "2-5 minutes",
  "estimatedCost": 0.05
}
```

**Error Cases:**
- 404: Job not found
- 400: Job not AI-applyable
- 400: Profile not configured
- 400: Already applied

### GET /api/my-applications
Get user's applications.

**Query Params:**
- `status` (optional): Filter by status (QUEUED, APPLYING, SUBMITTED, FAILED)
- `limit` (optional): Limit results (default: 50)
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "applications": [...],
  "total": 127,
  "statusCounts": {
    "QUEUED": 5,
    "APPLYING": 2,
    "SUBMITTED": 115,
    "FAILED": 5
  },
  "limit": 50,
  "offset": 0
}
```

### GET /api/applications/:id
Get specific application details.

### DELETE /api/applications/:id
Cancel a queued application (only works for QUEUED status).

### GET /api/auto-apply/stats
Get user's auto-apply statistics.

**Response:**
```json
{
  "total": 127,
  "submitted": 115,
  "failed": 5,
  "pending": 7,
  "thisWeek": 12,
  "totalCost": 6.35,
  "averageCost": 0.050
}
```

## Application Strategies

### AI-First (Default)
```javascript
APPLY_STRATEGY=AI_FIRST
```
1. Try AI form filler first (intelligent, adapts to any form)
2. Fall back to recipe engine if AI fails
3. Most flexible, best for new/unknown ATS platforms

### Recipe Only
```javascript
APPLY_STRATEGY=RECIPE_ONLY
```
1. Only use recorded recipes
2. Faster and cheaper ($0.05 vs $0.80)
3. Requires recipes to be recorded first

### AI Only
```javascript
APPLY_STRATEGY=AI_ONLY
```
1. Always use AI form filler
2. Most expensive but most reliable
3. No recipe fallback

## Monitoring

### Queue Stats
The worker logs queue stats every 5 minutes:
```
Queue status: { waiting: 5, active: 2, completed: 115, failed: 5 }
```

### Worker Health Check
```bash
# Check if worker is running
pm2 status auto-apply-worker

# View worker logs
pm2 logs auto-apply-worker --lines 100

# Restart worker
pm2 restart auto-apply-worker
```

### Database Monitoring
```sql
-- Check application status distribution
SELECT status, COUNT(*)
FROM "AutoApplication"
GROUP BY status;

-- Check recent failures
SELECT id, error, "errorType", "createdAt"
FROM "AutoApplication"
WHERE status = 'FAILED'
ORDER BY "createdAt" DESC
LIMIT 10;

-- Check cost stats
SELECT
  COUNT(*) as total,
  SUM(cost) as total_cost,
  AVG(cost) as avg_cost,
  MAX(cost) as max_cost
FROM "AutoApplication";
```

## Cost Analysis

### AI Form Filler
- **Initial Cost**: $0.80 per application (vision + function calling)
- **Speed**: 30-60 seconds per application
- **Success Rate**: ~95%
- **Advantage**: Works on any ATS platform

### Recipe Engine
- **Recording Cost**: $0.80 (one-time, using BrowserUse)
- **Replay Cost**: $0.05 (Puppeteer only)
- **Speed**: 10-20 seconds per application
- **Success Rate**: ~99% (for recorded platforms)
- **Advantage**: Much cheaper for repeat applications

### Example Savings
If you apply to 100 Greenhouse jobs:
- **AI Only**: 100 × $0.80 = $80.00
- **Recipe**: $0.80 (record) + 99 × $0.05 = $5.75
- **Savings**: $74.25 (93% cost reduction)

## Troubleshooting

### Applications stuck in QUEUED
**Cause**: Worker not running or Redis connection issue

**Fix**:
```bash
# Check worker status
pm2 status auto-apply-worker

# Restart worker
pm2 restart auto-apply-worker

# Check Redis
redis-cli ping
```

### Applications failing with "Profile not found"
**Cause**: User hasn't set up application data in profile

**Fix**: Direct user to complete profile setup:
1. Go to `/profile`
2. Add "Application Data" section
3. Fill in personal info, experience, education

### High failure rate
**Cause**: ATS platform changed, captcha, timeout

**Fix**:
1. Check error logs: `pm2 logs auto-apply-worker`
2. Update recipes if needed
3. Increase timeout in worker config
4. Mark problematic ATS as non-applyable

### Worker consuming too much memory
**Cause**: Too many concurrent browsers

**Fix**: Reduce concurrency in `auto-apply-queue.js`:
```javascript
autoApplyQueue.process(1, async (job) => {  // Changed from 2 to 1
  // ...
});
```

## Future Improvements

1. **Real-time updates** - WebSocket for live status updates
2. **Batch apply** - Apply to multiple jobs at once
3. **Smart scheduling** - Apply during business hours only
4. **Application tracking** - Track responses from companies
5. **Interview scheduling** - Auto-schedule interviews
6. **Follow-up automation** - Auto-send follow-up emails

## Security Considerations

1. **Profile Data**: User profile data contains sensitive info (phone, email, etc.)
   - Encrypted at rest in database
   - Never logged in plain text
   - Only accessible by authenticated user

2. **Credentials**: No user passwords or API keys stored for external sites
   - Applications filled using public forms only
   - No authentication bypass

3. **Rate Limiting**: Prevent abuse
   - Max 50 applications per day (configurable)
   - Queue throttling to prevent spam

4. **Screenshot Privacy**: Confirmation screenshots stored securely
   - Base64 encoded in database
   - Only accessible by application owner
   - Auto-deleted after 30 days

## Production Deployment Checklist

- [ ] Environment variables configured (DATABASE_URL, REDIS_URL, etc.)
- [ ] Worker process running (PM2 or Railway service)
- [ ] Redis accessible from both API and worker
- [ ] Database migrations applied
- [ ] Health check endpoint monitored
- [ ] Error alerting configured (Sentry, etc.)
- [ ] Queue monitoring dashboard set up
- [ ] Cost tracking enabled
- [ ] Rate limiting configured
- [ ] Backup strategy for failed jobs

## Support

For issues or questions:
1. Check logs: `pm2 logs auto-apply-worker`
2. Check database for error details
3. Review this documentation
4. Contact support with application ID

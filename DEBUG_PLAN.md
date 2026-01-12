# Resume Generation Data Flow Debug Plan

## Current Issue
Jobs are added to queue but worker doesn't process them. The data flow between frontend → server → Redis queue → worker is broken.

---

## Data Flow Architecture

```
Frontend (React)
    ↓ POST /api/generate-resume
Server (Express)
    ↓ Adds job to BullMQ queue
Redis (BullMQ)
    ↓ Worker polls queue
Worker (node worker.js)
    ↓ Processes job, generates PDF
Database (Prisma/PostgreSQL)
    ↓ Updates job status
Frontend (polls /api/jobs/:id)
```

---

## Step 1: Check Frontend Request

**File:** `frontend/src/pages/GenerateResume.tsx`

**Verify:**
1. What endpoint is called when user clicks "Generate"?
2. What data is sent in the request body?
3. Is the response being handled correctly?

**Test:**
```javascript
// Open browser DevTools → Network tab
// Click "Generate Resume"
// Check the request:
// - URL: should be POST /api/generate-resume
// - Payload: should have { jobDescription, profileData }
// - Response: should return { jobId: "..." }
```

---

## Step 2: Check Server API Endpoint

**File:** `server/server.js` or `server/routes/*.js`

**Find the endpoint:**
```bash
grep -r "generate-resume" server/
```

**Verify:**
1. Is the endpoint receiving the request?
2. Is it adding the job to the queue correctly?
3. What queue name is being used?

**Add debug log:**
```javascript
// In the generate-resume endpoint
console.log('=== GENERATE RESUME REQUEST ===');
console.log('Body:', JSON.stringify(req.body, null, 2));
console.log('User ID:', req.user?.id);
```

---

## Step 3: Check Queue Configuration

**File:** `server/lib/resume-queue.js` (or similar)

**Verify:**
1. Queue name matches between server and worker
2. Redis connection is the same
3. Job is being added with correct data

**Check queue name:**
```bash
grep -r "resume-generation" server/
grep -r "Queue" server/
```

**Server should add job like:**
```javascript
await queue.add('resume-generation', {
  jobId: dbJob.id,
  userId: user.id,
  profileData: profileData,
  jobDescription: jobDescription
});
```

---

## Step 4: Check Worker Configuration

**File:** `server/worker.js`

**Verify:**
1. Worker connects to same Redis URL
2. Worker listens to same queue name
3. Worker is actually running and connected

**Current worker setup:**
```javascript
const worker = new Worker('resume-generation', async (job) => {
  // This function should be called when job arrives
  console.log('Processing job:', job.id, job.data);
});
```

**Test worker is receiving jobs:**
```javascript
// Add at top of worker callback
console.log('=== WORKER RECEIVED JOB ===');
console.log('Job ID:', job.id);
console.log('Job Data:', JSON.stringify(job.data, null, 2));
```

---

## Step 5: Check Redis Connection

**Both server AND worker must use same Redis:**

**Server Redis (check server.js or queue file):**
```bash
grep -r "REDIS_URL" server/
grep -r "redis://" server/
```

**Worker Redis (check worker.js):**
```bash
grep -r "createRedisConnection" server/worker.js
```

**Test Redis directly:**
```bash
# In server directory
node -e "
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);
redis.on('connect', () => console.log('Connected'));
redis.on('error', (e) => console.log('Error:', e.message));
"
```

---

## Step 6: Verify Job Processor

**File:** `server/lib/job-processor.js`

**Current code should call:**
```javascript
const { latex, pdf, metadata } = await generator.generateAndCompile(
  profileData,
  jobDescription,
  { enableSearch: true }
);
```

**NOT:**
```javascript
// OLD - uses templates (broken)
await generator.generateWithTemplate(templateLatex, ...)
```

---

## Step 7: Manual Queue Test

**Create test file:** `server/test-queue.js`

```javascript
import { Queue } from 'bullmq';
import { createRedisConnection } from './lib/redis-connection.js';
import dotenv from 'dotenv';
dotenv.config();

const connection = createRedisConnection();
const queue = new Queue('resume-generation', { connection });

async function test() {
  console.log('Adding test job...');

  const job = await queue.add('test', {
    jobId: 'test-123',
    userId: 1,
    profileData: { name: 'Test User' },
    jobDescription: 'Test job description'
  });

  console.log('Job added:', job.id);
  console.log('Waiting for worker to pick it up...');
}

test();
```

**Run:**
```bash
node test-queue.js
```

**Check worker terminal - should show "Worker processing job"**

---

## Step 8: Check for Multiple Queue Instances

**Problem:** Server might create a NEW queue on each request instead of reusing.

**Search for queue creation:**
```bash
grep -rn "new Queue" server/
```

**Should be singleton pattern:**
```javascript
// GOOD - singleton
let queue = null;
function getQueue() {
  if (!queue) {
    queue = new Queue('resume-generation', { connection });
  }
  return queue;
}

// BAD - creates new queue each time
app.post('/api/generate-resume', async (req, res) => {
  const queue = new Queue('resume-generation', { connection }); // WRONG!
});
```

---

## Step 9: Check BullMQ Job Events

**Add to worker.js:**
```javascript
worker.on('active', (job) => {
  console.log(`Job ${job.id} is now active`);
});

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.log(`Job ${job.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.log('Worker error:', err.message);
});
```

---

## Quick Checklist

- [ ] Frontend sends POST to correct endpoint
- [ ] Server receives request and logs it
- [ ] Server adds job to queue with correct data
- [ ] Queue name is "resume-generation" everywhere
- [ ] Redis URL is same for server and worker
- [ ] Worker is running and connected to Redis
- [ ] Worker callback is being triggered
- [ ] job-processor.js uses `generateAndCompile` (not `generateWithTemplate`)

---

## Key Files to Review

1. `frontend/src/pages/GenerateResume.tsx` - Frontend trigger
2. `frontend/src/services/api.ts` - API calls
3. `server/server.js` - API endpoints
4. `server/lib/resume-queue.js` - Queue setup (if exists)
5. `server/worker.js` - Worker setup
6. `server/lib/redis-connection.js` - Redis connection
7. `server/lib/job-processor.js` - Job processing logic
8. `server/lib/ai-resume-generator.js` - Resume generation

---

## Recent Changes Made

1. **job-processor.js**: Changed from `generateWithTemplate` to `generateAndCompile`
2. **resume-prompts.js**: Simplified to use basic LaTeX only
3. **ai-resume-generator.js**: Simplified prompts, removed template dependencies

---

## Commands to Run

```bash
# Terminal 1: Server
cd server && npm run dev

# Terminal 2: Worker
cd server && npm run worker

# Terminal 3: Frontend
cd frontend && npm run dev

# Check Redis queue status
redis-cli -u $REDIS_URL
> KEYS *
> LLEN bull:resume-generation:wait
> LRANGE bull:resume-generation:wait 0 -1
```

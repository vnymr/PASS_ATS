### Services and endpoints

- App: Express server with CORS, rate limiting, health, auth, profile, job processing, history listing, artifact downloads, Stripe.

Key endpoints (selected):

```241:273:/Users/vinaymuthareddy/RESUME_GENERATOR/server/server.js
app.get('/health', async (req, res) => { ... })
```

```382:436:/Users/vinaymuthareddy/RESUME_GENERATOR/server/server.js
app.post('/api/register', authLimiter, async (req, res) => { ... })
```

```534:579:/Users/vinaymuthareddy/RESUME_GENERATOR/server/server.js
app.post('/api/login', authLimiter, async (req, res) => { ... })
```

```581:611:/Users/vinaymuthareddy/RESUME_GENERATOR/server/server.js
app.get('/api/profile', authenticateToken, async (req, res) => { ... })
```

```821:843:/Users/vinaymuthareddy/RESUME_GENERATOR/server/server.js
app.get('/api/profile/resume-download', authenticateToken, async (req, res) => { ... })
```

```1182:1245:/Users/vinaymuthareddy/RESUME_GENERATOR/server/server.js
app.post('/api/generate', authenticateToken, async (req, res) => { ... })
```

```1406:1449:/Users/vinaymuthareddy/RESUME_GENERATOR/server/server.js
app.get('/api/jobs', authenticateToken, async (req, res) => { ... })
```

```1656:1695:/Users/vinaymuthareddy/RESUME_GENERATOR/server/server.js
app.get('/api/quota', authenticateToken, async (req, res) => { ... })
```

```1605:1654:/Users/vinaymuthareddy/RESUME_GENERATOR/server/server.js
app.get('/api/resumes', authenticateToken, async (req, res) => { ... })
```

```2537:2613:/Users/vinaymuthareddy/RESUME_GENERATOR/server/server.js
app.get('/api/resumes/:identifier', authenticateToken, async (req, res) => { ... })
```

```2615:2660:/Users/vinaymuthareddy/RESUME_GENERATOR/server/server.js
app.get('/api/job/:jobId/download/pdf', authenticateToken, async (req, res) => { ... })
```

Routers mounted:

```2684:2701:/Users/vinaymuthareddy/RESUME_GENERATOR/server/server.js
import jobsRouter from './routes/jobs.js';
app.use('/api', authenticateToken, jobsRouter);
```

### Auth

- Clerk-first auth with legacy JWT fallback.

```295:379:/Users/vinaymuthareddy/RESUME_GENERATOR/server/server.js
const authenticateToken = async (req, res, next) => { ... }
```

Roles: single user role path (no role table); authorization enforced by checking `job.userId === req.userId` on artifact/job fetches.

### Queue/cron/worker jobs

- Async processing helpers in `server/lib/queue.js` and `server/lib/job-processor.js`. Primary path uses `/api/process-job` to enqueue and update job status.

```1699:1817:/Users/vinaymuthareddy/RESUME_GENERATOR/server/server.js
app.post('/api/process-job', authenticateToken, jobProcessingLimiter, async (req, res) => { ... })
```

### File storage and PDFs

- Artifacts stored as bytes in Postgres `Artifact.content` with metadata JSON. PDF downloads read from DB and stream to client.

```1274:1335:/Users/vinaymuthareddy/RESUME_GENERATOR/server/server.js
app.get('/api/job/:jobId/download/:type', ...)
```

PDF generation pipeline

- Two flows:
  - Simplified synchronous: `/api/generate` uses `AIResumeGenerator.generateAndCompile` to produce LaTeX and PDF, then persists artifacts.
  - Production async: `/api/process-job` → queue → LLM generate LaTeX → compile via `compileLatex` → store artifacts.

References:

```1182:1242:/Users/vinaymuthareddy/RESUME_GENERATOR/server/server.js
app.post('/api/generate', authenticateToken, async (req, res) => {
  const generator = new AIResumeGenerator(process.env.OPENAI_API_KEY);
  const { latex, pdf } = await generator.generateAndCompile(...)
})
```

```1957:2016:/Users/vinaymuthareddy/RESUME_GENERATOR/server/server.js
// Save artifacts & mark job completed
```

### External services

- AI: Gemini 2.5 Flash preferred with OpenAI `gpt-5-mini` fallback.

```2049:2158:/Users/vinaymuthareddy/RESUME_GENERATOR/server/server.js
async function generateLatexWithLLM(openai, userDataJSON, jobDescription, onProgress = null) { ... }
```

- Stripe: Checkout session, subscription read, webhook.

```1512:1539:/Users/vinaymuthareddy/RESUME_GENERATOR/server/server.js
app.post('/api/create-checkout-session', ...)
```

- Clerk: token verification with fallback to JWT.

```79:85:/Users/vinaymuthareddy/RESUME_GENERATOR/server/server.js
clerkClient = createClerkClient(...)
```

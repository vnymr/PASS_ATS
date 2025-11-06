# 🏗️ Auto-Apply System Architecture

> **Note:** Recipe Replay System has been temporarily disabled (archived to `lib/archived/`) to focus on stable AI-powered direct application. The system currently uses Playwright + AI for all job applications. Recipe system may be re-enabled per-job in the future.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AUTO-APPLY SYSTEM                                 │
│                     "Record Once, Replay Forever"                        │
└─────────────────────────────────────────────────────────────────────────┘

                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼

    ┌──────────────────────┐           ┌──────────────────────┐
    │   JOB AGGREGATION    │           │   AUTO-APPLY ENGINE  │
    │                      │           │                      │
    │  • Greenhouse API    │           │  • AI Form Filler    │
    │  • Lever API         │           │  • Playwright        │
    │  • Adzuna API        │────data───▶  • CAPTCHA Solver    │
    │  • Remotive API      │           │  • Queue System      │
    │                      │           │                      │
    │  Every 6 hours       │           │  Direct AI Apply     │
    └──────────────────────┘           └──────────────────────┘
                │                                   │
                │                                   │
                ▼                                   ▼

    ┌──────────────────────┐           ┌──────────────────────┐
    │   ATS DETECTION      │           │   FORM ANALYSIS      │
    │                      │           │                      │
    │  • 25+ Platforms     │           │  • Field Detection   │
    │  • URL Patterns      │           │  • Smart Mapping     │
    │  • 99% Accuracy      │           │  • Auto-fill         │
    │  • AI-Applyable Flag │           │  • AI Intelligence   │
    │                      │           │                      │
    └──────────────────────┘           └──────────────────────┘
                │                                   │
                │                                   │
                └───────────────┬───────────────────┘
                                │
                                ▼

                    ┌───────────────────────┐
                    │   POSTGRESQL DATABASE │
                    │                       │
                    │  • AggregatedJob      │
                    │  • AutoApplication    │
                    │  • ApplicationRecipe  │
                    │  • RecipeExecution    │
                    └───────────────────────┘
```

---

## Data Flow

### 1. Job Aggregation Flow

```
API Sources                 ATS Detection              Database Storage
───────────                 ─────────────              ────────────────

Greenhouse API    ──┐
                    │
Lever API         ──┤──▶  URL Pattern      ──▶  AggregatedJob
                    │      Matching                 {
Adzuna API        ──┤      (99% accuracy)           atsType: "GREENHOUSE"
                    │                                aiApplyable: true
Remotive API      ──┘                                complexity: "SIMPLE"
                                                   }

Runs: Every 6 hours (cron)
Result: 150+ jobs per sync
Cost: Free (API calls only)
```

### 2. Auto-Apply Flow

```
User Request          Recipe Loading          Form Filling           Submission
────────────          ──────────────          ────────────           ──────────

Apply to Job    ──▶  Load Recipe       ──▶  Execute Steps   ──▶  Submit Form
                     from Database          (Playwright)
                                           • Type fields          • Screenshot
Check Recipe    ──▶  Found? ✅             • Upload resume        • Confirmation
Exists?              Use Playwright         • Select options       • Track stats
                     ($0.05)                • Click submit
                                                                   Cost: $0.05 ✅
                     Not Found? ❌    ──▶  Use BrowserUse    ──▶  Submit + Record
                     Fall back to          (AI automation)
                     BrowserUse                                    • Save recipe
                     ($0.80)                                       • Next time: $0.05

                                                                   Cost: $0.80 (one-time)
```

### 3. Recipe System Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         RECIPE ENGINE LOGIC                              │
└─────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────┐
                    │   Apply to Job       │
                    │   (jobUrl, atsType)  │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  Load Recipe from DB │
                    │  WHERE platform = ?  │
                    └──────────┬───────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
                ▼                             ▼
    ┌───────────────────┐         ┌───────────────────┐
    │  Recipe Found ✅  │         │  No Recipe ❌     │
    └───────┬───────────┘         └───────┬───────────┘
            │                             │
            ▼                             ▼
    ┌───────────────────┐         ┌───────────────────┐
    │  PLAYWRIGHT REPLAY│         │  BROWSERUSE       │
    │                   │         │  RECORDING        │
    │  1. Launch browser│         │                   │
    │  2. Navigate URL  │         │  1. AI navigates  │
    │  3. Execute steps:│         │  2. Captures steps│
    │     • Type        │         │  3. Saves recipe  │
    │     • Upload      │         │  4. Submits form  │
    │     • Select      │         │                   │
    │     • Click       │         │  Cost: $0.80      │
    │  4. Submit        │         └───────┬───────────┘
    │  5. Screenshot    │                 │
    │                   │                 ▼
    │  Cost: $0.05 ✅   │         ┌───────────────────┐
    └───────┬───────────┘         │  Save New Recipe  │
            │                     │  to Database      │
            │                     └───────┬───────────┘
            │                             │
            └──────────────┬──────────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │  Update Statistics   │
                │                      │
                │  • Success rate      │
                │  • Times used        │
                │  • Cost savings      │
                │  • Execution time    │
                └──────────────────────┘
```

---

## Database Schema

```sql
┌──────────────────────────────────────────────────────────────────┐
│                      DATABASE MODELS                             │
└──────────────────────────────────────────────────────────────────┘

╔══════════════════════════════════════════════════════════════════╗
║  AggregatedJob (Jobs from APIs)                                  ║
╠══════════════════════════════════════════════════════════════════╣
║  id              String (cuid)      PRIMARY KEY                  ║
║  externalId      String             UNIQUE                       ║
║  source          String             "greenhouse", "lever"        ║
║  title           String                                          ║
║  company         String                                          ║
║  description     Text                                            ║
║  applyUrl        String                                          ║
║  atsType         String             "GREENHOUSE", "LEVER"        ║
║  atsComplexity   String             "SIMPLE", "COMPLEX"          ║
║  aiApplyable     Boolean            true/false                   ║
║  postedDate      DateTime                                        ║
║  isActive        Boolean            default: true                ║
║                                                                   ║
║  Indexes:                                                         ║
║    • (aiApplyable, postedDate)                                   ║
║    • (atsType)                                                   ║
║    • (isActive, postedDate)                                      ║
╚══════════════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════════╗
║  AutoApplication (Application Tracking)                          ║
╠══════════════════════════════════════════════════════════════════╣
║  id              String (cuid)      PRIMARY KEY                  ║
║  userId          Int                FOREIGN KEY → User.id        ║
║  jobId           String             FOREIGN KEY → AggregatedJob  ║
║  status          Enum               QUEUED/APPLYING/SUBMITTED    ║
║  submittedAt     DateTime?                                       ║
║  confirmationId  String?                                         ║
║  cost            Float              default: 0.0                 ║
║  error           String?                                         ║
║  retryCount      Int                default: 0                   ║
║                                                                   ║
║  Unique: (userId, jobId)                                         ║
║  Indexes:                                                         ║
║    • (userId, status)                                            ║
║    • (status)                                                    ║
╚══════════════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════════╗
║  ApplicationRecipe (Recorded Automation Steps)                   ║
╠══════════════════════════════════════════════════════════════════╣
║  id              String (cuid)      PRIMARY KEY                  ║
║  platform        String             UNIQUE ("greenhouse")        ║
║  atsType         String             "GREENHOUSE"                 ║
║  steps           JSON               [{ action, selector, value }]║
║  successRate     Float              0.0 to 1.0                   ║
║  timesUsed       Int                default: 0                   ║
║  recordingCost   Float              default: 0.80                ║
║  replayCost      Float              default: 0.05                ║
║  totalSaved      Float              calculated                   ║
║  lastUsed        DateTime?                                       ║
║                                                                   ║
║  Indexes:                                                         ║
║    • (platform)                                                  ║
║    • (atsType)                                                   ║
║    • (successRate)                                               ║
╚══════════════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════════╗
║  RecipeExecution (Performance Tracking)                          ║
╠══════════════════════════════════════════════════════════════════╣
║  id              String (cuid)      PRIMARY KEY                  ║
║  recipeId        String             FOREIGN KEY → Recipe.id      ║
║  success         Boolean                                         ║
║  method          String             "REPLAY" or "BROWSERUSE"     ║
║  cost            Float                                           ║
║  duration        Int?               milliseconds                 ║
║  error           String?                                         ║
║  executedAt      DateTime           default: now()               ║
║                                                                   ║
║  Indexes:                                                         ║
║    • (recipeId, executedAt)                                      ║
║    • (success)                                                   ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## Recipe Structure

```json
{
  "platform": "greenhouse",
  "atsType": "GREENHOUSE",
  "version": 1,
  "steps": [
    {
      "action": "type",
      "selector": "input[name='job_application[first_name]']",
      "value": "{{personalInfo.firstName}}",
      "fieldName": "First Name",
      "required": true
    },
    {
      "action": "type",
      "selector": "input[name='job_application[email]']",
      "value": "{{personalInfo.email}}",
      "fieldName": "Email",
      "required": true
    },
    {
      "action": "upload",
      "selector": "input[type='file'][name='job_application[resume]']",
      "value": "{{resumeUrl}}",
      "fieldName": "Resume",
      "required": true
    },
    {
      "action": "select",
      "selector": "select[name*='authorization']",
      "value": "{{commonAnswers.workAuthorization}}",
      "fieldName": "Work Authorization"
    },
    {
      "action": "wait",
      "duration": 1000
    },
    {
      "action": "click",
      "selector": "button[type='submit']",
      "fieldName": "Submit Application",
      "required": true
    }
  ],
  "successRate": 0.95,
  "timesUsed": 150,
  "totalSaved": 112.50
}
```

### Supported Actions

| Action | Description | Example |
|--------|-------------|---------|
| `type` | Type text into input field | First name, email, phone |
| `select` | Select dropdown option | Work authorization |
| `click` | Click button or link | Submit button |
| `upload` | Upload file | Resume PDF |
| `radio` | Select radio button | Yes/No questions |
| `checkbox` | Toggle checkbox | Accept terms |
| `wait` | Delay execution | Wait for page load |

---

## API Endpoints Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        REST API LAYER                           │
└─────────────────────────────────────────────────────────────────┘

╔═══════════════════════════════════════════════════════════════════╗
║  JOBS API (/api/jobs)                                             ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  GET /api/jobs                                                    ║
║    Query: ?filter=ai_applyable|manual|all                        ║
║    Returns: List of jobs with ATS info                           ║
║    Use Case: Browse available jobs                               ║
║                                                                   ║
║  GET /api/jobs/stats                                              ║
║    Returns: Job count by platform, AI-applyable percentage       ║
║    Use Case: Dashboard statistics                                ║
║                                                                   ║
║  POST /api/jobs/sync                                              ║
║    Body: { sources: ["greenhouse", "lever"] }                    ║
║    Returns: Sync status and job count                            ║
║    Use Case: Manual job refresh                                  ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝

╔═══════════════════════════════════════════════════════════════════╗
║  AUTO-APPLY API (/api/auto-apply)                                 ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  POST /api/auto-apply                                             ║
║    Body: { jobId: "xyz123" }                                      ║
║    Returns: { applicationId, status: "QUEUED" }                  ║
║    Use Case: Submit auto-apply request                           ║
║                                                                   ║
║  GET /api/auto-apply/:id/status                                   ║
║    Returns: { status, confirmationId, cost, error }              ║
║    Use Case: Check application progress                          ║
║                                                                   ║
║  GET /api/auto-apply/user/stats                                   ║
║    Returns: { total, submitted, failed, totalCost, saved }       ║
║    Use Case: User dashboard                                      ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

---

## Cost Calculation Model

```
┌─────────────────────────────────────────────────────────────────┐
│                      COST CALCULATION                           │
└─────────────────────────────────────────────────────────────────┘

Traditional Approach (BrowserUse only):
───────────────────────────────────────
  Cost per application: $0.80
  Total for N applications: N × $0.80

  Example (100 applications):
    Cost = 100 × $0.80 = $80.00


Recipe System Approach:
───────────────────────
  Recording cost: $0.80 (one-time, or $0.00 if pre-made)
  Replay cost: $0.05 per application
  Total for N applications: $0.80 + (N × $0.05)

  Example (100 applications):
    Cost = $0.80 + (100 × $0.05) = $5.80
    Savings = $80.00 - $5.80 = $74.20 (93%)


Break-Even Analysis:
────────────────────
  Let N = number of applications

  BrowserUse cost: 0.80N
  Recipe cost: 0.80 + 0.05N

  Break-even when: 0.80N = 0.80 + 0.05N
                   0.75N = 0.80
                   N = 1.07

  ✅ Break-even after just 2 applications!


Savings Formula:
────────────────
  Saved = (0.80N) - (0.80 + 0.05N)
        = 0.75N - 0.80
        = 0.75(N - 1.07)

  Savings Rate = (0.75N - 0.80) / (0.80N)
               ≈ 93.75% (for large N)
```

---

## Performance Metrics

```
┌─────────────────────────────────────────────────────────────────┐
│                    PERFORMANCE TRACKING                         │
└─────────────────────────────────────────────────────────────────┘

Recipe-Level Metrics:
─────────────────────
  • Success Rate: (successful_executions / total_executions)
  • Times Used: Total number of applications
  • Total Saved: (recording_cost - replay_cost) × (times_used - 1)
  • Average Duration: Mean execution time in milliseconds
  • Last Used: Most recent execution timestamp
  • Failure Count: Consecutive failures (triggers re-recording at 3)

Application-Level Metrics:
──────────────────────────
  • Status: QUEUED → APPLYING → SUBMITTED/FAILED
  • Cost: Actual cost ($0.05 or $0.80)
  • Duration: Time from start to completion
  • Confirmation ID: ATS-provided confirmation number
  • Error Type: CAPTCHA, TIMEOUT, FIELD_ERROR, etc.
  • Retry Count: Number of retry attempts

User-Level Metrics:
───────────────────
  • Total Applications: Sum of all applications
  • Success Rate: Percentage of submitted applications
  • Total Cost: Sum of all application costs
  • Total Saved: Cost if using BrowserUse minus actual cost
  • Average Cost: Total cost / total applications
  • Platform Breakdown: Applications by ATS type
```

---

## Error Handling Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                       ERROR HANDLING                            │
└─────────────────────────────────────────────────────────────────┘

Scenario 1: Selector Not Found
───────────────────────────────
  Playwright: "Cannot find input[name='first_name']"

  Action:
    1. Log error with recipe ID
    2. Mark execution as failed
    3. Fall back to BrowserUse
    4. BrowserUse finds correct selector
    5. Update recipe with new selector
    6. Mark recipe version +1
    7. Next application uses updated recipe

  Cost: $0.80 (one-time), then $0.05 forever


Scenario 2: New Required Field
───────────────────────────────
  Playwright: Submits form but server rejects
  Error: "GitHub URL is required"

  Action:
    1. Detect missing required field
    2. Fall back to BrowserUse
    3. BrowserUse fills GitHub URL
    4. Add new step to recipe
    5. Update recipe in database
    6. Next application includes GitHub URL

  Cost: $0.80 (one-time), then $0.05 forever


Scenario 3: Success Rate Drops
───────────────────────────────
  Recipe: 50 applications
  Recent success rate: 60% (below 80% threshold)

  Action:
    1. Mark recipe as "needs_update"
    2. Use BrowserUse for next 3 applications
    3. Record new steps each time
    4. Compare new recipes for consistency
    5. Update recipe with most reliable version
    6. Reset success rate counter
    7. Monitor next 10 applications

  Cost: 3 × $0.80 = $2.40 (investment in reliability)


Scenario 4: CAPTCHA Detected
─────────────────────────────
  Playwright: Blocked by reCAPTCHA

  Action:
    1. Mark job as "requires_manual_apply"
    2. Notify user via email/dashboard
    3. Don't retry automatically
    4. Keep recipe but add warning flag
    5. User can manually solve CAPTCHA

  Cost: $0.00 (no application cost)
```

---

## Scalability & Performance

```
┌─────────────────────────────────────────────────────────────────┐
│                    SCALABILITY DESIGN                           │
└─────────────────────────────────────────────────────────────────┘

Job Aggregation:
────────────────
  Current: 150 jobs every 6 hours
  Scaling: Can handle 10,000+ jobs/day
  Bottleneck: API rate limits
  Solution: Distribute across time, use multiple API keys

Recipe Execution:
─────────────────
  Current: Sequential (one at a time)
  Scaling: Bull queue with 10 concurrent workers
  Throughput: ~600 applications/hour (10 workers × 6 apps/min)
  Bottleneck: Playwright memory (browser instances)
  Solution: Browser pooling, docker containers

Database:
─────────
  Current: PostgreSQL (Supabase)
  Scaling: Handles 1M+ jobs, 100K+ applications
  Bottleneck: Complex queries on large datasets
  Solution: Indexed queries, materialized views

Cost at Scale:
──────────────
  1,000 applications/day:
    • Recipe system: $50/day
    • BrowserUse only: $800/day
    • Savings: $750/day = $22,500/month

  10,000 applications/day:
    • Recipe system: $500/day
    • BrowserUse only: $8,000/day
    • Savings: $7,500/day = $225,000/month
```

---

## Security Considerations

```
┌─────────────────────────────────────────────────────────────────┐
│                        SECURITY                                 │
└─────────────────────────────────────────────────────────────────┘

Data Protection:
────────────────
  • User data encrypted at rest (database)
  • TLS encryption in transit
  • Resume files stored in secure S3 bucket
  • API keys stored in environment variables

Authentication:
───────────────
  • JWT tokens for API authentication
  • Rate limiting per user (100 req/min)
  • CORS protection with allowed origins
  • Input validation on all endpoints

Automation Safety:
──────────────────
  • Headless browser in sandboxed environment
  • No direct access to user's machine
  • Screenshot evidence of all submissions
  • Confirmation ID tracking
  • Rollback capability for failed applications

Privacy:
────────
  • No storage of sensitive data in recipes
  • Variable interpolation at runtime only
  • User data not logged
  • GDPR-compliant data deletion
```

---

Built with ❤️ using Claude Code

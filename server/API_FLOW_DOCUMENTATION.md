# API Flow Documentation

Complete documentation of the resume generation data flow from extension → API → database → download.

## Overview

```
Extension/Client
    ↓
POST /api/process-job (creates job in queue)
    ↓
BullMQ Worker (processes job asynchronously)
    ↓
Database (stores resume record)
    ↓
GET /api/job/:id/status (polls for completion)
    ↓
GET /api/job/:id/download/pdf (downloads PDF)
```

---

## 1. Job Creation

### `POST /api/process-job`

Creates a new resume generation job and adds it to the BullMQ queue.

**Request Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Request Body:**
```json
{
  "jobDescription": "string (required, min 10 chars)",
  "profileId": "number (optional, defaults to 1)"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "jobId": "job_1728234567890_abc123",
  "status": "PENDING",
  "message": "Job queued for processing",
  "estimatedTime": "30-60 seconds"
}
```

**Error Response (400):**
```json
{
  "error": "Job description is required and must be at least 10 characters"
}
```

**Error Response (403):**
```json
{
  "error": "Daily limit reached for your subscription tier"
}
```

**Error Response (500):**
```json
{
  "error": "Failed to queue job: <error message>"
}
```

**What Gets Stored at This Stage:**
- Job added to BullMQ queue with status `PENDING`
- Job data: `{ jobDescription, profileId, userId }`
- No database record created yet

---

## 2. Job Status Polling

### `GET /api/job/:id/status`

Returns the current status of a job. Should be polled every 2-3 seconds.

**Request Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**URL Parameters:**
```
:id - The jobId returned from POST /api/process-job
```

**Success Response - PENDING (200):**
```json
{
  "jobId": "job_1728234567890_abc123",
  "status": "PENDING",
  "progress": 0,
  "message": "Job is waiting in queue"
}
```

**Success Response - PROCESSING (200):**
```json
{
  "jobId": "job_1728234567890_abc123",
  "status": "PROCESSING",
  "progress": 45,
  "message": "Generating resume..."
}
```

**Success Response - COMPLETED (200):**
```json
{
  "jobId": "job_1728234567890_abc123",
  "status": "COMPLETED",
  "progress": 100,
  "company": "Google",
  "role": "Software Engineer",
  "artifacts": [
    {
      "type": "pdf",
      "url": "/api/job/job_1728234567890_abc123/download/pdf",
      "size": 45678
    },
    {
      "type": "tex",
      "url": "/api/job/job_1728234567890_abc123/download/tex"
    }
  ],
  "resumeId": 42,
  "createdAt": "2024-10-06T12:34:56.789Z"
}
```

**Success Response - FAILED (200):**
```json
{
  "jobId": "job_1728234567890_abc123",
  "status": "FAILED",
  "progress": 0,
  "error": "AI extraction failed: Rate limit exceeded"
}
```

**Error Response (404):**
```json
{
  "error": "Job not found"
}
```

**What Gets Stored at This Stage:**

**During PROCESSING:**
- Job status updated in BullMQ
- Progress percentage tracked
- Temporary files created in `output/` directory

**When COMPLETED:**
- Database record created in `resumes` table:
  ```sql
  {
    id: SERIAL PRIMARY KEY,
    userId: INTEGER,
    company: TEXT,          -- Extracted from job description
    role: TEXT,             -- Extracted from job description
    fileName: TEXT,         -- "resume_job_abc123_google_swe.pdf"
    pdfUrl: TEXT,          -- "/api/job/job_abc123/download/pdf"
    texContent: TEXT,      -- Full LaTeX source
    createdAt: TIMESTAMP
  }
  ```
- PDF file stored in `output/` directory
- LaTeX file stored in `output/` directory

---

## 3. PDF Download

### `GET /api/job/:id/download/pdf`

Downloads the generated PDF resume.

**Request Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**URL Parameters:**
```
:id - The jobId from the job creation
```

**Success Response (200):**

**Headers:**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="resume_Google_Software_Engineer.pdf"
Content-Length: 45678
```

**Body:**
```
<binary PDF data>
```

**Error Response (404):**
```json
{
  "error": "Job not found or PDF not available"
}
```

**Error Response (403):**
```json
{
  "error": "Not authorized to download this resume"
}
```

**What Gets Retrieved:**
- Reads PDF file from `output/job_<id>.pdf`
- Filename constructed from company and role in database
- Binary PDF data streamed to client

---

## 4. LaTeX Source Download

### `GET /api/job/:id/download/tex`

Downloads the LaTeX source code.

**Request Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Success Response (200):**

**Headers:**
```
Content-Type: text/plain
Content-Disposition: attachment; filename="resume_Google_Software_Engineer.tex"
```

**Body:**
```latex
\documentclass[11pt,letterpaper]{article}
...
```

---

## 5. User's Resume List

### `GET /api/resumes`

Returns all resumes created by the authenticated user.

**Request Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Success Response (200):**
```json
[
  {
    "id": 42,
    "company": "Google",
    "role": "Software Engineer",
    "fileName": "resume_job_abc123_google_swe.pdf",
    "pdfUrl": "/api/job/job_1728234567890_abc123/download/pdf",
    "createdAt": "2024-10-06T12:34:56.789Z"
  },
  {
    "id": 41,
    "company": "Meta",
    "role": "Frontend Engineer",
    "fileName": "resume_job_xyz789_meta_frontend.pdf",
    "pdfUrl": "/api/job/job_1728234567000_xyz789/download/pdf",
    "createdAt": "2024-10-05T08:22:11.456Z"
  }
]
```

**Fields:**
- `id`: Database primary key
- `company`: Extracted company name
- `role`: Extracted job role
- `fileName`: Generated filename for the PDF
- `pdfUrl`: API endpoint to download the PDF
- `createdAt`: Timestamp when resume was generated
- **Note:** Does NOT include `texContent` (too large for list view)

---

## 6. Single Resume Details

### `GET /api/resumes/:id`

Returns full details of a single resume, including LaTeX source.

**Request Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Success Response (200):**
```json
{
  "id": 42,
  "userId": 3,
  "company": "Google",
  "role": "Software Engineer",
  "fileName": "resume_job_abc123_google_swe.pdf",
  "pdfUrl": "/api/job/job_1728234567890_abc123/download/pdf",
  "texContent": "\\documentclass[11pt,letterpaper]{article}...",
  "createdAt": "2024-10-06T12:34:56.789Z"
}
```

**Error Response (404):**
```json
{
  "error": "Resume not found"
}
```

**Error Response (403):**
```json
{
  "error": "Not authorized to access this resume"
}
```

---

## 7. Subscription Status

### `GET /api/subscription`

Returns the user's subscription tier and usage limits.

**Request Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Success Response (200):**
```json
{
  "tier": "PRO",
  "dailyLimit": 20,
  "usageToday": 7,
  "remaining": 13,
  "resetTime": "2024-10-07T00:00:00.000Z"
}
```

**Tiers:**
- `FREE`: 5 resumes/day
- `PRO`: 20 resumes/day
- `ENTERPRISE`: Unlimited

---

## Complete Data Flow Example

### Step-by-Step Tracking

**1. User clicks "Generate Resume" in extension**

Extension sends:
```javascript
POST /api/process-job
{
  jobDescription: "Software Engineer at Google...",
  profileId: 1
}
```

**2. API Response**
```json
{
  "jobId": "job_1728234567890_abc123",
  "status": "PENDING"
}
```

**Data state:**
- BullMQ queue: Job added with status PENDING
- Database: No record yet
- File system: No files yet

**3. Extension starts polling**

```javascript
GET /api/job/job_1728234567890_abc123/status
```

**4. Worker picks up job (5 seconds later)**

Response:
```json
{
  "status": "PROCESSING",
  "progress": 20
}
```

**Data state:**
- BullMQ: Status = PROCESSING
- Worker: Calling AI API to extract company/role
- Database: Still no record
- File system: Creating temp directory

**5. Worker extracts data (15 seconds later)**

```json
{
  "status": "PROCESSING",
  "progress": 60
}
```

**Data state:**
- Worker: Has extracted company="Google", role="Software Engineer"
- Worker: Loading profile data
- Worker: Generating LaTeX

**6. Worker compiles PDF (30 seconds later)**

```json
{
  "status": "PROCESSING",
  "progress": 90
}
```

**Data state:**
- File system: `/output/job_abc123.tex` created
- Worker: Running Tectonic compiler

**7. Job completes (35 seconds later)**

```json
{
  "status": "COMPLETED",
  "company": "Google",
  "role": "Software Engineer",
  "artifacts": [
    {
      "type": "pdf",
      "url": "/api/job/job_1728234567890_abc123/download/pdf"
    }
  ],
  "resumeId": 42
}
```

**Data state:**
- Database: New row in `resumes` table:
  ```
  id=42
  userId=3
  company="Google"
  role="Software Engineer"
  fileName="resume_job_abc123_google_swe.pdf"
  pdfUrl="/api/job/job_1728234567890_abc123/download/pdf"
  texContent="<full LaTeX>"
  createdAt="2024-10-06T12:35:32.000Z"
  ```
- File system:
  ```
  /output/job_abc123.pdf (45 KB)
  /output/job_abc123.tex (12 KB)
  ```
- BullMQ: Job marked as completed

**8. User clicks download**

```javascript
GET /api/job/job_1728234567890_abc123/download/pdf
```

**Response:**
- Headers: `Content-Type: application/pdf`
- Body: Binary PDF data from `/output/job_abc123.pdf`
- Browser: Downloads as `resume_Google_Software_Engineer.pdf`

**9. User views history**

```javascript
GET /api/resumes
```

**Response:**
```json
[
  {
    "id": 42,
    "company": "Google",
    "role": "Software Engineer",
    "fileName": "resume_job_abc123_google_swe.pdf",
    "pdfUrl": "/api/job/job_1728234567890_abc123/download/pdf",
    "createdAt": "2024-10-06T12:35:32.000Z"
  },
  ...other resumes
]
```

---

## Error Scenarios

### Job Creation Fails
```json
POST /api/process-job
→ 400: Invalid job description
→ 403: Daily limit exceeded
→ 401: Invalid/expired token
```

### Job Processing Fails
```json
GET /api/job/:id/status
→ {
  "status": "FAILED",
  "error": "AI extraction timeout"
}
```

**Data state:**
- BullMQ: Job marked as failed
- Database: No record created
- File system: Temp files cleaned up

### Download Fails
```json
GET /api/job/:id/download/pdf
→ 404: Job not found or PDF not generated
→ 403: User doesn't own this resume
```

---

## Database Schema

### `resumes` Table
```sql
CREATE TABLE resumes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  company TEXT,
  role TEXT,
  file_name TEXT,
  pdf_url TEXT,
  tex_content TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### `users` Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  clerk_id TEXT UNIQUE,
  email TEXT,
  subscription_tier TEXT DEFAULT 'FREE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### `profiles` Table
```sql
CREATE TABLE profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  name TEXT,
  email TEXT,
  phone TEXT,
  linkedin TEXT,
  github TEXT,
  website TEXT,
  summary TEXT,
  -- ... other profile fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Testing Checklist

- [ ] Job creation returns valid jobId
- [ ] Status polling shows progress updates
- [ ] Company and role extracted correctly
- [ ] Database record created with all fields
- [ ] PDF download returns valid PDF file
- [ ] PDF filename matches company_role format
- [ ] LaTeX download returns source code
- [ ] Resume appears in user's resume list
- [ ] Daily limit enforced correctly
- [ ] Unauthorized access blocked (403)
- [ ] Failed jobs don't create database records
- [ ] Multiple concurrent jobs handled correctly

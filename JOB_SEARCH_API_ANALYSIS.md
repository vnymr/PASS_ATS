# Job Search API Analysis & Integration Guide

## Overview
The backend has a comprehensive job search API system with AI-powered natural language search and traditional filtering. The APIs are already implemented and registered in the server.

## Backend APIs Available

### 1. **Traditional Job Search** (`/api/jobs`)
**Location**: [server/routes/jobs.js](server/routes/jobs.js)
**Authentication**: Public (no auth required)
**Status**: ✅ Fully implemented and working

#### GET `/api/jobs`
Get paginated job listings with filters

**Query Parameters**:
- `filter` - 'all' | 'ai_applyable' | 'manual'
- `atsType` - Filter by ATS platform (GREENHOUSE, LEVER, etc.)
- `company` - Filter by company name (case-insensitive)
- `source` - Filter by job source
- `search` - Search in title/description/company
- `limit` - Number of results (default: 50)
- `offset` - Pagination offset (default: 0)

**Response**:
```json
{
  "jobs": [...],
  "total": 1234,
  "limit": 50,
  "offset": 0,
  "hasMore": true
}
```

**Test**:
```bash
curl 'http://localhost:3000/api/jobs?limit=5&filter=ai_applyable'
```

---

#### GET `/api/jobs/:id`
Get a specific job by ID with application history

**Authentication**: Public
**Response**:
```json
{
  "job": {
    "id": "...",
    "title": "...",
    "company": "...",
    "applications": [...]
  }
}
```

---

#### GET `/api/jobs/stats`
Get job statistics and sync status

**Response**:
```json
{
  "jobs": {
    "total": 5000,
    "active": 4500,
    "aiApplyable": 3000,
    "manual": 1500,
    "byATS": {
      "GREENHOUSE": 2000,
      "LEVER": 1500
    }
  },
  "sync": {
    "totalSynced": 5000,
    "lastRunDate": "2025-10-20T...",
    "lastRunDuration": 45000,
    "companiesDiscovered": 250,
    "isRunning": false
  }
}
```

---

#### POST `/api/jobs/sync`
Manually trigger job sync (background process)

**Authentication**: Public (should be admin-only in production)
**Response**:
```json
{
  "success": true,
  "message": "Job sync started in background"
}
```

---

### 2. **AI-Powered Job Search** (`/api/ai-search`)
**Location**: [server/routes/ai-search.js](server/routes/ai-search.js)
**Authentication**: Required (Bearer token)
**Status**: ✅ Fully implemented with OpenAI integration

#### POST `/api/ai-search`
Natural language job search with AI query parsing

**Request Body**:
```json
{
  "query": "remote software engineer jobs at startups",
  "limit": 20,
  "offset": 0
}
```

**AI Parsing Capabilities**:
The AI extracts structured filters from natural language:
- **Keywords**: Job titles, skills, technologies
- **Location**: Cities, states, or "remote"
- **Remote filtering**: Detects remote work preferences
- **Experience level**: Entry, mid, senior
- **Salary**: Min/max ranges
- **Companies**: Specific company mentions
- **Visa sponsorship**: Detects requirement
- **ATS filtering**: Specific platforms

**Example Queries**:
- "remote software engineer jobs at startups"
- "senior frontend developer in San Francisco paying over 150k"
- "entry level data scientist with visa sponsorship"
- "AI/ML engineer jobs at companies using Greenhouse"

**Response**:
```json
{
  "success": true,
  "query": "remote software engineer jobs",
  "parsedQuery": {
    "keywords": ["software engineer"],
    "remoteOnly": true
  },
  "explanation": "Found 150 jobs for software engineer with remote work.",
  "jobs": [...],
  "total": 150,
  "limit": 20,
  "offset": 0,
  "hasMore": true
}
```

**AI Model**: GPT-4o-mini with JSON response format
**Temperature**: 0.3 (focused, consistent parsing)

---

#### GET `/api/ai-search/suggestions`
Get search suggestions based on available jobs

**Authentication**: Required
**Response**:
```json
{
  "suggestions": [
    "remote software engineer jobs",
    "senior full stack developer positions",
    "entry level data scientist roles",
    "product manager jobs at tech startups"
  ],
  "stats": {
    "totalAIApplyable": 3000,
    "topPlatforms": [
      { "platform": "GREENHOUSE", "count": 2000 }
    ]
  }
}
```

---

### 3. **Job Sync Service**
**Location**: [server/lib/job-sync-service.js](server/lib/job-sync-service.js)
**Status**: ✅ Active with smart aggregation

**Features**:
- Automatic job syncing from multiple sources
- Greenhouse API (direct, unlimited)
- Lever API (direct, unlimited)
- Remotive API (remote jobs)
- ATS detection and complexity scoring
- Automatic deactivation of old jobs (7 days)

**Cron Schedule**: Every 6 hours (configurable)

---

## Frontend API Service

**Location**: [frontend/src/services/api.ts](frontend/src/services/api.ts)
**Status**: ✅ Already integrated with job search APIs

### Available Functions:

#### 1. `searchJobs(query, limit, offset)`
AI-powered search using natural language

```typescript
const result = await searchJobs("remote software engineer", 20, 0);
// Returns: JobSearchResult with parsed query and explanation
```

#### 2. `getJobSuggestions()`
Get search suggestions

```typescript
const { suggestions, stats } = await getJobSuggestions();
```

#### 3. `getJobs(params)`
Traditional filtering

```typescript
const result = await getJobs({
  filter: 'ai_applyable',
  search: 'engineer',
  limit: 50,
  offset: 0
});
```

#### 4. `detectIntent(userInput)`
Client-side intent detection

```typescript
const intent = await detectIntent("find me remote jobs");
// Returns: { intent: 'job_search', confidence: 0.85, extractedData: {...} }
```

---

## Integration Status

### ✅ Backend (Complete)
- [x] Job search routes registered in server.js
- [x] AI search routes registered in server.js
- [x] Auto-apply routes registered in server.js
- [x] Job sync service running
- [x] Database schema ready (AggregatedJob model)
- [x] Authentication middleware working

### ✅ Frontend API Service (Complete)
- [x] TypeScript interfaces defined
- [x] searchJobs() function implemented
- [x] getJobs() function implemented
- [x] getJobSuggestions() implemented
- [x] detectIntent() implemented
- [x] Auth token handling

### ⚠️ Frontend UI Components (Needs Integration)
- [ ] JobCard component needs API integration
- [ ] FindJob page needs to call searchJobs()
- [ ] Home page needs to call getJobs()
- [ ] Search input needs to call AI search

---

## Testing the APIs

### 1. Test Basic Job Listing (No Auth)
```bash
curl 'http://localhost:3000/api/jobs?limit=5'
```

### 2. Test AI Search (Auth Required)
First get a token, then:
```bash
TOKEN="your-jwt-token"
curl -X POST http://localhost:3000/api/ai-search \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "remote software engineer", "limit": 10}'
```

### 3. Test Job Stats
```bash
curl 'http://localhost:3000/api/jobs/stats'
```

---

## Next Steps for Frontend Integration

1. **Update Home.tsx** to use `getJobs()` for initial job listing
2. **Update FindJob.tsx** to use `searchJobs()` for AI search
3. **Update JobCard.tsx** to display job data from API
4. **Add search suggestions** using `getJobSuggestions()`
5. **Test end-to-end flow** with real API data

---

## Key Features to Highlight

### AI Search Capabilities
- Natural language understanding
- Context-aware filtering
- Experience level detection
- Salary range parsing
- Remote work detection
- Visa sponsorship detection

### Data Quality
- Direct ATS integration (no middleman)
- Real-time job data
- ATS complexity scoring
- AI-applyable flagging
- Automatic job deactivation

### Performance
- Pagination support
- Efficient database queries
- Background job syncing
- Rate limiting protection
- Caching support (Redis ready)

---

## Database Schema

**Table**: `AggregatedJob`

Key fields:
- `id` - Unique identifier
- `externalId` - External job ID (unique)
- `source` - Job source (greenhouse, lever, etc.)
- `title` - Job title
- `company` - Company name
- `location` - Job location
- `salary` - Salary range (nullable)
- `description` - Full job description
- `requirements` - Job requirements
- `applyUrl` - Application URL
- `atsType` - ATS platform (GREENHOUSE, LEVER, etc.)
- `atsComplexity` - LOW | MEDIUM | HIGH
- `atsConfidence` - Detection confidence (0-100)
- `aiApplyable` - Boolean flag
- `isActive` - Active status
- `postedDate` - Job posting date
- `lastChecked` - Last sync check

---

## Error Handling

All APIs return consistent error format:
```json
{
  "error": "Error message",
  "message": "Detailed error (dev only)"
}
```

HTTP Status Codes:
- `200` - Success
- `400` - Bad request (missing/invalid parameters)
- `401` - Unauthorized (missing/invalid token)
- `404` - Not found
- `429` - Rate limit exceeded
- `500` - Server error

---

## Rate Limiting

- General API: 500 requests per 15 min
- Auth endpoints: 20 requests per 15 min
- Job processing: 50 requests per hour

---

## Conclusion

The backend job search API system is **fully functional and ready for frontend integration**. The APIs provide:

1. ✅ Traditional filtering with pagination
2. ✅ AI-powered natural language search
3. ✅ Job statistics and sync status
4. ✅ Auto-apply capability
5. ✅ Proper authentication and rate limiting

**Frontend Next Steps**: Connect the existing UI components to these APIs and test the complete user flow.

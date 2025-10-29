### ERD

```mermaid
erDiagram
  User ||--o{ Job : has
  User ||--o| Profile : has
  User ||--o| Subscription : has
  User ||--o{ UsageTracking : has
  User ||--o{ Payment : has
  Job ||--o{ Artifact : has
  Job ||--o{ Embedding : has

  User {
    Int id PK
    String email
    String password
    String clerkId
    DateTime createdAt
  }
  Profile {
    Int id PK
    Int userId UK
    Json data
    DateTime updatedAt
  }
  Job {
    String id PK
    Int userId
    String status
    String resumeText
    String jobDescription
    String aiMode
    String company
    String role
    String jobUrl
    DateTime createdAt
    DateTime completedAt
  }
  Artifact {
    String id PK
    String jobId FK
    String type
    Int version
    Bytes content
    Json metadata
    DateTime createdAt
  }
  Embedding {
    String id PK
    String jobId FK
    String content
    String contentType
    Float[] embedding
    Float relevance
    DateTime createdAt
  }
  Subscription {
    String id PK
    Int userId UK
    String tier
    String status
    String stripeCustomerId
    String stripeSubscriptionId
    DateTime updatedAt
  }
```

### Table notes (source)

```1:179:/Users/vinaymuthareddy/RESUME_GENERATOR/server/prisma/schema.prisma
datasource db { provider = "postgresql" }
```

### Generation history storage and queries

- Records live in `Job` with `status`, `createdAt`, plus related `Artifact` for PDFs.
- Listing endpoint queries:

```1406:1449:/Users/vinaymuthareddy/RESUME_GENERATOR/server/server.js
const jobs = await prisma.job.findMany({ where:{ userId: req.userId }, orderBy:{ createdAt:'desc' }, ... })
```

- Resumes endpoint returns latest PDF artifact per job:

```1605:1647:/Users/vinaymuthareddy/RESUME_GENERATOR/server/server.js
include: { artifacts: { where:{ type:'PDF_OUTPUT' }, orderBy:{ version:'desc' }, take:1 } }
```

- Download endpoints stream `Artifact.content` by job id or filename:

```2537:2606:/Users/vinaymuthareddy/RESUME_GENERATOR/server/server.js
app.get('/api/resumes/:identifier', ...)
```

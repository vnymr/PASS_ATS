# Job-Hunting AI Assistant – Execution Plan (Lean, Ship-Fast)

## 0) Scope and Principles
- Ship a 1-week MVP: Chat + supervised apply on a pasted job URL.
- Use existing stack (Express, BullMQ/Redis, Prisma/Postgres). Add only: pgvector, OpenAI SDK, SSE.
- Supervised by default; autonomy is opt-in with hard limits.

## 1) Success Criteria (Week-1 MVP)
- User can: open chat → paste job URL → AI drafts tailored resume → user clicks Apply → goes through existing auto-apply.
- P95 end-to-end < 30s; error rate < 5%; cost < --.20 per session.

## 2) Milestones & Timeline
- Day 1-2: Backend chat SSE + intents (APPLY_TO_JOB, SET_GOAL, FIND_JOBS).
- Day 3: Minimal Chat UI + Clerk auth + streaming.
- Day 4: Supervised apply preview flow (web + extension widget).
- Day 5: Short-term + working memory; summaries every 10 turns.
- Day 6: pgvector setup; embed profile+jobs on change/ingest.
- Day 7: Polishing, rate limits, logs, canary deploy, docs.

## 3) Minimal Tech Adds
- OpenAI SDK (chat + embeddings), eventsource-parser (frontend), pgvector (DB).
- SSE for streaming responses.

## 4) Data Model Additions (Prisma)
- Conversation(id, userId, title?, createdAt, updatedAt)
- Message(id, conversationId, role: USER|ASSISTANT|SYSTEM|TOOL, content, metadata, createdAt)
- Goal(id, userId, title, targetRole, targetLocation?, salaryMin?, salaryMax?, status, targetApplications, createdAt, updatedAt)
- AgentTaskState(id, userId, conversationId, currentIntent, workflowStep, context Json, expiresAt, updatedAt)
- AggregatedJob: add matchScore Float?, profileEmbedding Float[]?

## 5) Chat API Design
- POST /api/chat (SSE)
  - Input: { conversationId?, message, stream=true }
  - Output (SSE): data: { type: text|action|tool_call|done, payload }
- Intents (v1): APPLY_TO_JOB, SET_GOAL, FIND_JOBS, HELP/UNKNOWN
- Tool calls
  - searchJobs(params)
  - generateResume(jobUrl|jd)
  - prepareApplication(jobId) → returns preview
- Rate limits: 60 req/hour/user; payload size limits; per-intent quotas.

## 6) Memory Layer (Lean v1)
- Short-term: last 10 messages + rolling summary every 10 turns.
- Working memory: AgentTaskState (current intent, waitingFor, context); TTL 48h.
- Semantic (later): embeddings of conversation summaries; top-3 retrieval.
- Profile memory: include goal summary and profile summary (<500 tokens).

## 7) Agent Modules (server/agents)
- conversation.ts: intent routing, system prompt construction.
- job-hunter.ts: query jobs (existing APIs) + compute matchScore.
- application-agent.ts: build resume draft via existing generator; build apply preview.
- goal-manager.ts: CRUD goals + weekly targets.

## 8) Supervised Apply UX
- Web: Preview card with: job details, tailored resume diff, steps to submit, CTA “Apply now”.
- Extension: Widget detects job URL, opens chat with prefilled context; same preview.
- Always require user click for submit in v1.

## 9) Observability & Cost Controls
- Log per-message: tokens in/out, tool calls, latency, estimated cost.
- Add quotas per tier; hard caps and 429s with friendly guidance.
- Circuit breakers around auto-apply; fall back to manual with clear reason.

## 10) Privacy & Compliance
- Retention: messages 90 days by default; allow user purge.
- Opt-out of long-term memory; masked PII in logs.
- DPIA-lite checklist for new data fields.

## 11) Risks & Mitigations
- Function-call hallucinations → strict schema validation + safe fallbacks.
- Cost spikes → quotas, summaries, cheaper models for simple intents.
- Flaky ATS pages → supervised mode + clear error recovery.

## 12) Rollout Plan
- Feature flag: chat_enabled.
- Staging test matrix (browsers, top ATS, auth flows).
- Canary to 5% users; monitor errors, costs, latency; expand to 100%.

## 13) Deliverables Checklist
- API: /api/chat (SSE), /api/goals (CRUD), schema migration (pgvector + models).
- Frontend: Chat UI, Apply Preview, Extension widget.
- Docs: User guide, support SOP, runbook.

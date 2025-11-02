/**
 * LLM-first supervised persona that plans actions and emits structured JSON
 * Hardcoded parsing removed; fallback used only when LLM returns UNKNOWN
 */

import OpenAI from 'openai';
import { getToolSchemasForOpenAI } from './tool-registry.js';
import { getSearchDefaults } from './profile-manager.js';
import { searchRelevantSummaries } from '../memory/summary-store.js';
import { generateEmbedding } from '../memory/embedding-utils.js';
import logger from '../logger.js';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Build system prompt for the persona
 * @param {string} [profileContext] - User profile context
 * @param {string} [memoryContext] - Relevant memory from past conversations
 * @returns {string}
 */
function buildSystemPrompt(profileContext = '', memoryContext = '') {
  const profileSection = profileContext
    ? `\n\nUSER PROFILE:\n${profileContext}\n\nUse this profile information to personalize responses and auto-fill search parameters when the user makes vague requests like "find me jobs" or "show me opportunities".\n`
    : '';

  const memorySection = memoryContext
    ? `\n\nRELEVANT MEMORY (from past conversations):\n${memoryContext}\n\nUse this context to provide continuity and personalized responses based on previous interactions.\n`
    : '';

  return `You are a helpful job-hunting AI assistant that helps users search for jobs and manage their applications.${profileSection}${memorySection}

YOUR ROLE:
- Help users search for jobs based on their specific requests
- Answer questions about job search and provide guidance
- Help with resume previews and applications when asked
- Track applications when requested
- Proactively suggest helpful automation when patterns emerge

PROACTIVE ASSISTANCE GUIDELINES:
- ANALYZE conversation history to detect patterns (e.g., repeated searches, mentions of targets)
- After noticing 2-3 job searches in the conversation, suggest creating a routine to automate
- If user mentions numeric targets (e.g., "apply to 20 jobs"), proactively suggest goal tracking
- When user expresses frustration with repetitive work, offer automation solutions
- Detect urgency signals and prioritize helpful suggestions
- Balance helpfulness with respect for user autonomy - suggest clearly, explain benefits, but don't force
- Use conversation context (previous messages) to understand user's journey and offer relevant help

IMPORTANT CONSTRAINTS:
- Keep responses conversational and concise
- When suggesting automation, explain the benefit clearly
- Don't create goals/routines without user confirmation
- Focus on job search as the primary function
- If uncertain about what the user wants, ask for clarification

RESPONSE FORMAT:
You must respond with ONLY a JSON object (no markdown, no extra text) with this exact structure:
{
  "plan": "brief reasoning in 1-2 sentences explaining what you're doing",
  "actions": [
    { "type": "message", "content": "..." },
    { "type": "tool", "name": "search_jobs", "input": { ... } }
  ]
}

ACTION TYPES:
- "message": Send a text response to the user
- "tool": Execute a tool - YOU HAVE 12 TOOLS: search_jobs, generate_resume_preview, prepare_application_preview, create_goal, update_goal, list_goals, submit_application, track_applications, create_routine, list_routines, update_routine, delete_routine
- "UNKNOWN": Special marker when you cannot interpret the request (use this when truly unclear)

TEMPORAL KEYWORDS:
When users mention timeframes like "today", "this week", "recent", "this month", YOU MUST:
1. Calculate the appropriate date/time boundary
2. Include "postedSince" in the tool input as an ISO 8601 date string
3. Use current date as reference: ${new Date().toISOString()}

Examples of temporal interpretation:
- "today" → postedSince: date 24 hours ago
- "this week" / "past week" / "last week" → postedSince: date 7 days ago
- "recent" / "recently" / "latest" / "new" → postedSince: date 3 days ago
- "this month" → postedSince: first day of current month

JOB SEARCH RULES:
1. When searching for jobs:
   - Use "role" parameter for precise matching (e.g., "Software Engineer", "Product Manager")
   - Include "postedSince" for temporal keywords (today=24h, week=7d, recent=3d)
   - Use filter: "ai_applyable" only if user explicitly mentions auto-apply or AI-applyable jobs
   - Default limit is 10, increase if user asks for more

2. ADAPTIVE SEARCH (when search returns 0 results):
   - Analyze why the search may have failed (too specific role, restrictive location, narrow date range, etc.)
   - Decide intelligently which parameters to broaden or remove to find results
   - Consider using "query" instead of "role" for more flexible matching
   - Balance between broadening search and maintaining relevance to user's request
   - Explain to the user what you're adjusting and why

3. For applications:
   - Only apply to jobs when user explicitly asks to apply
   - Don't automatically submit applications just because jobs are found
   - Use prepare_application_preview first if user wants to see what will be submitted

3. Goals and routines:
   - Suggest goals when user mentions targets or deadlines
   - Suggest routines after repeated manual searches (2-3 times)
   - Always ask for confirmation before creating automation
   - Explain the benefit of automation when suggesting

EXAMPLES (Proactive & Helpful):

User: "find software engineer jobs"
Response:
{
  "plan": "User wants to search for software engineer positions - will search and show results",
  "actions": [
    { "type": "message", "content": "Searching for Software Engineer positions..." },
    { "type": "tool", "name": "search_jobs", "input": { "role": "Software Engineer", "limit": 10 } }
  ]
}

User: "show me recent product manager roles"
Response:
{
  "plan": "User wants recent PM jobs - will search for positions posted in the last 3 days",
  "actions": [
    { "type": "message", "content": "Searching for recent Product Manager positions..." },
    { "type": "tool", "name": "search_jobs", "input": { "role": "Product Manager", "postedSince": "${new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()}", "limit": 10 } }
  ]
}

User: "find me jobs I can auto-apply to"
Response:
{
  "plan": "User wants AI-applyable jobs - will search with filter",
  "actions": [
    { "type": "message", "content": "Searching for jobs you can auto-apply to..." },
    { "type": "tool", "name": "search_jobs", "input": { "filter": "ai_applyable", "limit": 10 } }
  ]
}

User: "hello"
Response:
{
  "plan": "User is greeting - I'll respond warmly and briefly explain what I can do",
  "actions": [
    { "type": "message", "content": "Hi! I can help you search for jobs, prepare applications, and track your job hunt. What kind of role are you looking for?" }
  ]
}

User: "what can you do?"
Response:
{
  "plan": "User wants to know my capabilities - I'll list the main features",
  "actions": [
    { "type": "message", "content": "I can help you with:\\n\\n🔍 Search for jobs by role, company, location\\n📝 Generate tailored resumes for specific positions\\n✅ Apply to jobs (manual or auto-apply where supported)\\n📊 Track your applications\\n🎯 Set goals and routines if you want (optional)\\n\\nTry asking me to find jobs in a specific role, or paste a job URL for a resume preview!" }
  ]
}

User: "track my applications"
Response:
{
  "plan": "User wants to see their application status",
  "actions": [
    { "type": "message", "content": "Checking your application status..." },
    { "type": "tool", "name": "track_applications", "input": { "limit": 10 } }
  ]
}

PROACTIVE EXAMPLES (When to Suggest Automation):

User: "find product manager jobs" [CONTEXT: User has searched 3 times in this conversation]
Response:
{
  "plan": "User has searched multiple times - will search and suggest setting up a routine for automation",
  "actions": [
    { "type": "message", "content": "Searching for Product Manager positions..." },
    { "type": "tool", "name": "search_jobs", "input": { "role": "Product Manager", "limit": 10 } },
    { "type": "message", "content": "\\n\\nI notice you've been searching for jobs a few times. Would you like me to set up a daily routine to automatically search and notify you of new postings? It saves time and ensures you never miss fresh opportunities." }
  ]
}

User: "I need to apply to at least 20 jobs this week"
Response:
{
  "plan": "User mentioned a specific target - will suggest creating a goal to track progress",
  "actions": [
    { "type": "message", "content": "Got it! Let me help you track that. I can create a goal to help you monitor your progress toward 20 applications this week. Want me to set that up? I'll remind you of your progress and help you stay on track." }
  ]
}

User: "ugh I keep searching for the same roles every day"
Response:
{
  "plan": "User is frustrated with repetitive work - will suggest automation to reduce manual effort",
  "actions": [
    { "type": "message", "content": "I can help with that! Instead of manually searching every day, I can set up a routine that automatically searches for your preferred roles daily and notifies you of new postings. Would you like me to create a routine for you? Just let me know the role, location, and how often you want to check." }
  ]
}

User: "show me software engineer jobs" [CONTEXT: User just asked this yesterday too]
Response:
{
  "plan": "User is repeating searches from previous sessions - suggest routine to automate this",
  "actions": [
    { "type": "message", "content": "Searching for Software Engineer positions..." },
    { "type": "tool", "name": "search_jobs", "input": { "role": "Software Engineer", "limit": 10 } },
    { "type": "message", "content": "\\n\\nI see you're checking for Software Engineer roles regularly. Want to save time? I can set up a daily routine to automatically search and notify you of new postings. That way you won't miss any fresh opportunities!" }
  ]
}

ADAPTIVE SEARCH EXAMPLE (After 0 Results):

User: "find quantum computing engineer jobs in san francisco posted today"
Assistant searches, returns 0 results.
System asks: "The search returned 0 results. Original parameters: {"role":"Quantum Computing Engineer","location":"San Francisco","postedSince":"2025-10-31T00:00:00.000Z"}. Should I try a broader search, or would the user prefer to know there are no matches right now?"

Response:
{
  "plan": "The search was too restrictive - specific niche role + single city + one day. I should broaden the search to help the user find relevant opportunities. I'll use a broader query, expand location, and extend the timeframe.",
  "actions": [
    { "type": "message", "content": "I didn't find any Quantum Computing Engineer jobs posted today in San Francisco. Let me try a broader search for quantum computing roles across the Bay Area from the past two weeks..." },
    { "type": "tool", "name": "search_jobs", "input": { "query": "quantum computing", "location": "Bay Area", "postedSince": "2025-10-18T00:00:00.000Z", "limit": 10 } }
  ]
}`;
}

/**
 * Plan actions based on user message (LLM-first approach)
 * @param {object} params
 * @param {string} params.message - User message
 * @param {object} [params.metadata] - Additional metadata
 * @param {Array} [params.conversation] - Conversation history
 * @param {object} [params.profile] - User profile with preferences
 * @param {string} [params.profileContext] - Formatted profile context string
 * @param {number} [params.userId] - User ID for loading relevant memories
 * @param {Function} [params.onStream] - Optional callback for streaming chunks (receives text as it arrives)
 * @returns {Promise<{ plan: string, actions: Array<{ type: string, content?: string, name?: string, input?: object }> }>}
 */
export async function plan({ message, metadata = {}, conversation = [], profile = null, profileContext = '', userId = null, onStream = null, fastMode = false }) {
  try {
    logger.info({ message, metadata, hasProfile: !!profile, userId, fastMode }, 'Planning persona actions (LLM-first)');

    // Start memory search in parallel (non-blocking with 300ms timeout)
    let memoryContext = '';
    const isSimpleGreeting = /^(hi|hey|hello|sup|yo)$/i.test(message.trim());

    // Create memory search promise that runs in parallel
    let memoryPromise = null;
    if (userId && !isSimpleGreeting && !fastMode) {
      memoryPromise = (async () => {
        try {
          const startTime = Date.now();

          // Generate embedding for current message to find relevant past conversations
          const messageEmbedding = await generateEmbedding(message);

          // Search for top 3 most relevant conversation summaries
          const relevantSummaries = await searchRelevantSummaries({
            userId,
            queryEmbedding: messageEmbedding,
            limit: 3
          });

          const elapsed = Date.now() - startTime;

          // Build memory context from summaries
          if (relevantSummaries.length > 0) {
            const memoryBullets = relevantSummaries
              .filter(s => s.distance < 0.5) // Only include if reasonably similar (cosine distance < 0.5)
              .map((s, idx) => `${idx + 1}. ${s.summary.substring(0, 200)}`)
              .join('\n');

            if (memoryBullets) {
              logger.info({ userId, summaryCount: relevantSummaries.length, elapsed }, 'Loaded relevant memories');
              return memoryBullets;
            }
          }
          return '';
        } catch (memoryError) {
          // Don't fail if memory loading fails - continue without it
          logger.warn({ error: memoryError.message, userId }, 'Failed to load memories (non-blocking)');
          return '';
        }
      })();

      // Race memory search against timeout
      // Production: 2000ms to account for pgvector query + network latency
      // Development: 500ms for faster iteration
      const MEMORY_TIMEOUT_MS = process.env.NODE_ENV === 'production' ? 2000 : 500;

      try {
        memoryContext = await Promise.race([
          memoryPromise,
          new Promise((resolve) => setTimeout(() => {
            logger.info({ timeout: MEMORY_TIMEOUT_MS }, `Memory search timed out after ${MEMORY_TIMEOUT_MS}ms, proceeding without it`);
            resolve('');
          }, MEMORY_TIMEOUT_MS))
        ]);
      } catch (error) {
        logger.warn({ error: error.message }, 'Memory search race failed, proceeding without it');
        memoryContext = '';
      }
    } else if (isSimpleGreeting) {
      logger.info({ message }, 'Skipping memory search for simple greeting');
    }

    // Build system prompt with profile context and memory
    const systemPrompt = buildSystemPrompt(profileContext, memoryContext);

    // Include conversation history for context
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversation.map(({ role, content }) => ({ role, content })),
      { role: 'user', content: message }
    ];

    // Define function schema for structured plan output
    const planFunction = {
      type: 'function',
      function: {
        name: 'create_plan',
        description: 'Create a structured plan with reasoning and actions',
        parameters: {
          type: 'object',
          properties: {
            plan: {
              type: 'string',
              description: 'Brief reasoning in 1-2 sentences explaining what you are doing'
            },
            actions: {
              type: 'array',
              description: 'List of actions to execute',
              items: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    enum: ['message', 'tool', 'UNKNOWN'],
                    description: 'Type of action: message (send text), tool (execute function), or UNKNOWN (cannot interpret)'
                  },
                  content: {
                    type: 'string',
                    description: 'Message content (only for message type)'
                  },
                  name: {
                    type: 'string',
                    description: 'Tool name (only for tool type)'
                  },
                  input: {
                    type: 'object',
                    description: 'Tool input parameters (only for tool type)'
                  }
                },
                required: ['type']
              }
            }
          },
          required: ['plan', 'actions']
        }
      }
    };

    // Call OpenAI with streaming enabled using function calling
    // Use gpt-3.5-turbo in fast mode for lower latency
    const OPENAI_TIMEOUT_MS = 30000; // 30 second timeout

    const streamPromise = openai.chat.completions.create({
      model: fastMode ? 'gpt-3.5-turbo' : 'gpt-4o-mini',
      messages,
      tools: [planFunction],
      tool_choice: { type: 'function', function: { name: 'create_plan' } },
      temperature: 0.3, // Lower temperature for more deterministic planning
      max_tokens: fastMode ? 300 : 600,
      stream: true // Enable streaming for faster first token
    });

    // Wrap streaming in timeout to prevent hanging
    const stream = await Promise.race([
      streamPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('OpenAI stream timeout')), OPENAI_TIMEOUT_MS)
      )
    ]);

    // Collect streaming chunks and extract function call
    let functionCallArgs = '';
    let firstChunkReceived = false;
    const startStreamTime = Date.now();

    // Create timeout for chunk iteration
    const chunkIterationTimeout = setTimeout(() => {
      logger.error('OpenAI chunk iteration timed out after 30s');
      throw new Error('OpenAI chunk iteration timeout');
    }, OPENAI_TIMEOUT_MS);

    try {
      for await (const chunk of stream) {
        if (!firstChunkReceived) {
          const ttfb = Date.now() - startStreamTime;
          logger.info({ ttfb }, 'First token received from OpenAI (streaming)');
          firstChunkReceived = true;
        }

        const delta = chunk.choices[0]?.delta;
        if (delta?.tool_calls?.[0]?.function?.arguments) {
          const argChunk = delta.tool_calls[0].function.arguments;
          functionCallArgs += argChunk;

          // Stream chunks to callback if provided (for real-time feedback)
          if (onStream && argChunk) {
            onStream(argChunk);
          }
        }
      }
    } finally {
      clearTimeout(chunkIterationTimeout);
    }

    const totalStreamTime = Date.now() - startStreamTime;
    logger.info({ totalStreamTime, chunkSize: functionCallArgs.length }, 'OpenAI streaming completed');

    // Parse the complete function arguments
    if (!functionCallArgs) {
      throw new Error('No function call arguments received from OpenAI');
    }

    const plannedActions = JSON.parse(functionCallArgs);

    // Validate structure
    if (!plannedActions.plan || !Array.isArray(plannedActions.actions)) {
      throw new Error('Invalid action structure from persona');
    }

    // Check if LLM returned UNKNOWN
    const hasUnknownAction = plannedActions.actions.some(action => action.type === 'UNKNOWN');
    if (hasUnknownAction) {
      logger.warn({ message }, 'LLM returned UNKNOWN, applying config-based fallback');
      // This will be handled by tool-registry.js fallback logic
      return {
        plan: 'LLM could not interpret confidently, fallback will be applied',
        actions: [
          {
            type: 'UNKNOWN',
            originalMessage: message,
            profile
          }
        ]
      };
    }

    logger.info({ plan: plannedActions.plan, actionCount: plannedActions.actions.length }, 'Persona planning completed');

    return plannedActions;

  } catch (error) {
    logger.error({ error: error.message, message }, 'Persona planning failed');

    // Fallback to safe default
    return {
      plan: 'Error occurred during planning, falling back to help message',
      actions: [
        {
          type: 'message',
          content: 'I can help you find jobs and apply to them. Try asking me to find specific roles (e.g., "find product manager jobs") or paste a job URL for a tailored resume preview.'
        }
      ]
    };
  }
}

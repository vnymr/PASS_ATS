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

  return `You are an AUTONOMOUS job-hunting AI agent that PROACTIVELY manages the user's entire job search.${profileSection}${memorySection}

YOUR ROLE:
You don't just respond to requests - you TAKE INITIATIVE and MANAGE the user's job hunting automatically:
- Create goals when user expresses career interests
- Set up daily/weekly routines for automated job searches
- Automatically apply to suitable jobs
- Track progress and update goals
- Search for relevant opportunities daily
- Be proactive and autonomous - the user should relax while you work

AUTONOMOUS BEHAVIORS:
1. When user mentions career goals → Automatically create_goal AND create_routine for daily searches
2. When you find good job matches → Automatically submit_application (if eligible)
3. After applications → Automatically update_goal with progress
4. Regularly check track_applications to monitor status
5. Set up routines for recurring tasks → create_routine (daily searches, weekly reviews)
6. Be proactive: suggest actions, take initiative, drive the process forward

IMPORTANT CONSTRAINTS:
- Take initiative - don't wait for explicit commands
- Use multiple tools in sequence to accomplish goals
- Always update goals with progress after taking actions
- Keep responses concise and action-oriented
- If truly uncertain, ask for clarification (rarely needed)

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
- "UNKNOWN": Special marker when you cannot interpret (rarely use this - be autonomous!)

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

AUTONOMOUS BEHAVIOR RULES:
1. When user expresses career goals/interests:
   - AUTOMATICALLY use create_goal to set up their goals
   - Example: "I want a PM job" → create_goal("Land Product Manager role")

2. When searching for jobs:
   - Use "role" parameter for precise matching
   - Include "postedSince" for temporal keywords (today=24h, week=7d, recent=3d)
   - "auto-apply" → filter: "ai_applyable"

3. When you find suitable AI-applyable jobs:
   - First: prepare_application_preview to check eligibility
   - If eligible: AUTOMATICALLY submit_application
   - Then: update_goal with progress
   - Inform user: "Applied to 3 positions for you!"

4. Proactive actions:
   - Periodically use track_applications to check status
   - Update goals with progress after actions
   - Suggest next steps without waiting for user

5. Multiple tool chains:
   - Execute 3-5 tools in sequence to accomplish tasks
   - Example: create_goal → search_jobs → prepare_application → submit_application → update_goal

EXAMPLES (Autonomous, Multi-Tool Workflows):

User: "I want to find a software engineer job"
Response:
{
  "plan": "User wants SWE role - I'll create a goal, set up daily search routine, and start applying automatically",
  "actions": [
    { "type": "message", "content": "I'll help you land a Software Engineer role! Creating a goal, setting up daily searches, and finding opportunities..." },
    { "type": "tool", "name": "create_goal", "input": { "title": "Land Software Engineer position", "type": "JOB_SEARCH", "description": "Find and apply to Software Engineer roles" } },
    { "type": "tool", "name": "create_routine", "input": { "title": "Daily SWE job search", "description": "Search for new Software Engineer positions every day", "type": "SEARCH_JOBS", "frequency": "DAILY", "schedule": "09:00", "config": { "role": "Software Engineer", "filter": "ai_applyable" } } },
    { "type": "tool", "name": "search_jobs", "input": { "role": "Software Engineer", "filter": "ai_applyable", "postedSince": "${new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()}", "limit": 20 } }
  ]
}

User: "apply to some good matches"
Response:
{
  "plan": "Found 5 great matches - will prepare previews, submit applications, and update goal automatically",
  "actions": [
    { "type": "message", "content": "Found 5 excellent matches! Applying to them now..." },
    { "type": "tool", "name": "prepare_application_preview", "input": { "jobId": "job_abc123" } },
    { "type": "tool", "name": "submit_application", "input": { "jobId": "job_abc123" } },
    { "type": "tool", "name": "prepare_application_preview", "input": { "jobId": "job_def456" } },
    { "type": "tool", "name": "submit_application", "input": { "jobId": "job_def456" } },
    { "type": "tool", "name": "update_goal", "input": { "goalId": "goal_xyz", "progress": 40, "notes": "Applied to 2 positions at top companies" } },
    { "type": "message", "content": "Applied to 2 positions! I'll keep searching and applying daily." }
  ]
}

User: "any updates?"
Response:
{
  "plan": "User wants status - I'll check applications, update goals, and search for new opportunities proactively",
  "actions": [
    { "type": "message", "content": "Let me check your application status and find new opportunities..." },
    { "type": "tool", "name": "track_applications", "input": { "limit": 10 } },
    { "type": "tool", "name": "list_goals", "input": { "status": "ACTIVE" } },
    { "type": "tool", "name": "search_jobs", "input": { "filter": "ai_applyable", "postedSince": "${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()}", "limit": 15 } }
  ]
}

User: "show me recent product manager roles"
Response:
{
  "plan": "User wants PM jobs - will search and automatically apply to top matches",
  "actions": [
    { "type": "message", "content": "Searching for recent Product Manager positions and applying to the best matches..." },
    { "type": "tool", "name": "search_jobs", "input": { "role": "Product Manager", "filter": "ai_applyable", "postedSince": "${new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()}", "limit": 10 } }
  ]
}

User: "hello"
Response:
{
  "plan": "User is greeting - I'll introduce my autonomous capabilities and offer to start working",
  "actions": [
    { "type": "message", "content": "Hi! I'm your autonomous job search agent. I can automatically:\\n- Create and track your career goals\\n- Search for jobs daily\\n- Apply to positions on your behalf\\n- Monitor application status\\n\\nTell me what role you're looking for and I'll handle everything!" }
  ]
}

User: "what can you do?"
Response:
{
  "plan": "User wants capabilities - I'll explain my autonomous features and proactive approach",
  "actions": [
    { "type": "message", "content": "I'm an AUTONOMOUS job hunting agent. I don't just search - I DO:\\n\\n✅ Automatically apply to jobs\\n✅ Create and track your goals\\n✅ Generate tailored resumes\\n✅ Monitor application status\\n✅ Search for new opportunities daily\\n\\nYou relax - I'll handle your entire job search. Just tell me what kind of role you want!" }
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
 * @returns {Promise<{ plan: string, actions: Array<{ type: string, content?: string, name?: string, input?: object }> }>}
 */
export async function plan({ message, metadata = {}, conversation = [], profile = null, profileContext = '', userId = null }) {
  try {
    logger.info({ message, metadata, hasProfile: !!profile, userId }, 'Planning persona actions (LLM-first)');

    // Load relevant memories from past conversations
    let memoryContext = '';
    if (userId) {
      try {
        // Generate embedding for current message to find relevant past conversations
        const messageEmbedding = await generateEmbedding(message);

        // Search for top 3 most relevant conversation summaries
        const relevantSummaries = await searchRelevantSummaries({
          userId,
          queryEmbedding: messageEmbedding,
          limit: 3
        });

        // Build memory context from summaries
        if (relevantSummaries.length > 0) {
          const memoryBullets = relevantSummaries
            .filter(s => s.distance < 0.5) // Only include if reasonably similar (cosine distance < 0.5)
            .map((s, idx) => `${idx + 1}. ${s.summary.substring(0, 200)}`)
            .join('\n');

          if (memoryBullets) {
            memoryContext = memoryBullets;
            logger.info({ userId, summaryCount: relevantSummaries.length }, 'Loaded relevant memories');
          }
        }
      } catch (memoryError) {
        // Don't fail if memory loading fails - continue without it
        logger.warn({ error: memoryError.message, userId }, 'Failed to load memories (non-blocking)');
      }
    }

    // Build system prompt with profile context and memory
    const systemPrompt = buildSystemPrompt(profileContext, memoryContext);

    // Include conversation history for context
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversation.map(({ role, content }) => ({ role, content })),
      { role: 'user', content: message }
    ];

    // Call OpenAI to interpret and plan
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.3, // Lower temperature for more deterministic planning
      max_tokens: 600
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('Empty response from OpenAI');
    }

    const plannedActions = JSON.parse(responseContent);

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

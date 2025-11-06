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
    ? `\n\nUSER PROFILE:\n${profileContext}\n`
    : '';

  return `You are a helpful job search assistant. Focus ONLY on what the user is asking RIGHT NOW. Look at the recent conversation to understand context.${profileSection}

CONVERSATION CONTEXT (last few messages):
This shows what was discussed. Use it to understand references like "that job" or "the resume".

YOUR GOAL:
Respond to the user's CURRENT message. Don't bring up old topics or combine multiple requests. Just handle what they're asking now.

AVAILABLE TOOLS:
1. search_jobs: Find jobs
   - Input: { "role": "Job Title", "company": "Company Name", "location": "Location", "limit": 10 }

2. generate_resume_preview: Create resume
   - Input: { "jobDescription": "text" } OR { "jobUrl": "url" } OR { "jobId": "id" }

3. create_routine: Set up automation
   - Input: { "title": "Routine Name", "description": "What it does", "schedule": "09:00", "frequency": "DAILY" }
   - IMPORTANT: Use "title" not "name"

4. track_applications: Check application status
5. create_goal, update_goal, list_goals: Track goals

HOW TO RESPOND:
Look at the conversation history. If user mentions "that job" or "the one above", find it in recent messages.

Respond with JSON:
{
  "plan": "what I'm doing for THIS request",
  "actions": [
    { "type": "message", "content": "..." },
    { "type": "tool", "name": "...", "input": {...} }
  ]
}

EXAMPLES:

User: "find product manager jobs"
Response:
{
  "plan": "User wants PM jobs",
  "actions": [
    { "type": "message", "content": "Searching for Product Manager positions..." },
    { "type": "tool", "name": "search_jobs", "input": { "role": "Product Manager", "limit": 10 } }
  ]
}

User: "create a resume for product manager" [CONTEXT: User just asked about PM jobs]
Response:
{
  "plan": "User wants a PM resume",
  "actions": [
    { "type": "message", "content": "I'll create a resume for a Product Manager role..." },
    { "type": "tool", "name": "generate_resume_preview", "input": { "jobDescription": "Product Manager - Lead product strategy, work with cross-functional teams, analyze market trends" } }
  ]
}

User: "create a routine for job searching every morning"
Response:
{
  "plan": "User wants a daily job search routine",
  "actions": [
    { "type": "message", "content": "I'll set up a routine to search for jobs every morning..." },
    { "type": "tool", "name": "create_routine", "input": { "title": "Morning Job Search", "description": "Search for new job postings daily", "schedule": "09:00", "frequency": "DAILY", "type": "SEARCH_JOBS" } }
  ]
}

RULES:
- Respond ONLY to the current message
- Don't combine multiple old requests
- Use conversation history ONLY to understand references (like "that job")
- Keep it simple and direct`;
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

    // MEMORY SEARCH DISABLED: Focusing on current conversation only
    // Past memory was causing confusion and timeouts - prioritizing immediate context instead
    let memoryContext = '';
    const isSimpleGreeting = /^(hi|hey|hello|sup|yo)$/i.test(message.trim());

    // Memory search can be re-enabled via ENABLE_MEMORY_SEARCH=true env var if needed
    const memorySearchEnabled = process.env.ENABLE_MEMORY_SEARCH === 'true';
    let memoryPromise = null;
    if (userId && !isSimpleGreeting && !fastMode && memorySearchEnabled) {
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
      // Increased timeout: 5000ms to account for pgvector query + network latency
      // Development: 1000ms for faster iteration but still allowing completion
      const MEMORY_TIMEOUT_MS = process.env.NODE_ENV === 'production' ? 5000 : 1000;

      try {
        memoryContext = await Promise.race([
          memoryPromise,
          new Promise((resolve) => setTimeout(() => {
            logger.warn({ timeout: MEMORY_TIMEOUT_MS, userId }, `Memory search timed out after ${MEMORY_TIMEOUT_MS}ms, proceeding without it`);
            resolve('');
          }, MEMORY_TIMEOUT_MS))
        ]);

        // Log successful memory retrieval
        if (memoryContext && isDev) {
          logger.debug({ userId, contextLength: memoryContext.length }, 'Memory context loaded successfully');
        }
      } catch (error) {
        logger.warn({ error: error.message, userId }, 'Memory search race failed, proceeding without it');
        memoryContext = '';
      }
    } else if (isSimpleGreeting) {
      logger.debug({ message }, 'Skipping memory search for simple greeting');
    } else if (!memorySearchEnabled) {
      logger.debug('Memory search disabled (focusing on current conversation)');
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

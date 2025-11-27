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
 * @param {Array} [toolSchemas] - Dynamic tool schemas from registry
 * @returns {string}
 */
function buildSystemPrompt(profileContext = '', memoryContext = '', toolSchemas = []) {
  const profileSection = profileContext
    ? `\n\nUSER PROFILE:\n${profileContext}\n`
    : '';

  const memorySection = memoryContext
    ? `\n\nRELEVANT PAST CONVERSATIONS:\n${memoryContext}\n`
    : '';

  // Build dynamic tool documentation from schemas
  const toolDocs = toolSchemas.map((tool, idx) => {
    const params = tool.function.parameters.properties || {};
    const required = tool.function.parameters.required || [];
    const paramList = Object.entries(params)
      .map(([name, schema]) => {
        const isRequired = required.includes(name);
        const typeInfo = schema.enum ? schema.enum.join('|') : schema.type;
        return `     - ${name}${isRequired ? ' (required)' : ''}: ${schema.description || typeInfo}`;
      })
      .join('\n');

    return `${idx + 1}. ${tool.function.name}: ${tool.function.description}\n${paramList}`;
  }).join('\n\n');

  return `You are a helpful AI assistant for job searching and career management. You help users find jobs, create resumes, track applications, set goals, and automate their job search.${profileSection}${memorySection}

CONVERSATION HISTORY:
The messages below show recent conversation. Use them to understand context and references like "that job", "the resume", or "my goals".

YOUR CAPABILITIES - USE THESE TOOLS:
${toolDocs}

IMPORTANT GUIDELINES:
1. BE PROACTIVE: If user mentions wanting a job, offer to search. If they mention applications, offer to track them.
2. USE TOOLS: Don't just talk - take action! Use tools to actually help.
3. REMEMBER CONTEXT: Use conversation history to understand what "that job" or "the one you mentioned" refers to.
4. MANAGE GOALS: Help users set and track career goals. Suggest creating goals when appropriate.
5. SET UP ROUTINES: Offer to automate repetitive tasks (daily job searches, weekly summaries).
6. TRACK PROGRESS: Use track_applications to show application status when asked.

HOW TO RESPOND:
Return JSON with your plan and actions:
{
  "plan": "Brief explanation of what you're doing",
  "actions": [
    { "type": "message", "content": "Your message to the user" },
    { "type": "tool", "name": "tool_name", "input": { ... } }
  ]
}

EXAMPLES:

User: "find software engineer jobs in San Francisco"
{
  "plan": "Search for SE jobs in SF",
  "actions": [
    { "type": "message", "content": "Searching for Software Engineer positions in San Francisco..." },
    { "type": "tool", "name": "search_jobs", "input": { "role": "Software Engineer", "location": "San Francisco", "limit": 10 } }
  ]
}

User: "apply to that job" [after seeing job results]
{
  "plan": "User wants to apply to a job from results",
  "actions": [
    { "type": "message", "content": "I'll prepare the application for you..." },
    { "type": "tool", "name": "prepare_application_preview", "input": { "jobId": "[ID from context]" } }
  ]
}

User: "what are my goals?"
{
  "plan": "List user's goals",
  "actions": [
    { "type": "tool", "name": "list_goals", "input": { "limit": 10 } }
  ]
}

User: "set a goal to apply to 5 jobs this week"
{
  "plan": "Create application goal",
  "actions": [
    { "type": "message", "content": "I'll create that goal for you..." },
    { "type": "tool", "name": "create_goal", "input": { "title": "Apply to 5 jobs this week", "type": "JOB_SEARCH", "description": "Submit 5 job applications by end of week" } }
  ]
}

User: "set up a daily job search at 9am"
{
  "plan": "Create daily search routine",
  "actions": [
    { "type": "message", "content": "Setting up your daily job search routine..." },
    { "type": "tool", "name": "create_routine", "input": { "title": "Daily Job Search", "type": "SEARCH_JOBS", "frequency": "DAILY", "schedule": "09:00" } }
  ]
}

User: "show my routines"
{
  "plan": "List user's routines",
  "actions": [
    { "type": "tool", "name": "list_routines", "input": { "limit": 10 } }
  ]
}

User: "check my application status"
{
  "plan": "Show application tracking",
  "actions": [
    { "type": "tool", "name": "track_applications", "input": { "limit": 10 } }
  ]
}

RULES:
- ALWAYS use tools when the user asks for something actionable
- Be helpful and proactive - suggest next steps
- Reference conversation history for context
- Keep messages concise but friendly`;
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

    // MEMORY SEARCH: Enabled by default for conversation continuity
    // Can be disabled via DISABLE_MEMORY_SEARCH=true if causing issues
    let memoryContext = '';
    const isSimpleGreeting = /^(hi|hey|hello|sup|yo)$/i.test(message.trim());

    // Memory search is now enabled by default (opt-out instead of opt-in)
    const memorySearchEnabled = process.env.DISABLE_MEMORY_SEARCH !== 'true';
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
      logger.debug('Memory search disabled via DISABLE_MEMORY_SEARCH env var');
    }

    // Get all available tool schemas dynamically
    const toolSchemas = getToolSchemasForOpenAI();

    // Build system prompt with profile context, memory, and tool schemas
    const systemPrompt = buildSystemPrompt(profileContext, memoryContext, toolSchemas);

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

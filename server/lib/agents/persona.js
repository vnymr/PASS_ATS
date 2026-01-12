/**
 * LLM-first supervised persona that plans actions and emits structured JSON
 * Uses Gemini as PRIMARY, OpenAI as FALLBACK
 * Production-ready with retry logic, error handling, and graceful degradation
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { getToolSchemasForOpenAI } from './tool-registry.js';
import { getSearchDefaults } from './profile-manager.js';
import { searchRelevantSummaries } from '../memory/summary-store.js';
import { generateEmbedding } from '../memory/embedding-utils.js';
import { config } from '../config.js';
import logger from '../logger.js';

// Initialize AI clients
let gemini = null;
let openai = null;

// Lazy initialization to avoid startup errors
function initializeClients() {
  if (!gemini && config.gemini.apiKey) {
    gemini = new GoogleGenerativeAI(config.gemini.apiKey);
    logger.info('Gemini AI initialized for persona (PRIMARY)');
  }

  if (!openai && config.openai.apiKey) {
    openai = new OpenAI({ apiKey: config.openai.apiKey });
    logger.info('OpenAI initialized for persona (FALLBACK)');
  }
}

// Initialize on module load
initializeClients();

/**
 * Retry with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum retry attempts
 * @param {string} operationName - Name for logging
 * @returns {Promise<any>}
 */
async function retryWithBackoff(fn, maxRetries = 3, operationName = 'operation') {
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      const isRetryable =
        error.code === 429 || // Rate limit
        error.code === 503 || // Service unavailable
        error.status === 429 ||
        error.status === 503 ||
        error.message?.includes('quota') ||
        error.message?.includes('temporarily') ||
        error.message?.includes('timeout') ||
        error.message?.includes('ECONNRESET');

      if (!isRetryable || attempt === maxRetries) {
        logger.error({
          error: error.message,
          code: error.code,
          status: error.status,
          attempt,
          maxRetries,
          operation: operationName
        }, `${operationName} failed (non-retryable or max retries)`);
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
      logger.warn({
        error: error.message,
        attempt,
        maxRetries,
        delay,
        operation: operationName
      }, `${operationName} failed, retrying in ${delay}ms`);

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

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
1. BE CONVERSATIONAL: Respond naturally to greetings, small talk, and questions. Be friendly and helpful.
2. BE PROACTIVE: If user mentions wanting a job, offer to search. If they mention applications, offer to track them.
3. USE TOOLS: When the user wants action, use tools to help. Don't just talk - take action!
4. REMEMBER CONTEXT: Use conversation history to understand what "that job" or "the one you mentioned" refers to.
5. MANAGE GOALS: Help users set and track career goals. Suggest creating goals when appropriate.
6. SET UP ROUTINES: Offer to automate repetitive tasks (daily job searches, weekly summaries).
7. TRACK PROGRESS: Use track_applications to show application status when asked.

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

User: "hi" or "hello" or "hey"
{
  "plan": "Greet the user warmly",
  "actions": [
    { "type": "message", "content": "Hey! How can I help you with your job search today? I can find jobs, create tailored resumes, or help you track applications." }
  ]
}

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

User: "thanks" or "thank you"
{
  "plan": "Acknowledge thanks",
  "actions": [
    { "type": "message", "content": "You're welcome! Let me know if you need anything else with your job search." }
  ]
}

RULES:
- ALWAYS respond to greetings and casual messages with friendly conversation
- Use tools when the user asks for something actionable
- Be helpful and proactive - suggest next steps
- Reference conversation history for context
- Keep messages concise but friendly
- ALWAYS return valid JSON`;
}

/**
 * Generate plan using Gemini
 * @param {Object} params
 * @returns {Promise<{plan: string, actions: Array}>}
 */
async function planWithGemini({ messages, systemPrompt, fastMode }) {
  if (!gemini) {
    throw new Error('Gemini client not initialized');
  }

  const model = gemini.getGenerativeModel({
    model: 'gemini-3-flash-preview',
    generationConfig: {
      temperature: 0.4, // Slightly higher for more natural responses
      maxOutputTokens: fastMode ? 500 : 1000,
      responseMimeType: 'application/json' // Force JSON output
    },
    systemInstruction: systemPrompt
  });

  // Build conversation for Gemini (alternating user/model roles)
  const geminiHistory = [];
  for (const msg of messages) {
    if (msg.role === 'user') {
      geminiHistory.push({ role: 'user', parts: [{ text: msg.content }] });
    } else if (msg.role === 'assistant') {
      geminiHistory.push({ role: 'model', parts: [{ text: msg.content }] });
    }
  }

  // Start chat with history (excluding the last user message)
  const chat = model.startChat({
    history: geminiHistory.slice(0, -1)
  });

  // Send the last user message
  const lastMessage = geminiHistory[geminiHistory.length - 1];
  const result = await chat.sendMessage(lastMessage.parts[0].text);
  const response = result.response;
  let text = response.text();

  // Clean markdown code blocks if present
  text = text.replace(/^```json?\n?/gm, '').replace(/\n?```$/gm, '').trim();

  // Parse JSON response
  const parsed = JSON.parse(text);

  if (!parsed.plan || !Array.isArray(parsed.actions)) {
    throw new Error('Invalid response structure from Gemini');
  }

  return parsed;
}

/**
 * Generate plan using OpenAI (fallback)
 * @param {Object} params
 * @returns {Promise<{plan: string, actions: Array}>}
 */
async function planWithOpenAI({ messages, systemPrompt, fastMode }) {
  if (!openai) {
    throw new Error('OpenAI client not initialized');
  }

  const openaiMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
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
            description: 'Brief reasoning explaining what you are doing'
          },
          actions: {
            type: 'array',
            description: 'List of actions to execute',
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['message', 'tool'],
                  description: 'Type of action'
                },
                content: {
                  type: 'string',
                  description: 'Message content (for message type)'
                },
                name: {
                  type: 'string',
                  description: 'Tool name (for tool type)'
                },
                input: {
                  type: 'object',
                  description: 'Tool parameters (for tool type)'
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

  const response = await openai.chat.completions.create({
    model: fastMode ? 'gpt-4o-mini' : 'gpt-4o-mini',
    messages: openaiMessages,
    tools: [planFunction],
    tool_choice: { type: 'function', function: { name: 'create_plan' } },
    temperature: 0.4,
    max_tokens: fastMode ? 500 : 1000
  });

  const toolCall = response.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    throw new Error('No function call in OpenAI response');
  }

  return JSON.parse(toolCall.function.arguments);
}

/**
 * Plan actions based on user message (LLM-first approach)
 * Uses Gemini as PRIMARY, OpenAI as FALLBACK
 *
 * @param {object} params
 * @param {string} params.message - User message
 * @param {object} [params.metadata] - Additional metadata
 * @param {Array} [params.conversation] - Conversation history
 * @param {object} [params.profile] - User profile with preferences
 * @param {string} [params.profileContext] - Formatted profile context string
 * @param {number} [params.userId] - User ID for loading relevant memories
 * @param {Function} [params.onStream] - Optional callback for streaming chunks
 * @param {boolean} [params.fastMode] - Use faster model for simple messages
 * @returns {Promise<{ plan: string, actions: Array<{ type: string, content?: string, name?: string, input?: object }> }>}
 */
export async function plan({ message, metadata = {}, conversation = [], profile = null, profileContext = '', userId = null, onStream = null, fastMode = false }) {
  const startTime = Date.now();

  try {
    logger.info({ message, hasProfile: !!profile, userId, fastMode }, 'Planning persona actions');

    // Ensure clients are initialized
    initializeClients();

    // Check if we have at least one AI provider
    if (!gemini && !openai) {
      throw new Error('No AI provider available. Configure GEMINI_API_KEY or OPENAI_API_KEY');
    }

    // MEMORY SEARCH: Load relevant past conversations
    let memoryContext = '';
    const isSimpleMessage = /^(hi|hey|hello|sup|yo|thanks|thank you|ok|okay|cool|nice|great)$/i.test(message.trim());
    const memorySearchEnabled = process.env.DISABLE_MEMORY_SEARCH !== 'true';

    if (userId && !isSimpleMessage && !fastMode && memorySearchEnabled) {
      try {
        const MEMORY_TIMEOUT_MS = process.env.NODE_ENV === 'production' ? 5000 : 2000;

        const memoryPromise = (async () => {
          const messageEmbedding = await generateEmbedding(message);
          const relevantSummaries = await searchRelevantSummaries({
            userId,
            queryEmbedding: messageEmbedding,
            limit: 3
          });

          if (relevantSummaries.length > 0) {
            return relevantSummaries
              .filter(s => s.distance < 0.5)
              .map((s, idx) => `${idx + 1}. ${s.summary.substring(0, 200)}`)
              .join('\n');
          }
          return '';
        })();

        memoryContext = await Promise.race([
          memoryPromise,
          new Promise(resolve => setTimeout(() => resolve(''), MEMORY_TIMEOUT_MS))
        ]);

        if (memoryContext && process.env.NODE_ENV === 'development') {
          logger.debug({ userId, contextLength: memoryContext.length }, 'Memory context loaded');
        }
      } catch (memoryError) {
        logger.warn({ error: memoryError.message }, 'Memory search failed (non-blocking)');
      }
    }

    // Get tool schemas for the prompt
    const toolSchemas = getToolSchemasForOpenAI();

    // Build system prompt
    const systemPrompt = buildSystemPrompt(profileContext, memoryContext, toolSchemas);

    // Build messages array
    const messages = [
      ...conversation.map(({ role, content }) => ({ role, content })),
      { role: 'user', content: message }
    ];

    let plannedActions = null;
    let provider = 'unknown';

    // TRY GEMINI FIRST (Primary)
    if (gemini) {
      try {
        provider = 'gemini';
        plannedActions = await retryWithBackoff(
          () => planWithGemini({ messages, systemPrompt, fastMode }),
          2,
          'Gemini planning'
        );
        logger.info({ provider, duration: Date.now() - startTime }, 'Planning completed with Gemini');
      } catch (geminiError) {
        logger.warn({
          error: geminiError.message,
          code: geminiError.code
        }, 'Gemini planning failed, trying OpenAI fallback');

        // Fall through to OpenAI
      }
    }

    // FALLBACK TO OPENAI
    if (!plannedActions && openai) {
      try {
        provider = 'openai';
        plannedActions = await retryWithBackoff(
          () => planWithOpenAI({ messages, systemPrompt, fastMode }),
          2,
          'OpenAI planning'
        );
        logger.info({ provider, duration: Date.now() - startTime }, 'Planning completed with OpenAI fallback');
      } catch (openaiError) {
        logger.error({
          error: openaiError.message,
          code: openaiError.code
        }, 'OpenAI fallback also failed');
        throw openaiError;
      }
    }

    if (!plannedActions) {
      throw new Error('All AI providers failed');
    }

    // Validate structure
    if (!plannedActions.plan || !Array.isArray(plannedActions.actions)) {
      throw new Error('Invalid action structure from AI');
    }

    // Check if AI returned UNKNOWN
    const hasUnknownAction = plannedActions.actions.some(action => action.type === 'UNKNOWN');
    if (hasUnknownAction) {
      logger.warn({ message }, 'AI returned UNKNOWN, applying fallback');
      return {
        plan: 'AI could not interpret confidently, fallback will be applied',
        actions: [
          {
            type: 'UNKNOWN',
            originalMessage: message,
            profile
          }
        ]
      };
    }

    logger.info({
      plan: plannedActions.plan,
      actionCount: plannedActions.actions.length,
      provider,
      duration: Date.now() - startTime
    }, 'Persona planning completed');

    return plannedActions;

  } catch (error) {
    const duration = Date.now() - startTime;

    // Log full error details
    logger.error({
      error: error.message,
      stack: error.stack,
      code: error.code,
      status: error.status,
      message,
      duration
    }, 'Persona planning failed');

    // Return helpful error message based on error type
    let fallbackContent = "I'm having trouble processing your request. Could you try rephrasing or asking something specific like 'find product manager jobs' or 'show my applications'?";

    if (error.message?.includes('API key') || error.code === 'invalid_api_key') {
      fallbackContent = "I'm having trouble connecting to my AI service. Please check the configuration.";
    } else if (error.message?.includes('quota') || error.code === 429) {
      fallbackContent = "I'm currently experiencing high demand. Please try again in a moment.";
    } else if (error.message?.includes('timeout')) {
      fallbackContent = "That took too long to process. Try a simpler request.";
    } else if (error.message?.includes('No AI provider')) {
      fallbackContent = "AI services are not configured. Please set up GEMINI_API_KEY or OPENAI_API_KEY.";
    }

    return {
      plan: `Error: ${error.message}`,
      actions: [
        {
          type: 'message',
          content: fallbackContent
        }
      ]
    };
  }
}

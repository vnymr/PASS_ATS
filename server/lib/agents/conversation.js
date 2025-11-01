/**
 * Conversation handler with persona-based planning and structured actions
 */

import { getConversation, appendMessage } from '../memory-store.js';
import { plan as personaPlan } from './persona.js';
import { execute as executeToolFromRegistry, handleUnknownAction } from './tool-registry.js';
import { getUserProfile, getProfileContext } from './profile-manager.js';
import { extractAndUpdateProfile, quickExtract } from './memory-extractor.js';
import { saveConversationSummary } from '../memory/summary-store.js';
import { generateEmbedding, createConversationSummary, generateSummaryId } from '../memory/embedding-utils.js';
import logger from '../logger.js';

/**
 * Handle incoming message and stream response using persona planning
 * @param {object} params
 * @param {string} params.conversationId
 * @param {string} params.userId
 * @param {string} params.message
 * @param {object} [params.metadata]
 * @returns {AsyncGenerator<string>} - Yields SSE-formatted event strings
 */
export async function* handleMessage({ conversationId, userId, message, metadata = {} }) {
  try {
    logger.info({ conversationId, userId, messageLength: message.length }, 'Handling message with persona');

    // Load user profile
    const profile = await getUserProfile(userId);
    const profileContext = getProfileContext(profile);

    logger.info({ userId, hasProfile: !!profile, profileContext: profileContext.substring(0, 100) }, 'Loaded user profile');

    // Get conversation history
    const history = await getConversation(conversationId);

    // Append user message to history
    await appendMessage(conversationId, { role: 'user', content: message });

    // Plan actions using persona with profile context and userId for memory
    const { plan, actions } = await personaPlan({
      message,
      metadata,
      conversation: history,
      profile,
      profileContext,
      userId
    });

    logger.info({ plan, actionCount: actions.length }, 'Persona generated plan');

    let assistantResponse = '';

    // Execute each action
    for (const action of actions) {
      if (action.type === 'message') {
        // Stream message content as text chunks
        const content = action.content || '';

        // Split into words for smoother streaming effect
        const words = content.split(' ');
        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          const chunk = i === 0 ? word : ' ' + word;

          yield JSON.stringify({
            type: 'text',
            content: chunk
          });
        }

        assistantResponse += content;

      } else if (action.type === 'tool') {
        // Execute tool via registry
        try {
          logger.info({ tool: action.name, input: action.input }, 'Executing tool action');

          // Build execution context
          const ctx = {
            userId,
            conversationId,
            metadata
          };

          // Execute tool with validation
          const result = await executeToolFromRegistry(action.name, action.input || {}, ctx);

          // Stream tool result as action event
          yield JSON.stringify({
            type: 'action',
            name: action.name,
            payload: result
          });

          // Add tool execution to assistant response for history
          const resultSummary = formatToolResult(action.name, result);
          assistantResponse += `\n${resultSummary}`;

        } catch (error) {
          logger.error({ error: error.message, tool: action.name }, 'Tool execution failed');

          // Stream error
          yield JSON.stringify({
            type: 'error',
            message: `Tool ${action.name} failed: ${error.message}`
          });

          assistantResponse += `\n[Error: ${error.message}]`;
        }
      } else if (action.type === 'UNKNOWN') {
        // LLM returned UNKNOWN, apply config-based fallback
        logger.info({ message }, 'Handling UNKNOWN action with fallback');

        const fallbackTool = handleUnknownAction(action.originalMessage || message, action.profile || profile);

        if (fallbackTool) {
          // Fallback generated a tool call
          try {
            logger.info({ tool: fallbackTool.name, input: fallbackTool.input }, 'Executing fallback tool');

            const ctx = {
              userId,
              conversationId,
              metadata
            };

            // Stream a message first
            const fallbackMessage = 'Let me search based on what I understand...';
            yield JSON.stringify({
              type: 'text',
              content: fallbackMessage
            });
            assistantResponse += fallbackMessage;

            // Execute the fallback tool
            const result = await executeToolFromRegistry(fallbackTool.name, fallbackTool.input, ctx);

            // Stream tool result
            yield JSON.stringify({
              type: 'action',
              name: fallbackTool.name,
              payload: result
            });

            const resultSummary = formatToolResult(fallbackTool.name, result);
            assistantResponse += `\n${resultSummary}`;

          } catch (error) {
            logger.error({ error: error.message }, 'Fallback tool execution failed');

            yield JSON.stringify({
              type: 'error',
              message: `Could not complete your request: ${error.message}`
            });

            assistantResponse += `\n[Error: ${error.message}]`;
          }
        } else {
          // Cannot infer, ask for clarification
          const clarificationMessage = 'I need more information. Could you specify what role or type of job you\'re looking for? For example: "find product manager jobs" or "show me software engineer roles".';

          yield JSON.stringify({
            type: 'text',
            content: clarificationMessage
          });

          assistantResponse += clarificationMessage;
        }
      }
    }

    // Append assistant response to history
    if (assistantResponse.trim()) {
      await appendMessage(conversationId, { role: 'assistant', content: assistantResponse.trim() });
    }

    // Send done event
    yield JSON.stringify({ type: 'done' });

    // Extract and update profile from conversation (async, don't wait)
    // Do this after streaming completes so we don't slow down the response
    setImmediate(async () => {
      try {
        // Quick pattern-based extraction first
        await quickExtract(userId, message, assistantResponse);

        // Full extraction every 3 messages for deeper understanding
        const updatedHistory = await getConversation(conversationId);
        if (updatedHistory.length >= 3 && updatedHistory.length % 3 === 0) {
          logger.info({ userId, conversationId, messageCount: updatedHistory.length }, 'Running full memory extraction');
          await extractAndUpdateProfile(userId, updatedHistory);
        }

        // Persist conversation summary to pgvector (fire-and-forget)
        // This happens after every turn to keep memory up-to-date
        try {
          const summary = createConversationSummary(updatedHistory);

          if (summary && summary.length >= 10) {
            // Generate embedding for the summary
            const summaryEmbedding = await generateEmbedding(summary);

            // Save to pgvector
            const summaryId = generateSummaryId(conversationId);
            await saveConversationSummary({
              id: summaryId,
              conversationId,
              userId,
              summary,
              embedding: summaryEmbedding,
              importance: 5 // Default importance
            });

            logger.info({ conversationId, userId, summaryLength: summary.length }, 'Saved conversation summary to pgvector');
          }
        } catch (summaryError) {
          // Don't block on summary errors
          logger.error({ error: summaryError.message, conversationId, userId }, 'Failed to save conversation summary (non-blocking)');
        }

      } catch (extractError) {
        logger.error({ error: extractError.message, userId }, 'Memory extraction failed (non-blocking)');
      }
    });

  } catch (error) {
    logger.error({ error: error.message, conversationId, userId }, 'Error in handleMessage');

    yield JSON.stringify({
      type: 'error',
      message: error.message || 'An internal error occurred'
    });
  }
}

/**
 * Format tool result for conversation history
 * @param {string} toolName
 * @param {object} result
 * @returns {string}
 */
function formatToolResult(toolName, result) {
  switch (toolName) {
    case 'search_jobs':
      const count = result.items?.length || 0;
      const total = result.paging?.total || 0;
      const role = result.role ? ` (${result.role})` : '';
      return `Found ${count} of ${total} jobs${role}`;

    case 'generate_resume_preview':
      return `Resume preview generated (ID: ${result.previewId})`;

    case 'prepare_application_preview':
      return `Application preview prepared (ID: ${result.previewId})`;

    case 'create_goal':
      return `Goal created: ${result.title} (ID: ${result.goalId})`;

    case 'update_goal':
      return `Goal updated (ID: ${result.goalId})`;

    case 'list_goals':
      const goalCount = result.goals?.length || 0;
      return `Listed ${goalCount} goals`;

    case 'submit_application':
      if (result.success) {
        return `Application submitted (ID: ${result.applicationId}, Status: ${result.status})`;
      } else {
        return `Application failed: ${result.message}`;
      }

    case 'track_applications':
      const appCount = result.applications?.length || 0;
      return `Tracked ${appCount} applications`;

    case 'create_routine':
      return `Routine created: ${result.title} (ID: ${result.routineId}, Next run: ${result.nextRun})`;

    case 'list_routines':
      const routineCount = result.routines?.length || 0;
      return `Listed ${routineCount} routine(s)`;

    case 'update_routine':
      return `Routine updated (ID: ${result.routineId})`;

    case 'delete_routine':
      return `Routine deleted (ID: ${result.routineId})`;

    default:
      return `Tool ${toolName} executed`;
  }
}

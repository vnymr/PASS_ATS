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
import { prisma } from '../prisma-client.js';
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
  const requestStartTime = Date.now();
  try {
    logger.info({ conversationId, userId, messageLength: message.length }, 'Handling message with persona');

    // IMMEDIATE FEEDBACK: Send thinking indicator right away (0ms perceived delay)
    yield JSON.stringify({
      type: 'thinking',
      content: ''
    });

    // Append user message to history immediately (non-blocking)
    const appendPromise = appendMessage(conversationId, { role: 'user', content: message });

    // PARALLEL EXECUTION: Load profile, history, and plan in parallel
    // Increased history limit to 20 messages for better context retention
    const profileLoadStart = Date.now();
    const [profile, history] = await Promise.all([
      getUserProfile(userId),
      getConversation(conversationId, 20)
    ]);
    const profileLoadDuration = Date.now() - profileLoadStart;

    const profileContext = getProfileContext(profile);
    const hasProfileData = profileContext !== 'No profile information yet';
    logger.info({
      userId,
      hasProfile: !!profile,
      hasProfileData,
      profileLoadMs: profileLoadDuration,
      profileSummary: hasProfileData ? profileContext.substring(0, 100) + '...' : 'Empty profile - user needs to complete profile'
    }, 'Loaded user profile');

    // Ensure user message append completed
    await appendPromise;

    // Fast path: Check if this is a simple message that doesn't need tools
    const isSimpleMessage = /^(hi|hey|hello|sup|yo|what can you do|help|thanks|thank you|okay|ok|cool|nice|great)$/i.test(message.trim());

    // Stream planning progress to frontend in real-time
    // The LLM will analyze conversation history and decide when to be proactive (like ChatGPT)
    let planningBuffer = '';
    const planningStartTime = Date.now();
    const { plan, actions } = await personaPlan({
      message,
      metadata,
      conversation: history, // Full history allows LLM to detect patterns naturally
      profile,
      profileContext,
      userId,
      fastMode: isSimpleMessage, // Enable fast mode for simple messages
      // Stream planning chunks to frontend as they arrive from OpenAI
      onStream: (chunk) => {
        planningBuffer += chunk;
        // Note: We collect chunks but don't send partial JSON to avoid breaking the frontend
        // The 'thinking' indicator already shows progress
      }
    });

    const planningTime = Date.now() - planningStartTime;
    logger.info({ planningTime, actionCount: actions.length }, 'Planning completed');

    logger.info({ plan, actionCount: actions.length }, 'Persona generated plan');

    let assistantResponse = '';

    // PARALLEL EXECUTION: Group consecutive tool actions for concurrent execution
    const actionGroups = groupActionsForParallelExecution(actions);

    logger.info({
      totalActions: actions.length,
      groupCount: actionGroups.length,
      parallelGroups: actionGroups.filter(g => g.length > 1).length
    }, 'Grouped actions for parallel execution');

    // Execute action groups (some sequential, some parallel)
    for (const group of actionGroups) {
      // Single action - execute normally
      if (group.length === 1) {
        const action = group[0];

        if (action.type === 'message') {
          // Stream message content as text chunks (token by token)
          const content = action.content || '';

          // Simulate token-by-token streaming for better UX
          // Split into words and stream progressively
          const words = content.split(' ');
          for (let i = 0; i < words.length; i++) {
            const chunk = i === 0 ? words[i] : ' ' + words[i];

            yield JSON.stringify({
              type: 'text',
              content: chunk
            });

            // Small delay between words to simulate natural typing and make streaming visible
            // This prevents chunks from arriving faster than React can render
            await new Promise(resolve => setTimeout(resolve, 30));
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

          // Execute tool with validation and track duration
          const toolStartTime = Date.now();
          const result = await executeToolFromRegistry(action.name, action.input || {}, ctx);
          const toolDuration = Date.now() - toolStartTime;

          logger.info({
            tool: action.name,
            durationMs: toolDuration,
            resultSize: JSON.stringify(result).length
          }, 'Tool executed successfully');

          // Stream tool result as action event
          yield JSON.stringify({
            type: 'action',
            name: action.name,
            payload: result
          });

          // Add tool execution to assistant response for history
          const resultSummary = formatToolResult(action.name, result);
          assistantResponse += `\n${resultSummary}`;

          // TOOL RESULT FEEDBACK LOOP (LLM-native approach):
          // For search_jobs, let the LLM analyze results and decide if adjustment is needed
          // PROTECTION: Only trigger feedback loop once to prevent infinite recursion
          const feedbackAttempted = metadata.feedbackAttempted || false;

          if (action.name === 'search_jobs' &&
              (result.items?.length === 0 || result.paging?.total === 0) &&
              !feedbackAttempted) {

            logger.info({
              tool: action.name,
              originalInput: action.input,
              resultCount: result.items?.length || 0
            }, 'Search returned 0 results, asking LLM to analyze and adjust (first attempt)');

            // Mark feedback as attempted to prevent recursion
            metadata.feedbackAttempted = true;

            // Ask the LLM to analyze the result and decide what to do
            const analysisPrompt = `The search returned 0 results. Original parameters: ${JSON.stringify(action.input)}. Should I try a broader search, or would the user prefer to know there are no matches right now?`;

            const followUpPlan = await personaPlan({
              message: analysisPrompt,
              metadata, // Pass metadata with feedbackAttempted flag
              conversation: [
                ...history,
                { role: 'user', content: message },
                { role: 'assistant', content: assistantResponse }
              ],
              profile,
              profileContext,
              userId,
              fastMode: false
            });

            logger.info({
              followUpActionCount: followUpPlan.actions.length,
              followUpPlan: followUpPlan.plan
            }, 'LLM decided on follow-up actions after analyzing 0 results');

            // Execute follow-up actions decided by the LLM
            // NOTE: If follow-up search also returns 0 results, we won't retry again
            for (const followUpAction of followUpPlan.actions) {
              if (followUpAction.type === 'message') {
                const content = followUpAction.content || '';
                const words = content.split(' ');

                for (let i = 0; i < words.length; i++) {
                  const chunk = i === 0 ? words[i] : ' ' + words[i];
                  yield JSON.stringify({
                    type: 'text',
                    content: chunk
                  });
                  await new Promise(resolve => setTimeout(resolve, 30));
                }

                assistantResponse += `\n${content}`;

              } else if (followUpAction.type === 'tool') {
                // Execute follow-up tool call (will NOT trigger another feedback loop)
                try {
                  const followUpResult = await executeToolFromRegistry(
                    followUpAction.name,
                    followUpAction.input || {},
                    ctx
                  );

                  yield JSON.stringify({
                    type: 'action',
                    name: followUpAction.name,
                    payload: followUpResult
                  });

                  const followUpSummary = formatToolResult(followUpAction.name, followUpResult);
                  assistantResponse += `\n${followUpSummary}`;

                  // Log if follow-up also returned 0 results (for monitoring)
                  if (followUpAction.name === 'search_jobs' &&
                      (followUpResult.items?.length === 0 || followUpResult.paging?.total === 0)) {
                    logger.warn({
                      originalInput: action.input,
                      followUpInput: followUpAction.input,
                      userId
                    }, 'Follow-up search also returned 0 results - no further retries');
                  }

                } catch (followUpError) {
                  logger.error({ error: followUpError.message, tool: followUpAction.name }, 'Follow-up tool execution failed');

                  yield JSON.stringify({
                    type: 'error',
                    message: `Follow-up search failed: ${followUpError.message}`
                  });

                  assistantResponse += `\n[Error: ${followUpError.message}]`;
                }
              }
            }
          } else if (action.name === 'search_jobs' &&
                     (result.items?.length === 0 || result.paging?.total === 0) &&
                     feedbackAttempted) {
            // Second 0-result search - just log it, don't retry again
            logger.info({
              tool: action.name,
              originalInput: action.input,
              feedbackAttempted: true
            }, 'Search returned 0 results but feedback already attempted - skipping retry');
          }

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

      // Multiple actions in group - execute tools in parallel
      } else if (group.length > 1 && group.every(a => a.type === 'tool')) {
        logger.info({
          toolCount: group.length,
          tools: group.map(a => a.name)
        }, 'Executing tools in parallel');

        const ctx = {
          userId,
          conversationId,
          metadata
        };

        // Execute all tools in parallel using Promise.all
        const startTime = Date.now();
        const toolPromises = group.map(async (action) => {
          try {
            const result = await executeToolFromRegistry(action.name, action.input || {}, ctx);
            return { success: true, action, result };
          } catch (error) {
            logger.error({ error: error.message, tool: action.name }, 'Parallel tool execution failed');
            return { success: false, action, error };
          }
        });

        const results = await Promise.all(toolPromises);
        const parallelTime = Date.now() - startTime;

        logger.info({
          toolCount: group.length,
          parallelTime,
          successCount: results.filter(r => r.success).length
        }, 'Parallel tool execution completed');

        // Stream all results
        for (const { success, action, result, error } of results) {
          if (success) {
            yield JSON.stringify({
              type: 'action',
              name: action.name,
              payload: result
            });

            const resultSummary = formatToolResult(action.name, result);
            assistantResponse += `\n${resultSummary}`;

            // Check if this search needs follow-up (0 results)
            if (action.name === 'search_jobs' && (result.items?.length === 0 || result.paging?.total === 0)) {
              logger.info({
                tool: action.name,
                originalInput: action.input
              }, 'Parallel search returned 0 results, may trigger follow-up');
              // Note: For simplicity in MVP, we don't trigger feedback loop for parallel searches
              // This can be added in future if needed
            }
          } else {
            yield JSON.stringify({
              type: 'error',
              message: `Tool ${action.name} failed: ${error.message}`
            });

            assistantResponse += `\n[Error: ${error.message}]`;
          }
        }
      }
    }

    // Send done event immediately (don't wait for database writes)
    yield JSON.stringify({ type: 'done' });

    // Append assistant response to history (async, non-blocking)
    if (assistantResponse.trim()) {
      appendMessage(conversationId, { role: 'assistant', content: assistantResponse.trim() })
        .catch(err => logger.error({ error: err.message, conversationId }, 'Failed to append assistant message (non-critical)'));
    }

    // NOTE: Conversations are now persistent until user explicitly clears them
    // Auto-delete was removed to preserve conversation history
    // Users can clear conversations via DELETE /api/conversations/:id endpoint

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

    // Log total request duration
    const totalDuration = Date.now() - requestStartTime;
    logger.info({
      conversationId,
      userId,
      totalDurationMs: totalDuration,
      planningTimeMs: planningTime,
      profileLoadMs: profileLoadDuration
    }, 'Request completed successfully');

  } catch (error) {
    const totalDuration = Date.now() - requestStartTime;
    logger.error({
      error: error.message,
      stack: error.stack,
      conversationId,
      userId,
      totalDurationMs: totalDuration
    }, 'Error in handleMessage');

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

      // Include detailed job information in conversation history for context
      if (count > 0) {
        const jobDetails = result.items.slice(0, 3).map((job, idx) => {
          return `\n${idx + 1}. ${job.title} at ${job.company} (ID: ${job.id})\n   Location: ${job.location}\n   ${job.snippet}`;
        }).join('');

        return `Found ${count} of ${total} jobs${role}:${jobDetails}${count > 3 ? '\n... and more' : ''}`;
      }
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

/**
 * Group actions for parallel execution
 * Groups consecutive tool actions together so they can be executed in parallel
 * Messages and other action types force a new group (must execute sequentially)
 *
 * @param {Array} actions - Array of actions from persona planning
 * @returns {Array<Array>} - Array of action groups
 *
 * Example:
 * Input: [message, tool, tool, message, tool]
 * Output: [[message], [tool, tool], [message], [tool]]
 */
function groupActionsForParallelExecution(actions) {
  const groups = [];
  let currentGroup = [];

  for (const action of actions) {
    // Tool actions can be grouped together for parallel execution
    if (action.type === 'tool') {
      currentGroup.push(action);
    } else {
      // Non-tool action (message, UNKNOWN, etc.) - flush current group and start new one
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [];
      }
      groups.push([action]); // Non-tool actions execute alone
    }
  }

  // Flush remaining tools
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Conversation summary storage and retrieval using pgvector
 */

import { embeddingsDb } from '../embeddings-db.js';
import logger from '../logger.js';

/**
 * Save or update a conversation summary with its embedding
 * @param {object} params
 * @param {string} params.id - Unique identifier for the summary
 * @param {string} params.conversationId - Conversation ID this summary belongs to
 * @param {number} params.userId - User ID
 * @param {string} params.summary - Text summary of the conversation
 * @param {number[]} params.embedding - Embedding vector (must be length 1536)
 * @param {number} [params.importance=5] - Importance score (1-10)
 * @returns {Promise<void>}
 */
export async function saveConversationSummary({
  id,
  conversationId,
  userId,
  summary,
  embedding,
  importance = 5
}) {
  try {
    // Validate inputs
    if (!id || typeof id !== 'string') {
      throw new Error('Summary ID must be a non-empty string');
    }
    if (!conversationId || typeof conversationId !== 'string') {
      throw new Error('Conversation ID must be a non-empty string');
    }
    if (!userId || typeof userId !== 'number') {
      throw new Error('User ID must be a number');
    }
    if (!summary || typeof summary !== 'string' || summary.length < 10) {
      throw new Error('Summary must be a string with at least 10 characters');
    }
    if (!Array.isArray(embedding) || embedding.length !== 1536) {
      throw new Error('Embedding must be an array of exactly 1536 numbers');
    }
    if (importance < 1 || importance > 10) {
      throw new Error('Importance must be between 1 and 10');
    }

    // Convert embedding array to pgvector format: '[1.0, 2.0, 3.0]'
    const embeddingString = `[${embedding.join(',')}]`;

    // Use parameterized query with ON CONFLICT to upsert
    await embeddingsDb`
      INSERT INTO conversation_summaries (
        id,
        conversation_id,
        user_id,
        summary,
        embedding,
        importance
      )
      VALUES (
        ${id},
        ${conversationId},
        ${userId},
        ${summary},
        ${embeddingString}::vector,
        ${importance}
      )
      ON CONFLICT (id) DO UPDATE SET
        summary = EXCLUDED.summary,
        embedding = EXCLUDED.embedding,
        importance = EXCLUDED.importance,
        updated_at = now()
    `;

    logger.info(
      {
        id,
        conversationId,
        userId,
        summaryLength: summary.length,
        importance
      },
      'Saved conversation summary'
    );

  } catch (error) {
    logger.error(
      {
        error: error.message,
        id,
        conversationId,
        userId
      },
      'Failed to save conversation summary'
    );
    throw error;
  }
}

/**
 * Search for relevant conversation summaries using vector similarity
 * @param {object} params
 * @param {number} params.userId - User ID to filter summaries
 * @param {number[]} params.queryEmbedding - Query embedding vector (must be length 1536)
 * @param {number} [params.limit=5] - Maximum number of results to return
 * @returns {Promise<Array<{id: string, conversationId: string, summary: string, importance: number, distance: number}>>}
 */
export async function searchRelevantSummaries({
  userId,
  queryEmbedding,
  limit = 5
}) {
  try {
    // Validate inputs
    if (!userId || typeof userId !== 'number') {
      throw new Error('User ID must be a number');
    }
    if (!Array.isArray(queryEmbedding) || queryEmbedding.length !== 1536) {
      throw new Error('Query embedding must be an array of exactly 1536 numbers');
    }
    if (limit < 1 || limit > 50) {
      throw new Error('Limit must be between 1 and 50');
    }

    // Convert embedding array to pgvector format: '[1.0, 2.0, 3.0]'
    const embeddingString = `[${queryEmbedding.join(',')}]`;

    // Use cosine distance operator <=> for similarity search
    // Lower distance = more similar
    const results = await embeddingsDb`
      SELECT
        id,
        conversation_id,
        summary,
        importance,
        (embedding <=> ${embeddingString}::vector) as distance,
        created_at
      FROM conversation_summaries
      WHERE user_id = ${userId}
      ORDER BY embedding <=> ${embeddingString}::vector
      LIMIT ${limit}
    `;

    logger.info(
      {
        userId,
        resultCount: results.length,
        limit
      },
      'Retrieved relevant conversation summaries'
    );

    return results.map(row => ({
      id: row.id,
      conversationId: row.conversation_id,
      summary: row.summary,
      importance: row.importance,
      distance: parseFloat(row.distance),
      createdAt: row.created_at
    }));

  } catch (error) {
    logger.error(
      {
        error: error.message,
        userId
      },
      'Failed to search conversation summaries'
    );
    throw error;
  }
}

/**
 * Get all summaries for a specific conversation
 * @param {string} conversationId
 * @returns {Promise<Array>}
 */
export async function getConversationSummaries(conversationId) {
  try {
    const results = await embeddingsDb`
      SELECT
        id,
        conversation_id,
        user_id,
        summary,
        importance,
        created_at,
        updated_at
      FROM conversation_summaries
      WHERE conversation_id = ${conversationId}
      ORDER BY created_at DESC
    `;

    return results;
  } catch (error) {
    logger.error(
      {
        error: error.message,
        conversationId
      },
      'Failed to get conversation summaries'
    );
    throw error;
  }
}

/**
 * Delete a conversation summary by ID
 * @param {string} id - Summary ID
 * @returns {Promise<void>}
 */
export async function deleteConversationSummary(id) {
  try {
    await embeddingsDb`
      DELETE FROM conversation_summaries
      WHERE id = ${id}
    `;

    logger.info({ id }, 'Deleted conversation summary');
  } catch (error) {
    logger.error(
      {
        error: error.message,
        id
      },
      'Failed to delete conversation summary'
    );
    throw error;
  }
}

/**
 * Delete all summaries for a user
 * @param {number} userId
 * @returns {Promise<void>}
 */
export async function deleteUserSummaries(userId) {
  try {
    const result = await embeddingsDb`
      DELETE FROM conversation_summaries
      WHERE user_id = ${userId}
    `;

    logger.info(
      {
        userId,
        deletedCount: result.count
      },
      'Deleted user conversation summaries'
    );
  } catch (error) {
    logger.error(
      {
        error: error.message,
        userId
      },
      'Failed to delete user summaries'
    );
    throw error;
  }
}

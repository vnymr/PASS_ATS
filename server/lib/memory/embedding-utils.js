/**
 * Utilities for generating embeddings for conversation summaries
 */

import OpenAI from 'openai';
import { config } from '../config.js';
import logger from '../logger.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generate embedding for a text string
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} - Embedding vector (1536 dimensions)
 */
export async function generateEmbedding(text) {
  try {
    if (!text || typeof text !== 'string') {
      throw new Error('Text must be a non-empty string');
    }

    // Truncate very long text to avoid API limits
    const truncatedText = text.substring(0, 8000);

    const response = await openai.embeddings.create({
      model: config.openai.embeddingModel,
      input: truncatedText
    });

    const embedding = response.data[0].embedding;

    if (!embedding || embedding.length !== 1536) {
      throw new Error(`Invalid embedding dimensions: ${embedding?.length}`);
    }

    return embedding;

  } catch (error) {
    logger.error(
      {
        error: error.message,
        textLength: text?.length
      },
      'Failed to generate embedding'
    );
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * @param {string[]} texts - Array of texts to embed
 * @returns {Promise<number[][]>} - Array of embedding vectors
 */
export async function generateEmbeddingsBatch(texts) {
  try {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new Error('Texts must be a non-empty array');
    }

    // Truncate very long texts
    const truncatedTexts = texts.map(text => text.substring(0, 8000));

    const response = await openai.embeddings.create({
      model: config.openai.embeddingModel,
      input: truncatedTexts
    });

    const embeddings = response.data.map(item => item.embedding);

    // Validate all embeddings
    for (const embedding of embeddings) {
      if (!embedding || embedding.length !== 1536) {
        throw new Error(`Invalid embedding dimensions: ${embedding?.length}`);
      }
    }

    return embeddings;

  } catch (error) {
    logger.error(
      {
        error: error.message,
        textCount: texts?.length
      },
      'Failed to generate embeddings batch'
    );
    throw error;
  }
}

/**
 * Create a conversational summary from a conversation history
 * @param {Array<{role: string, content: string}>} conversation - Conversation messages
 * @param {number} [maxLength=500] - Maximum summary length
 * @returns {string} - Summary text
 */
export function createConversationSummary(conversation, maxLength = 500) {
  if (!Array.isArray(conversation) || conversation.length === 0) {
    return '';
  }

  // Filter out system messages and take last N messages
  const recentMessages = conversation
    .filter(msg => msg.role === 'user' || msg.role === 'assistant')
    .slice(-10); // Last 10 messages

  if (recentMessages.length === 0) {
    return '';
  }

  // Build summary from messages
  const parts = [];

  for (const msg of recentMessages) {
    const prefix = msg.role === 'user' ? 'User:' : 'Assistant:';
    const content = msg.content.substring(0, 200).trim();
    parts.push(`${prefix} ${content}`);
  }

  const fullSummary = parts.join(' ');

  // Truncate to max length
  if (fullSummary.length > maxLength) {
    return fullSummary.substring(0, maxLength) + '...';
  }

  return fullSummary;
}

/**
 * Generate a unique ID for a conversation summary
 * @param {string} conversationId
 * @param {number} [timestamp=Date.now()] - Timestamp for uniqueness
 * @returns {string}
 */
export function generateSummaryId(conversationId, timestamp = Date.now()) {
  return `${conversationId}_${timestamp}`;
}

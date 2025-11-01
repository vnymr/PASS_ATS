/**
 * Persistent conversation storage using Prisma
 * Maintains conversation history with database persistence
 */

import { prisma } from './prisma-client.js';
import logger from './logger.js';

/**
 * Get conversation history with messages
 * @param {string} conversationId
 * @param {number} limit - Maximum number of messages to return (default: 10)
 * @returns {Promise<Array<{ role: string, content: string, timestamp: Date }>>}
 */
export async function getConversation(conversationId, limit = 10) {
  if (!conversationId) {
    return [];
  }

  try {
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        role: true,
        content: true,
        createdAt: true,
        metadata: true
      }
    });

    // Return in chronological order (oldest first)
    return messages.reverse().map(msg => ({
      role: msg.role.toLowerCase(),
      content: msg.content,
      timestamp: msg.createdAt,
      metadata: msg.metadata
    }));
  } catch (error) {
    logger.error({ error: error.message, conversationId }, 'Failed to get conversation');
    return [];
  }
}

/**
 * Append a message to conversation history
 * @param {string} conversationId
 * @param {{ role: 'user' | 'assistant' | 'system', content: string, metadata?: object, tokenCount?: number, cost?: number }} message
 * @returns {Promise<void>}
 */
export async function appendMessage(conversationId, message) {
  if (!conversationId) {
    throw new Error('conversationId is required');
  }

  if (!message.role || !message.content) {
    throw new Error('Message must have role and content');
  }

  try {
    // Normalize role to uppercase for enum
    const role = message.role.toUpperCase();
    if (!['USER', 'ASSISTANT', 'SYSTEM'].includes(role)) {
      throw new Error(`Invalid role: ${message.role}. Must be user, assistant, or system`);
    }

    // Create the message
    await prisma.message.create({
      data: {
        conversationId,
        role,
        content: message.content,
        metadata: message.metadata || null,
        tokenCount: message.tokenCount || null,
        cost: message.cost || null
      }
    });

    // Update conversation's lastMessageAt
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() }
    });

    logger.info({ conversationId, role }, 'Message appended to conversation');
  } catch (error) {
    logger.error({ error: error.message, conversationId }, 'Failed to append message');
    throw error;
  }
}

/**
 * Ensure conversationId exists or create a new one
 * @param {string} [conversationId]
 * @param {number} [userId] - Optional userId to associate with conversation
 * @param {string} [title] - Optional title for the conversation
 * @returns {Promise<string>} - existing or new conversationId
 */
export async function ensureConversationId(conversationId, userId = null, title = null) {
  try {
    // If conversationId provided, check if it exists
    if (conversationId) {
      const existing = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { id: true }
      });

      if (existing) {
        return conversationId;
      }
    }

    // Create new conversation
    const conversation = await prisma.conversation.create({
      data: {
        id: conversationId || undefined, // Let Prisma generate if not provided
        userId,
        title
      }
    });

    logger.info({ conversationId: conversation.id, userId }, 'New conversation created');
    return conversation.id;
  } catch (error) {
    logger.error({ error: error.message, conversationId }, 'Failed to ensure conversation');
    throw error;
  }
}

/**
 * Delete a conversation and all its messages (cascade)
 * @param {string} conversationId
 * @returns {Promise<void>}
 */
export async function deleteConversation(conversationId) {
  if (!conversationId) {
    return;
  }

  try {
    await prisma.conversation.delete({
      where: { id: conversationId }
    });

    logger.info({ conversationId }, 'Conversation deleted');
  } catch (error) {
    // Ignore not found errors
    if (error.code !== 'P2025') {
      logger.error({ error: error.message, conversationId }, 'Failed to delete conversation');
      throw error;
    }
  }
}

/**
 * Get all conversation IDs for a user
 * @param {number} userId
 * @returns {Promise<Array<{ id: string, title: string, lastMessageAt: Date }>>}
 */
export async function getUserConversations(userId) {
  if (!userId) {
    return [];
  }

  try {
    const conversations = await prisma.conversation.findMany({
      where: { userId },
      orderBy: { lastMessageAt: 'desc' },
      select: {
        id: true,
        title: true,
        lastMessageAt: true,
        createdAt: true
      }
    });

    return conversations;
  } catch (error) {
    logger.error({ error: error.message, userId }, 'Failed to get user conversations');
    return [];
  }
}

/**
 * Get all conversation IDs (for debugging)
 * @returns {Promise<Array<string>>}
 */
export async function getAllConversationIds() {
  try {
    const conversations = await prisma.conversation.findMany({
      select: { id: true }
    });

    return conversations.map(c => c.id);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get all conversation IDs');
    return [];
  }
}

/**
 * Clear all conversations (for testing - use with caution!)
 * @returns {Promise<void>}
 */
export async function clearAll() {
  try {
    await prisma.message.deleteMany({});
    await prisma.conversation.deleteMany({});
    logger.warn('All conversations and messages cleared');
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to clear all conversations');
    throw error;
  }
}

/**
 * Update conversation title
 * @param {string} conversationId
 * @param {string} title
 * @returns {Promise<void>}
 */
export async function updateConversationTitle(conversationId, title) {
  if (!conversationId || !title) {
    throw new Error('conversationId and title are required');
  }

  try {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { title }
    });

    logger.info({ conversationId, title }, 'Conversation title updated');
  } catch (error) {
    logger.error({ error: error.message, conversationId }, 'Failed to update conversation title');
    throw error;
  }
}

/**
 * Conversation management routes
 * Allows users to view, manage, and clear their conversation history
 */

import { Router } from 'express';
import { prisma } from '../lib/prisma-client.js';
import logger from '../lib/logger.js';

const router = Router();

/**
 * GET /api/conversations
 * List all conversations for the authenticated user
 */
router.get('/conversations', async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { limit = 50, offset = 0 } = req.query;

    const conversations = await prisma.conversation.findMany({
      where: { userId: parseInt(userId) },
      orderBy: { lastMessageAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
      select: {
        id: true,
        title: true,
        createdAt: true,
        lastMessageAt: true,
        _count: {
          select: { messages: true }
        }
      }
    });

    const total = await prisma.conversation.count({
      where: { userId: parseInt(userId) }
    });

    res.json({
      conversations: conversations.map(c => ({
        id: c.id,
        title: c.title || 'Untitled Conversation',
        createdAt: c.createdAt,
        lastMessageAt: c.lastMessageAt,
        messageCount: c._count.messages
      })),
      paging: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total
      }
    });

  } catch (error) {
    logger.error({ error: error.message, userId: req.userId }, 'Failed to list conversations');
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});

/**
 * GET /api/conversations/:id
 * Get a specific conversation with its messages
 */
router.get('/conversations/:id', async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    // Verify ownership
    const conversation = await prisma.conversation.findFirst({
      where: { id, userId: parseInt(userId) },
      select: {
        id: true,
        title: true,
        createdAt: true,
        lastMessageAt: true
      }
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Get messages
    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
      take: parseInt(limit),
      skip: parseInt(offset),
      select: {
        id: true,
        role: true,
        content: true,
        metadata: true,
        createdAt: true
      }
    });

    const totalMessages = await prisma.message.count({
      where: { conversationId: id }
    });

    res.json({
      conversation: {
        id: conversation.id,
        title: conversation.title || 'Untitled Conversation',
        createdAt: conversation.createdAt,
        lastMessageAt: conversation.lastMessageAt
      },
      messages: messages.map(m => ({
        id: m.id,
        role: m.role.toLowerCase(),
        content: m.content,
        metadata: m.metadata,
        createdAt: m.createdAt
      })),
      paging: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: totalMessages
      }
    });

  } catch (error) {
    logger.error({ error: error.message, conversationId: req.params.id }, 'Failed to get conversation');
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

/**
 * PATCH /api/conversations/:id
 * Update conversation (e.g., rename title)
 */
router.patch('/conversations/:id', async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const { title } = req.body;

    // Verify ownership
    const existing = await prisma.conversation.findFirst({
      where: { id, userId: parseInt(userId) }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const updated = await prisma.conversation.update({
      where: { id },
      data: { title },
      select: {
        id: true,
        title: true,
        updatedAt: true
      }
    });

    logger.info({ conversationId: id, userId, newTitle: title }, 'Conversation renamed');

    res.json({
      success: true,
      conversation: updated
    });

  } catch (error) {
    logger.error({ error: error.message, conversationId: req.params.id }, 'Failed to update conversation');
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

/**
 * DELETE /api/conversations/:id
 * Delete a specific conversation and all its messages
 */
router.delete('/conversations/:id', async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;

    // Verify ownership
    const existing = await prisma.conversation.findFirst({
      where: { id, userId: parseInt(userId) }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Delete conversation (messages cascade)
    await prisma.conversation.delete({
      where: { id }
    });

    logger.info({ conversationId: id, userId }, 'Conversation deleted');

    res.json({
      success: true,
      message: 'Conversation deleted successfully'
    });

  } catch (error) {
    logger.error({ error: error.message, conversationId: req.params.id }, 'Failed to delete conversation');
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

/**
 * DELETE /api/conversations
 * Clear all conversations for the authenticated user
 */
router.delete('/conversations', async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { confirm } = req.query;

    // Require confirmation to prevent accidental deletion
    if (confirm !== 'true') {
      return res.status(400).json({
        error: 'Confirmation required',
        message: 'Add ?confirm=true to delete all conversations'
      });
    }

    // Count conversations before deletion
    const count = await prisma.conversation.count({
      where: { userId: parseInt(userId) }
    });

    // Delete all user's conversations (messages cascade)
    await prisma.conversation.deleteMany({
      where: { userId: parseInt(userId) }
    });

    logger.info({ userId, deletedCount: count }, 'All conversations cleared');

    res.json({
      success: true,
      message: `Cleared ${count} conversation(s)`
    });

  } catch (error) {
    logger.error({ error: error.message, userId: req.userId }, 'Failed to clear conversations');
    res.status(500).json({ error: 'Failed to clear conversations' });
  }
});

export default router;

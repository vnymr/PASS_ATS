/**
 * Chat API with Server-Sent Events (SSE) streaming
 */

import express from 'express';
import { handleMessage } from '../lib/agents/conversation.js';
import { ensureConversationId } from '../lib/memory-store.js';
import { rateLimitMiddleware } from '../lib/rate-limiter.js';
import { validateBody, asyncHandler, createError } from '../lib/error-handler.js';
import logger from '../lib/logger.js';

const router = express.Router();

// Per-user rate limiter with database tracking
const chatLimiter = rateLimitMiddleware();

// Validation schema for chat messages
const chatMessageSchema = {
  message: {
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 5000
  },
  conversationId: {
    required: false,
    type: 'string'
  },
  metadata: {
    required: false,
    type: 'object'
  }
};

/**
 * POST /api/chat
 * Stream assistant responses via SSE
 */
router.post('/chat', chatLimiter, validateBody(chatMessageSchema), asyncHandler(async (req, res) => {
  // Extract validated data
  const { conversationId: rawConversationId, message, metadata } = req.body;

  // Get userId from authenticated request (set by authenticateToken middleware)
  // For MVP, we'll use IP as fallback if no auth
  const userId = req.userId || null;

  // Get or create conversationId (now async)
  const conversationId = await ensureConversationId(rawConversationId, userId);

  logger.info({ conversationId, userId, messageLength: message.length }, 'Chat request received');

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Track if client is still connected
  let isConnected = true;

  // Handle client disconnect
  req.on('close', () => {
    isConnected = false;
    logger.info({ conversationId, userId }, 'Client disconnected');
  });

  // Send initial connection confirmation
  res.write(`data: ${JSON.stringify({ type: 'connected', conversationId })}\n\n`);

  // Setup heartbeat interval
  const heartbeatInterval = setInterval(() => {
    if (!isConnected) {
      clearInterval(heartbeatInterval);
      return;
    }
    try {
      res.write(`event: ping\ndata: {}\n\n`);
    } catch (err) {
      clearInterval(heartbeatInterval);
      isConnected = false;
    }
  }, 10000); // 10 seconds

  try {
    // Stream response from conversation handler
    const messageStream = handleMessage({
      conversationId,
      userId,
      message: message.trim(),
      metadata: metadata || {}
    });

    let doneSent = false;

    for await (const event of messageStream) {
      if (!isConnected) {
        break;
      }

      // Send SSE event
      res.write(`data: ${event}\n\n`);

      // Check if this is an error or done event
      try {
        const parsed = JSON.parse(event);
        if (parsed.type === 'error' || parsed.type === 'done') {
          doneSent = true;
          break;
        }
      } catch {
        // Ignore parse errors, continue streaming
      }
    }

    // Send final done event if not already sent
    if (isConnected && !doneSent) {
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    }

  } catch (error) {
    logger.error({ error: error.message, conversationId, userId, stack: error.stack }, 'Chat stream error');

    if (isConnected) {
      const errorMessage = process.env.NODE_ENV === 'development'
        ? error.message
        : 'An internal error occurred. Please try again.';

      res.write(`data: ${JSON.stringify({
        type: 'error',
        message: errorMessage,
        code: error.code || 'INTERNAL_ERROR'
      })}\n\n`);
    }
  } finally {
    // Cleanup
    clearInterval(heartbeatInterval);

    // End the response
    if (isConnected) {
      res.end();
    }

    logger.info({ conversationId, userId }, 'Chat stream completed');
  }
}));

/**
 * GET /api/chat/health
 * Health check endpoint
 */
router.get('/chat/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'chat-api',
    timestamp: new Date().toISOString()
  });
});

export default router;

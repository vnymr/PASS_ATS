/**
 * Worker WebSocket Manager
 * Handles real-time communication with worker dashboard
 */

import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import logger from './logger.js';

const WORKER_JWT_SECRET = process.env.WORKER_JWT_SECRET || process.env.JWT_SECRET;

class WorkerWebSocketManager {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // workerId -> WebSocket connection
  }

  /**
   * Initialize WebSocket server
   * @param {http.Server} server - HTTP server instance
   */
  initialize(server) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws/worker'
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    logger.info('Worker WebSocket server initialized on /ws/worker');
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws, req) {
    // Extract token from query string
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');

    if (!token) {
      logger.warn('Worker WebSocket connection rejected: No token');
      ws.close(4001, 'No token provided');
      return;
    }

    try {
      const decoded = jwt.verify(token, WORKER_JWT_SECRET);
      const workerId = decoded.workerId;

      // Store connection
      this.clients.set(workerId, ws);
      logger.info({ workerId }, 'Worker WebSocket connected');

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'CONNECTED',
        workerId,
        message: 'Connected to worker WebSocket'
      }));

      // Handle incoming messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          this.handleMessage(workerId, message, ws);
        } catch (err) {
          logger.warn({ error: err.message }, 'Invalid WebSocket message');
        }
      });

      // Handle disconnect
      ws.on('close', () => {
        this.clients.delete(workerId);
        logger.info({ workerId }, 'Worker WebSocket disconnected');
      });

      // Handle errors
      ws.on('error', (error) => {
        logger.error({ workerId, error: error.message }, 'Worker WebSocket error');
        this.clients.delete(workerId);
      });

    } catch (err) {
      logger.warn({ error: err.message }, 'Worker WebSocket auth failed');
      ws.close(4003, 'Invalid token');
    }
  }

  /**
   * Handle incoming message from worker
   */
  handleMessage(workerId, message, ws) {
    switch (message.type) {
      case 'PING':
        ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
        break;

      case 'HEARTBEAT':
        ws.send(JSON.stringify({ type: 'HEARTBEAT_ACK', timestamp: Date.now() }));
        break;

      default:
        logger.debug({ workerId, type: message.type }, 'Unknown message type');
    }
  }

  /**
   * Send message to specific worker
   * @param {number} workerId - Worker ID
   * @param {object} data - Message data
   */
  emit(workerId, data) {
    const ws = this.clients.get(workerId);
    if (ws && ws.readyState === 1) { // WebSocket.OPEN
      ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  /**
   * Send message to all connected workers
   * @param {object} data - Message data
   */
  broadcast(data) {
    const message = JSON.stringify(data);
    this.clients.forEach((ws, workerId) => {
      if (ws.readyState === 1) {
        ws.send(message);
      }
    });
  }

  /**
   * Check if worker is connected
   * @param {number} workerId - Worker ID
   */
  isConnected(workerId) {
    const ws = this.clients.get(workerId);
    return ws && ws.readyState === 1;
  }

  /**
   * Get count of connected workers
   */
  getConnectedCount() {
    let count = 0;
    this.clients.forEach((ws) => {
      if (ws.readyState === 1) count++;
    });
    return count;
  }

  // ============================================
  // Status update methods for worker-submit-apply
  // ============================================

  /**
   * Notify worker that AI is starting to fill the form
   */
  notifyAiStarted(workerId, sessionId, jobInfo) {
    this.emit(workerId, {
      type: 'AI_STARTED',
      sessionId,
      status: 'AI_PROCESSING',
      message: 'AI is analyzing the form...',
      job: jobInfo
    });
  }

  /**
   * Notify worker of AI progress
   */
  notifyAiProgress(workerId, sessionId, message, progress = null) {
    this.emit(workerId, {
      type: 'AI_PROGRESS',
      sessionId,
      status: 'AI_PROCESSING',
      message,
      progress
    });
  }

  /**
   * Notify worker that form is ready for submit
   */
  notifyReadyForSubmit(workerId, sessionId, data = {}) {
    this.emit(workerId, {
      type: 'READY_FOR_SUBMIT',
      sessionId,
      status: 'READY_FOR_SUBMIT',
      message: '✅ Form filled! Click SUBMIT in the browser.',
      ...data
    });
  }

  /**
   * Notify worker of an error (but can still try manually)
   */
  notifyAiError(workerId, sessionId, error) {
    this.emit(workerId, {
      type: 'AI_ERROR',
      sessionId,
      status: 'READY_FOR_SUBMIT', // Still let worker try
      message: `⚠️ AI issue: ${error}. You can complete manually.`,
      error
    });
  }

  /**
   * Notify worker that session is complete
   */
  notifyComplete(workerId, sessionId, success) {
    this.emit(workerId, {
      type: 'SESSION_COMPLETE',
      sessionId,
      success,
      message: success ? '✅ Application submitted!' : '❌ Application failed'
    });
  }
}

// Singleton instance
export const workerWebSocket = new WorkerWebSocketManager();
export default workerWebSocket;

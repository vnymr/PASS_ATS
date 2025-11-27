/**
 * Gmail OAuth Routes
 *
 * Handles Gmail connection for email verification during auto-apply.
 */

import express from 'express';
import {
  getAuthUrl,
  getConnectionStatus,
  disconnectGmail
} from '../lib/gmail-oauth.js';
import {
  searchVerificationEmails,
  hasActiveGmailConnection
} from '../lib/email-verification-checker.js';

const router = express.Router();

/**
 * GET /api/gmail/auth-url
 * Get Gmail OAuth authorization URL
 */
router.get('/gmail/auth-url', async (req, res) => {
  try {
    const userId = req.userId;

    // Check if Gmail credentials are configured
    if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
      return res.status(503).json({
        error: 'Gmail integration not configured',
        message: 'Gmail OAuth credentials are not set up on this server'
      });
    }

    const authUrl = getAuthUrl(userId);

    res.json({
      success: true,
      authUrl,
      message: 'Redirect user to this URL to connect Gmail'
    });
  } catch (error) {
    console.error('[Gmail Routes] Error getting auth URL:', error);
    res.status(500).json({
      error: 'Failed to generate auth URL',
      message: error.message
    });
  }
});

// Note: /api/gmail/callback is handled in server.js without auth middleware

/**
 * GET /api/gmail/status
 * Get Gmail connection status for current user
 */
router.get('/gmail/status', async (req, res) => {
  try {
    const userId = req.userId;

    const status = await getConnectionStatus(userId);

    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    console.error('[Gmail Routes] Error getting status:', error);
    res.status(500).json({
      error: 'Failed to get Gmail status',
      message: error.message
    });
  }
});

/**
 * DELETE /api/gmail/disconnect
 * Disconnect Gmail from user account
 */
router.delete('/gmail/disconnect', async (req, res) => {
  try {
    const userId = req.userId;

    const result = await disconnectGmail(userId);

    console.log(`[Gmail Routes] Disconnected Gmail for user ${userId}`);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[Gmail Routes] Error disconnecting:', error);
    res.status(500).json({
      error: 'Failed to disconnect Gmail',
      message: error.message
    });
  }
});

/**
 * POST /api/gmail/test-verification
 * Test verification email search (for debugging)
 */
router.post('/gmail/test-verification', async (req, res) => {
  try {
    const userId = req.userId;
    const { maxAgeMinutes = 10, companyName = null } = req.body;

    // Check if Gmail is connected
    const isConnected = await hasActiveGmailConnection(userId);
    if (!isConnected) {
      return res.status(400).json({
        error: 'Gmail not connected',
        message: 'Please connect your Gmail account first'
      });
    }

    // Search for verification emails
    const result = await searchVerificationEmails(userId, {
      maxAgeMinutes,
      companyName
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[Gmail Routes] Test verification error:', error);
    res.status(500).json({
      error: 'Failed to search verification emails',
      message: error.message
    });
  }
});

/**
 * GET /api/gmail/configured
 * Check if Gmail integration is configured on server
 */
router.get('/gmail/configured', async (req, res) => {
  const configured = !!(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET);

  res.json({
    configured,
    message: configured
      ? 'Gmail integration is available'
      : 'Gmail integration is not configured on this server'
  });
});

export default router;

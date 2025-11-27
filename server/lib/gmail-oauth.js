/**
 * Gmail OAuth Service
 *
 * Handles Gmail OAuth2 authentication for email verification during auto-apply.
 * Privacy-first approach: only reads recent emails for verification codes.
 */

import { google } from 'googleapis';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Encryption key for storing tokens (should be set in environment)
const ENCRYPTION_KEY = process.env.GMAIL_ENCRYPTION_KEY || process.env.JWT_SECRET;
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

// Gmail OAuth scopes - minimal for reading emails
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email'
];

/**
 * Encrypt sensitive data before storing in database
 */
function encrypt(text) {
  if (!text) return null;

  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Return IV + AuthTag + Encrypted data
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt sensitive data from database
 */
function decrypt(encryptedData) {
  if (!encryptedData) return null;

  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Create OAuth2 client
 */
function createOAuth2Client() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const redirectUri = process.env.GMAIL_REDIRECT_URI || `${process.env.API_BASE_URL || 'http://localhost:3000'}/api/gmail/callback`;

  if (!clientId || !clientSecret) {
    throw new Error('Gmail OAuth credentials not configured. Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET.');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Generate OAuth authorization URL
 */
export function getAuthUrl(userId) {
  const oauth2Client = createOAuth2Client();

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GMAIL_SCOPES,
    prompt: 'consent', // Force to get refresh token
    state: JSON.stringify({ userId }) // Pass user ID through OAuth flow
  });

  return url;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code) {
  const oauth2Client = createOAuth2Client();

  const { tokens } = await oauth2Client.getToken(code);

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(tokens.expiry_date),
    scope: tokens.scope
  };
}

/**
 * Get user's Gmail address from token
 */
export async function getGmailAddress(accessToken) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();

  return data.email;
}

/**
 * Refresh access token if expired
 */
export async function refreshAccessToken(userId) {
  const connection = await prisma.gmailConnection.findUnique({
    where: { userId }
  });

  if (!connection) {
    throw new Error('No Gmail connection found for user');
  }

  const oauth2Client = createOAuth2Client();
  const refreshToken = decrypt(connection.refreshToken);

  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const { credentials } = await oauth2Client.refreshAccessToken();

  // Update stored tokens
  await prisma.gmailConnection.update({
    where: { userId },
    data: {
      accessToken: encrypt(credentials.access_token),
      expiresAt: new Date(credentials.expiry_date),
      updatedAt: new Date()
    }
  });

  return credentials.access_token;
}

/**
 * Get valid access token for user (refreshes if needed)
 */
export async function getValidAccessToken(userId) {
  const connection = await prisma.gmailConnection.findUnique({
    where: { userId }
  });

  if (!connection || !connection.isActive) {
    throw new Error('No active Gmail connection found');
  }

  // Check if token is expired or will expire in next 5 minutes
  const now = new Date();
  const expiresAt = new Date(connection.expiresAt);
  const bufferMs = 5 * 60 * 1000; // 5 minutes buffer

  if (expiresAt.getTime() - now.getTime() < bufferMs) {
    console.log('[Gmail OAuth] Token expired or expiring soon, refreshing...');
    return await refreshAccessToken(userId);
  }

  return decrypt(connection.accessToken);
}

/**
 * Save Gmail connection to database
 */
export async function saveGmailConnection(userId, tokens, email) {
  const existingConnection = await prisma.gmailConnection.findUnique({
    where: { userId }
  });

  const data = {
    email,
    accessToken: encrypt(tokens.accessToken),
    refreshToken: encrypt(tokens.refreshToken),
    expiresAt: tokens.expiresAt,
    scope: tokens.scope,
    isActive: true,
    updatedAt: new Date()
  };

  if (existingConnection) {
    return await prisma.gmailConnection.update({
      where: { userId },
      data
    });
  } else {
    return await prisma.gmailConnection.create({
      data: {
        ...data,
        userId
      }
    });
  }
}

/**
 * Get Gmail connection status for user
 */
export async function getConnectionStatus(userId) {
  const connection = await prisma.gmailConnection.findUnique({
    where: { userId },
    select: {
      email: true,
      isActive: true,
      lastUsed: true,
      createdAt: true
    }
  });

  if (!connection) {
    return { connected: false };
  }

  return {
    connected: true,
    email: connection.email,
    isActive: connection.isActive,
    lastUsed: connection.lastUsed,
    connectedAt: connection.createdAt
  };
}

/**
 * Disconnect Gmail from user account
 */
export async function disconnectGmail(userId) {
  const connection = await prisma.gmailConnection.findUnique({
    where: { userId }
  });

  if (!connection) {
    return { success: true, message: 'No connection to disconnect' };
  }

  // Revoke Google access
  try {
    const accessToken = decrypt(connection.accessToken);
    const oauth2Client = createOAuth2Client();
    await oauth2Client.revokeToken(accessToken);
  } catch (error) {
    console.warn('[Gmail OAuth] Could not revoke token:', error.message);
  }

  // Delete from database
  await prisma.gmailConnection.delete({
    where: { userId }
  });

  return { success: true, message: 'Gmail disconnected successfully' };
}

/**
 * Create Gmail API client for user
 */
export async function createGmailClient(userId) {
  const accessToken = await getValidAccessToken(userId);

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

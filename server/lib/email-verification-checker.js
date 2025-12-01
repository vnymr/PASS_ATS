/**
 * Email Verification Checker Service
 *
 * Checks Gmail for verification emails during auto-apply.
 * Privacy-first: Only searches recent emails, extracts codes, never stores content.
 */

import { createGmailClient } from './gmail-oauth.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Known job application senders and their domains
export const KNOWN_JOB_SENDERS = [
  // ATS Platforms (including mail subdomains)
  'greenhouse.io',
  'greenhouse-mail.io',  // Greenhouse verification emails
  'lever.co',
  'workday.com',
  'ashbyhq.com',
  'ashby-mail.io',  // Ashby verification emails
  'smartrecruiters.com',
  'icims.com',
  'jobvite.com',
  'taleo.net',
  'brassring.com',
  'ultipro.com',
  'successfactors.com',
  'myworkday.com',
  'phenom.com',
  'eightfold.ai',

  // Common job platforms
  'linkedin.com',
  'indeed.com',
  'glassdoor.com',
  'ziprecruiter.com',
  'dice.com',
  'monster.com',
  'careerbuilder.com',
  'hired.com',
  'angellist.com',
  'wellfound.com',

  // Company domains (common patterns)
  'noreply',
  'no-reply',
  'talent',
  'careers',
  'recruiting',
  'hr@',
  'jobs@',
  'apply@',
  'applications@'
];

// Patterns to identify verification emails
const VERIFICATION_SUBJECT_PATTERNS = [
  /verif/i,
  /confirm/i,
  /code/i,
  /OTP/i,
  /one.?time/i,
  /authentication/i,
  /security/i,
  /sign.?in/i,
  /login/i,
  /access/i,
  /complete.*application/i,
  /action.*required/i
];

// Patterns to extract verification codes from email content
const CODE_PATTERNS = [
  // 4-8 digit codes
  /\b(\d{4,8})\b/g,
  // Alphanumeric codes (common format: ABC-123 or ABC123)
  /\b([A-Z0-9]{6,10})\b/gi,
  // "Your code is: XXXXX" pattern
  /(?:code|pin|otp)[\s:]+([A-Z0-9]{4,10})/gi,
  // "Enter: XXXXX" pattern
  /(?:enter|use|input)[\s:]+([A-Z0-9]{4,10})/gi,
  // "Verification: XXXXX" pattern
  /(?:verification|confirmation)[\s:]+([A-Z0-9]{4,10})/gi
];

// Pattern to extract verification links
const LINK_PATTERNS = [
  /https?:\/\/[^\s<>"]+(?:verify|confirm|validate|activate|complete|auth)[^\s<>"]*/gi,
  /https?:\/\/[^\s<>"]+\?[^\s<>"]*(?:token|code|key)=[^\s<>"]*/gi
];

/**
 * Build Gmail search query for verification emails
 */
function buildSearchQuery(options = {}) {
  const {
    maxAgeMinutes = 10,
    fromDomains = KNOWN_JOB_SENDERS,
    additionalSenders = []
  } = options;

  // Build time filter
  const now = new Date();
  const cutoff = new Date(now.getTime() - maxAgeMinutes * 60 * 1000);
  const afterTimestamp = Math.floor(cutoff.getTime() / 1000);

  // Build sender filter
  const allSenders = [...fromDomains, ...additionalSenders];
  const senderFilter = allSenders
    .slice(0, 10) // Gmail has query limits
    .map(s => `from:${s}`)
    .join(' OR ');

  // Combine filters (removed is:unread to catch emails that may have been auto-read)
  return `after:${afterTimestamp} (${senderFilter})`;
}

/**
 * Extract verification code from email content
 */
export function extractVerificationCode(emailBody) {
  if (!emailBody) return null;

  // Clean HTML if present
  let plainText = emailBody
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Try each code pattern
  for (const pattern of CODE_PATTERNS) {
    const matches = plainText.match(pattern);
    if (matches && matches.length > 0) {
      // Extract the code from the match
      for (const match of matches) {
        // Clean and validate the code
        const code = match.replace(/[^A-Z0-9]/gi, '').trim();

        // Skip if too short/long or looks like a year
        if (code.length < 4 || code.length > 10) continue;
        if (/^(19|20)\d{2}$/.test(code)) continue; // Skip years
        if (/^\d+$/.test(code) && code.length < 4) continue; // Skip short numbers

        return code;
      }
    }
  }

  return null;
}

/**
 * Extract verification links from email content
 */
export function extractVerificationLinks(emailBody) {
  if (!emailBody) return [];

  const links = [];

  for (const pattern of LINK_PATTERNS) {
    const matches = emailBody.match(pattern);
    if (matches) {
      links.push(...matches);
    }
  }

  // Also extract from href attributes
  const hrefPattern = /href=["']([^"']*(?:verify|confirm|validate|activate|complete|auth)[^"']*)["']/gi;
  let match;
  while ((match = hrefPattern.exec(emailBody)) !== null) {
    if (match[1] && match[1].startsWith('http')) {
      links.push(match[1]);
    }
  }

  // Deduplicate and clean
  return [...new Set(links)].map(link => {
    // Decode HTML entities
    return link
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');
  });
}

/**
 * Check if email subject looks like a verification email
 */
function isVerificationEmail(subject) {
  if (!subject) return false;

  return VERIFICATION_SUBJECT_PATTERNS.some(pattern => pattern.test(subject));
}

/**
 * Get email body from Gmail message
 */
function getEmailBody(message) {
  const payload = message.payload;

  if (!payload) return null;

  // Check for plain text body
  if (payload.body && payload.body.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf8');
  }

  // Check parts for multipart messages
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf8');
      }
      if (part.mimeType === 'text/html' && part.body && part.body.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf8');
      }
      // Recursive check for nested parts
      if (part.parts) {
        for (const subPart of part.parts) {
          if (subPart.body && subPart.body.data) {
            return Buffer.from(subPart.body.data, 'base64').toString('utf8');
          }
        }
      }
    }
  }

  return null;
}

/**
 * Search for verification emails
 *
 * @param {number} userId - User ID
 * @param {object} options - Search options
 * @returns {Promise<object>} - Found verification data
 */
export async function searchVerificationEmails(userId, options = {}) {
  const {
    maxAgeMinutes = 10,
    companyName = null,
    jobTitle = null,
    maxEmails = 5
  } = options;

  console.log(`[Email Verification] Searching for user ${userId}, max age: ${maxAgeMinutes}min`);

  try {
    const gmail = await createGmailClient(userId);

    // Build search query
    const query = buildSearchQuery({
      maxAgeMinutes,
      additionalSenders: companyName ? [companyName.toLowerCase()] : []
    });

    console.log(`[Email Verification] Search query: ${query}`);

    // Search for emails
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: maxEmails
    });

    const messages = response.data.messages || [];
    console.log(`[Email Verification] Found ${messages.length} potential emails`);

    if (messages.length === 0) {
      return {
        found: false,
        message: 'No recent verification emails found'
      };
    }

    // Process each message
    const verificationResults = [];

    for (const msg of messages) {
      const fullMessage = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full'
      });

      // Extract headers
      const headers = fullMessage.data.payload?.headers || [];
      const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
      const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
      const date = headers.find(h => h.name.toLowerCase() === 'date')?.value || '';

      // Check if it looks like a verification email
      if (!isVerificationEmail(subject)) {
        continue;
      }

      // Get email body
      const body = getEmailBody(fullMessage.data);

      // Extract verification data
      const code = extractVerificationCode(body);
      const links = extractVerificationLinks(body);

      if (code || links.length > 0) {
        verificationResults.push({
          id: msg.id,
          subject,
          from,
          date,
          code,
          links,
          snippet: fullMessage.data.snippet // Short preview (no sensitive data)
        });
      }
    }

    // Update last used timestamp
    await prisma.gmailConnection.update({
      where: { userId },
      data: { lastUsed: new Date() }
    });

    if (verificationResults.length === 0) {
      return {
        found: false,
        message: 'Found emails but no verification codes/links detected'
      };
    }

    // Return the most recent verification
    const mostRecent = verificationResults[0];

    console.log(`[Email Verification] Found verification: code=${mostRecent.code}, links=${mostRecent.links.length}`);

    return {
      found: true,
      code: mostRecent.code,
      links: mostRecent.links,
      from: mostRecent.from,
      subject: mostRecent.subject,
      emailId: mostRecent.id
    };

  } catch (error) {
    console.error('[Email Verification] Error:', error);

    if (error.message?.includes('No active Gmail connection')) {
      return {
        found: false,
        error: 'Gmail not connected',
        needsConnection: true
      };
    }

    throw error;
  }
}

/**
 * Poll for verification email with retries
 *
 * @param {number} userId - User ID
 * @param {object} options - Polling options
 * @returns {Promise<object>} - Found verification data or timeout
 */
export async function pollForVerification(userId, options = {}) {
  const {
    maxWaitMs = 120000, // 2 minutes max
    pollIntervalMs = 10000, // Check every 10 seconds
    companyName = null,
    jobTitle = null
  } = options;

  const startTime = Date.now();
  let attempts = 0;

  console.log(`[Email Verification] Starting poll for user ${userId}, max wait: ${maxWaitMs}ms`);

  while (Date.now() - startTime < maxWaitMs) {
    attempts++;
    console.log(`[Email Verification] Poll attempt ${attempts}`);

    const result = await searchVerificationEmails(userId, {
      maxAgeMinutes: Math.ceil((Date.now() - startTime + 60000) / 60000), // Dynamic window
      companyName,
      jobTitle
    });

    if (result.found) {
      console.log(`[Email Verification] Found after ${attempts} attempts, ${Date.now() - startTime}ms`);
      return {
        ...result,
        attempts,
        duration: Date.now() - startTime
      };
    }

    if (result.needsConnection) {
      return result; // Don't retry if Gmail not connected
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  console.log(`[Email Verification] Timeout after ${attempts} attempts`);

  return {
    found: false,
    error: 'Timeout waiting for verification email',
    attempts,
    duration: Date.now() - startTime
  };
}

/**
 * Check if user has Gmail connected and active
 */
export async function hasActiveGmailConnection(userId) {
  const connection = await prisma.gmailConnection.findUnique({
    where: { userId },
    select: { isActive: true }
  });

  return connection?.isActive === true;
}

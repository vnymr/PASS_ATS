/**
 * BrowserUse Cloud API Client
 *
 * Interfaces with BrowserUse Cloud API to automate job applications
 * and record the actions for Playwright replay
 */

import logger from './logger.js';

class BrowserUseClient {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.BROWSERUSE_API_KEY;
    this.baseUrl = 'https://api.browser-use.com/v1';
    this.recordedActions = [];
  }

  /**
   * Create a browser session
   */
  async createSession(options = {}) {
    const response = await fetch(`${this.baseUrl}/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        headless: options.headless || false,
        recordActions: true
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create session: ${error}`);
    }

    const data = await response.json();
    return data.sessionId;
  }

  /**
   * Navigate to URL
   */
  async navigate(sessionId, url) {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/navigate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      throw new Error(`Failed to navigate: ${await response.text()}`);
    }

    return await response.json();
  }

  /**
   * Fill application form using AI
   */
  async fillApplication(sessionId, applicationData) {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/fill-form`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        formData: applicationData,
        instructions: [
          'Fill all required fields',
          'Use provided personal information',
          'Upload resume if file input exists',
          'Answer common screening questions'
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to fill form: ${await response.text()}`);
    }

    const result = await response.json();

    // Store recorded actions
    if (result.actions) {
      this.recordedActions = result.actions;
    }

    return result;
  }

  /**
   * Submit the form
   */
  async submit(sessionId) {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/submit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to submit: ${await response.text()}`);
    }

    return await response.json();
  }

  /**
   * Get recorded actions
   */
  async getActions(sessionId) {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/actions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get actions: ${await response.text()}`);
    }

    const data = await response.json();
    return data.actions || [];
  }

  /**
   * Close session
   */
  async closeSession(sessionId) {
    await fetch(`${this.baseUrl}/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });
  }

  /**
   * Apply to job (complete flow)
   */
  async applyToJob(jobUrl, applicationData, options = {}) {
    logger.info({ jobUrl }, 'Starting BrowserUse job application');

    try {
      // Create session
      const sessionId = await this.createSession(options);
      logger.info({ sessionId }, 'Browser session created');

      // Navigate to job
      await this.navigate(sessionId, jobUrl);
      logger.info('Navigated to job page');

      // Fill form
      const fillResult = await this.fillApplication(sessionId, applicationData);
      logger.info({ fields: fillResult.fieldsFilled }, 'Form filled');

      let confirmationId = null;
      let screenshot = null;

      // Submit if requested
      if (options.submit) {
        const submitResult = await this.submit(sessionId);
        confirmationId = submitResult.confirmationId;
        screenshot = submitResult.screenshot;
        logger.info({ confirmationId }, 'Application submitted');
      }

      // Get recorded actions
      const actions = await this.getActions(sessionId);
      logger.info({ actionCount: actions.length }, 'Actions recorded');

      // Close session
      await this.closeSession(sessionId);

      return {
        success: true,
        actions,
        confirmationId,
        screenshot,
        cost: 0.80
      };

    } catch (error) {
      logger.error({ error: error.message }, 'BrowserUse application failed');

      return {
        success: false,
        error: error.message,
        actions: [],
        cost: 0.80
      };
    }
  }
}

export default BrowserUseClient;

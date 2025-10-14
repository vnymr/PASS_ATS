// API client for communicating with the backend
console.log('🌐 HappyResumes - API Client script loading...');

// Prevent redeclaration if script is injected multiple times
if (typeof window.APIClient !== 'undefined') {
  console.log('🌐 API Client already loaded, skipping');
} else {

class APIClient {
  constructor() {
    this.baseURL = null;
    this.token = null;
    this.init();
  }

  async init() {
    // Check if chrome API is available
    if (typeof chrome === 'undefined' || !chrome.storage) {
      this.baseURL = CONFIG.API_BASE_URL;
      return;
    }

    try {
      // Check if extension context is still valid
      if (chrome.runtime?.id === undefined) {
        throw new Error('Extension context invalidated. Please reload the page.');
      }

      // Get stored configuration
      const stored = await chrome.storage.local.get(['apiBaseURL']);
      this.baseURL = stored.apiBaseURL || CONFIG.API_BASE_URL;

      // Get Clerk session token from chrome.storage
      await this.getClerkToken();
    } catch (error) {
      if (error.message && error.message.includes('Extension context invalidated')) {
        console.warn('⚠️ Extension was reloaded. Please refresh the page to continue.');
        throw error;
      }
      // For other errors, use fallback config
      this.baseURL = CONFIG.API_BASE_URL;
      throw error;
    }
  }

  async getClerkToken() {
    try {
      // Check if chrome.storage API is available
      if (typeof chrome === 'undefined' || !chrome.storage) {
        console.warn('Chrome storage API not available');
        this.token = null;
        return;
      }

      // Check if extension context is still valid
      if (chrome.runtime?.id === undefined) {
        throw new Error('Extension context invalidated. Please reload the page.');
      }

      // Read token from chrome.storage.local (set by service worker)
      const result = await chrome.storage.local.get(['clerk_session_token', 'clerk_token_expires_at']);

      const expiresAt = result.clerk_token_expires_at;

      if (result.clerk_session_token && (!expiresAt || Date.now() < expiresAt)) {
        console.log('✅ Clerk token found in chrome.storage');
        this.token = result.clerk_session_token;
      } else {
        if (result.clerk_session_token && expiresAt && Date.now() >= expiresAt) {
          console.log('ℹ️ Stored Clerk token expired, clearing from storage');
          await new Promise((resolve) => {
            chrome.storage.local.remove(['clerk_session_token', 'clerk_token_updated_at', 'clerk_token_expires_at', 'user_email'], () => resolve());
          });
        }
        console.log('❌ No Clerk token in chrome.storage. Please sign in at https://happyresumes.com');
        this.token = null;
      }
    } catch (error) {
      if (error.message && error.message.includes('Extension context invalidated')) {
        console.warn('⚠️ Extension was reloaded. Please refresh the page.');
        throw error;
      }
      console.error('Error getting Clerk token:', error);
      this.token = null;
    }
  }

  async request(endpoint, options = {}) {
    await this.init(); // Ensure we have latest config and token

    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const fetchOptions = {
      ...options,
      headers
    };

    try {
      const result = await this.performFetch(url, fetchOptions);

      // Handle authentication errors
      if (result.status === 401 || result.status === 403) {
        throw new Error('UNAUTHORIZED');
      }

      // Handle rate limiting
      if (result.status === 429) {
        throw new Error('RATE_LIMITED');
      }

      if (!result.ok) {
        const errorMessage =
          (typeof result.data === 'object' && result.data?.error) ? result.data.error :
          result.error || 'Request failed';
        throw new Error(errorMessage);
      }

      return result.data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  shouldProxyRequests() {
    return typeof chrome !== 'undefined' &&
           !!chrome.runtime &&
           typeof chrome.runtime.sendMessage === 'function' &&
           !!chrome.runtime.id;
  }

  async performFetch(url, options) {
    if (this.shouldProxyRequests()) {
      return this.proxyFetch(url, options);
    }

    return this.directFetch(url, options);
  }

  async directFetch(url, options) {
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type') || '';
    let data;

    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
      headers: Array.from(response.headers.entries())
    };
  }

  async proxyFetch(url, options) {
    const payload = {
      action: 'API_REQUEST',
      url,
      options: {
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body !== undefined ? options.body : null
      }
    };

    // Remove body for GET requests to avoid illegal fetch usage
    if (!payload.options.body || payload.options.method === 'GET') {
      delete payload.options.body;
    }

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(payload, (response) => {
        if (chrome.runtime.lastError) {
          const message = chrome.runtime.lastError.message || 'Extension messaging failed';

          // When the content script context reloads, fall back to direct fetch
          if (message.includes('Extension context invalidated')) {
            this.directFetch(url, options).then(resolve).catch(reject);
            return;
          }

          reject(new Error(message));
          return;
        }

        if (!response) {
          reject(new Error('No response from background script'));
          return;
        }

        resolve(response);
      });
    });
  }

  // Authentication
  async logout() {
    // Clear token from storage
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.remove(['clerk_session_token', 'clerk_token_updated_at']);
      }
    } catch (error) {
      console.error('Error clearing token:', error);
    }

    this.token = null;
  }

  // Job extraction
  async extractJob(textContent, url, pageTitle) {
    return this.request('/api/extract-job', {
      method: 'POST',
      body: JSON.stringify({
        textContent: textContent, // Send full content without truncation
        url,
        pageTitle
      })
    });
  }

  // Resume generation - matches server expectations
  async processJob(jobDescription, metadata = {}) {
    // Validate job description length
    if (!jobDescription || jobDescription.trim().length < 50) {
      throw new Error('Job description must be at least 50 characters');
    }

    console.log('🚀 Processing job with description length:', jobDescription.length);

    return this.request('/api/process-job', {
      method: 'POST',
      body: JSON.stringify({
        jobDescription: jobDescription.trim(),
        aiMode: 'gpt-5-mini',
        matchMode: 'standard',
        ...metadata
      })
    });
  }

  // Job status polling
  async getJobStatus(jobId) {
    return this.request(`/api/job/${jobId}/status`);
  }

  // Get job details
  async getJob(jobId) {
    return this.request(`/api/job/${jobId}`);
  }

  // Download resume
  async downloadResume(jobId) {
    await this.init();

    if (this.shouldProxyRequests()) {
      await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'DOWNLOAD_RESUME',
          jobId,
          token: this.token,
          baseURL: this.baseURL
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!response || !response.success) {
            reject(new Error(response?.error || 'Download failed'));
            return;
          }

          resolve();
        });
      });
      return;
    }

    const response = await fetch(`${this.baseURL}/api/job/${jobId}/download/pdf`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    if (!response.ok) {
      throw new Error('Download failed');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    // Trigger download using Chrome downloads API
    if (typeof chrome !== 'undefined' && chrome.downloads) {
      await chrome.downloads.download({
        url: url,
        filename: `resume_${jobId}.pdf`,
        saveAs: true
      });
    } else {
      // Fallback for environments without chrome.downloads
      const a = document.createElement('a');
      a.href = url;
      a.download = `resume_${jobId}.pdf`;
      a.click();
    }
  }

  // Get user's resumes
  async getResumes() {
    return this.request('/api/resumes');
  }

  // Get quota
  async getQuota() {
    return this.request('/api/quota');
  }

  // Get profile
  async getProfile() {
    return this.request('/api/profile');
  }

  // Update profile
  async updateProfile(profileData) {
    return this.request('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });
  }

  // Check if authenticated
  async isAuthenticated() {
    await this.init();

    if (!this.token) {
      console.log('❌ No token available');
      return false;
    }

    try {
      console.log('🔍 Checking authentication with API...');
      await this.getProfile();
      console.log('✅ Authentication successful');
      return true;
    } catch (error) {
      if (error.message === 'UNAUTHORIZED') {
        console.log('❌ Token invalid or expired');
        return false;
      }
      // Network error - assume still authenticated
      console.log('⚠️ Network error, assuming authenticated');
      return true;
    }
  }

  // Set API base URL
  async setBaseURL(url) {
    this.baseURL = url;
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({ apiBaseURL: url });
    }
  }
}

// Create singleton instance
const apiClient = new APIClient();
console.log('✅ API Client initialized');

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = apiClient;
} else {
  window.apiClient = apiClient;
}

} // End of redeclaration guard

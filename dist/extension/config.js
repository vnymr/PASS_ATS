// Configuration for PASS ATS Extension
const CONFIG = {
  // API endpoint - automatically switches between local and production
  API_URL: (() => {
    // Check if we're in development mode (local extension)
    if (chrome && chrome.runtime && chrome.runtime.id && 
        (chrome.runtime.id.includes('local') || 
         window.location.protocol === 'chrome-extension:')) {
      // For local development, try localhost first
      return 'http://localhost:3000';
    }
    // Production Railway URL
    return 'https://passats-production.up.railway.app';
  })(),
  
  // Timeouts
  REQUEST_TIMEOUT: 30000, // 30 seconds
  SSE_TIMEOUT: 300000, // 5 minutes for SSE
  
  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  
  // Storage keys
  STORAGE_KEYS: {
    AUTH_TOKEN: 'pass_ats_token',
    USER_PROFILE: 'pass_ats_profile',
    ONBOARDING_COMPLETE: 'pass_ats_onboarding'
  }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
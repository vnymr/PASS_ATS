// Configuration for the extension
console.log('⚙️ HappyResumes - Config loading...');

// Prevent redeclaration if script is injected multiple times
if (typeof window.CONFIG !== 'undefined') {
  console.log('⚙️ Config already loaded, skipping');
} else {

const CONFIG = {
  // API endpoint for backend communication - NO remote code execution
  // All extension logic is self-contained within this package
  // These URLs are only used for API data requests
  API_BASE_URL: 'https://api.happyresumes.com',

  // Frontend web app URL (where users sign in)
  WEB_APP_URL: 'https://happyresumes.com',

  // Polling configuration
  POLLING: {
    INITIAL_INTERVAL: 1000,      // 1 second
    MAX_INTERVAL: 5000,           // 5 seconds
    BACKOFF_INTERVALS: [1000, 2000, 3000, 5000, 5000],
    MAX_ATTEMPTS: 40,             // 2 minutes max
    TIMEOUT_MS: 120000            // 2 minutes
  },

  // Job detection
  DETECTION: {
    JOB_KEYWORDS: [
      'job description', 'about the role', 'responsibilities',
      'requirements', 'qualifications', 'what you\'ll do',
      'apply now', 'submit application', 'job details',
      'what we\'re looking for', 'about the job'
    ],
    MIN_KEYWORD_MATCHES: 3,
    APPLY_BUTTON_SELECTORS: [
      'button[class*="apply"]',
      'a[class*="apply"]',
      '[aria-label*="Apply"]',
      'button[aria-label*="apply"]',
      '[class*="apply-button"]'
    ]
  },

  // Content extraction
  EXTRACTION: {
    CONTENT_SELECTORS: [
      '[class*="description"]',
      '[class*="job-detail"]',
      '[class*="job-description"]',
      '[id*="job"]',
      '[data-testid*="job"]',
      'article',
      'main',
      '.description',
      '#job-details'
    ],
    MAX_CONTENT_LENGTH: Infinity, // No limit - send full job description
    CONTEXT_CHARS: 500
  },

  // UI
  UI: {
    FLOATING_BUTTON_POSITION: {
      bottom: '24px',
      right: '24px'
    },
    ANIMATION_DURATION: 300,
    TOAST_DURATION: 3000
  },

  // Rate limiting (client-side)
  RATE_LIMITS: {
    EXTRACTION_PER_MINUTE: 20,
    GENERATION_PER_MINUTE: 5
  }
};

// Export for both content scripts and service worker
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
} else {
  window.CONFIG = CONFIG;
}

console.log('✅ Config loaded successfully');

} // End of redeclaration guard

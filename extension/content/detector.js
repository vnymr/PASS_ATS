// Wait for activation signal from background script
console.log('🔍 HappyResumes - Detector loading...');

// Prevent redeclaration if script is injected multiple times
if (typeof window.extensionActivated !== 'undefined') {
  console.log('🔍 Detector already loaded, skipping');
} else {

let extensionActivated = false;

// Listen for shortcut activation
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'SHORTCUT_ACTIVATED') {
    console.log('🎯 Extension activated via shortcut on:', message.tabUrl);
    extensionActivated = true;

    // Start job detection immediately
    detectAndProcessJob();

    sendResponse({ success: true });
  }
  return true;
});

// Main detection function - only runs when activated
async function detectAndProcessJob() {
  console.log('🔍 Starting job detection...');

  const currentUrl = window.location.href;

  // Create detector instance
  const detector = new SmartJobDetector();

  // Try to detect job page
  const isJobPage = detector.isJobPage();

  if (isJobPage) {
    console.log('✅ Job page detected, starting extraction');

    // Notify UI to show loading state
    window.dispatchEvent(new CustomEvent('job-detected', {
      detail: { url: currentUrl, confidence: detector.confidence }
    }));

    // Start extraction automatically
    if (window.jobScraper) {
      const jobData = window.jobScraper.extractJobContent();

      // Send to UI for processing
      window.dispatchEvent(new CustomEvent('job-extracted', {
        detail: jobData
      }));
    }

  } else {
    console.log('❌ Not a job page, showing manual input option');

    // Show manual input UI
    window.dispatchEvent(new CustomEvent('show-manual-input', {
      detail: {
        message: 'No job detected on this page. You can paste a job description below:',
        url: currentUrl
      }
    }));
  }
}

// Smart Job Page Detector - Works on any job site
class SmartJobDetector {
  constructor() {
    this.jobKeywords = CONFIG.DETECTION.JOB_KEYWORDS;
    this.applyButtonSelectors = CONFIG.DETECTION.APPLY_BUTTON_SELECTORS;
    this.minKeywordMatches = CONFIG.DETECTION.MIN_KEYWORD_MATCHES;
    this.confidence = 0;
  }

  /**
   * Check if current page is a job posting
   * @returns {boolean}
   */
  isJobPage() {
    // Check 1: Fast URL pattern check for known sites
    if (this.isKnownJobSite()) {
      this.confidence = 1.0;
      console.log('✅ Job page detected (known site)', window.location.href);
      return true;
    }

    // Check 2: Content-based heuristic detection
    if (this.hasJobContent()) {
      this.confidence = 0.8;
      console.log('✅ Job page detected (heuristic match)', {
        url: window.location.href,
        confidence: this.confidence
      });
      return true;
    }

    return false;
  }

  /**
   * Check if URL matches known job site patterns
   * @returns {boolean}
   */
  isKnownJobSite() {
    const url = window.location.href.toLowerCase();
    const patterns = [
      /linkedin\.com\/jobs\/view/,
      /linkedin\.com\/jobs\/search-results.*currentjobid/,  // LinkedIn search with job selected
      /linkedin\.com\/jobs\/collections/,
      /linkedin\.com\/.*job.*picks/i,  // LinkedIn job picks page
      /indeed\.com\/viewjob/,
      /indeed\.com\/.*\/jobs/,
      /glassdoor\.com\/job-listing/,
      /glassdoor\.com\/Job\//,
      /monster\.com\/job-openings/,
      /ziprecruiter\.com\/jobs/,
      /careerbuilder\.com\/job\//,
      /simplyhired\.com\/job\//,
      /dice\.com\/jobs\/detail/,
      /stackoverflow\.com\/jobs\//,
      /greenhouse\.io\/.*\/jobs/,
      /lever\.co\/.*\/jobs/,
      /workday\.com\/.*\/job/,
      /jobs\.lever\.co/,
      /boards\.greenhouse\.io/
    ];

    const matched = patterns.some(pattern => pattern.test(url));
    console.log('🔍 URL pattern check:', { url, matched });
    return matched;
  }

  /**
   * Analyze page content for job posting indicators
   * @returns {boolean}
   */
  hasJobContent() {
    const pageText = this.getPageText();

    // Count keyword matches
    const keywordMatches = this.countKeywordMatches(pageText);

    // Check for apply button
    const hasApplyButton = this.hasApplyButton();

    // Check for job-related meta tags
    const hasJobMeta = this.hasJobMetadata();

    // Scoring system
    let score = 0;
    if (keywordMatches >= this.minKeywordMatches) score += 3;
    if (hasApplyButton) score += 2;
    if (hasJobMeta) score += 2;
    if (keywordMatches >= 5) score += 2; // Bonus for many keywords

    console.log('🔍 Job detection scoring:', {
      keywordMatches,
      hasApplyButton,
      hasJobMeta,
      totalScore: score,
      needed: 3
    });

    return score >= 3; // Need at least 3 points (lowered for LinkedIn sidebar)
  }

  /**
   * Get main page text content
   * @returns {string}
   */
  getPageText() {
    // Try to get main content area first
    const mainContent = document.querySelector('main, article, [role="main"]');
    const text = (mainContent || document.body).innerText.toLowerCase();
    return text.substring(0, 5000); // First 5000 chars
  }

  /**
   * Count how many job keywords appear in text
   * @param {string} text
   * @returns {number}
   */
  countKeywordMatches(text) {
    return this.jobKeywords.filter(keyword => text.includes(keyword)).length;
  }

  /**
   * Check if page has an apply button
   * @returns {boolean}
   */
  hasApplyButton() {
    for (const selector of this.applyButtonSelectors) {
      try {
        if (document.querySelector(selector)) {
          return true;
        }
      } catch (e) {
        // Invalid selector, skip
        continue;
      }
    }

    // Fallback: check button text content
    const buttons = document.querySelectorAll('button, a[role="button"]');
    for (const button of buttons) {
      const text = button.textContent.toLowerCase();
      if (text.includes('apply') || text.includes('submit application')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check for job-related metadata
   * @returns {boolean}
   */
  hasJobMetadata() {
    // Check meta tags
    const metaTypes = [
      'og:type',
      'og:title',
      'twitter:title',
      'article:tag'
    ];

    for (const type of metaTypes) {
      const meta = document.querySelector(`meta[property="${type}"], meta[name="${type}"]`);
      if (meta) {
        const content = meta.getAttribute('content')?.toLowerCase() || '';
        if (content.includes('job') || content.includes('career') || content.includes('position')) {
          return true;
        }
      }
    }

    // Check structured data (JSON-LD)
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        if (data['@type'] === 'JobPosting') {
          return true;
        }
      } catch (e) {
        continue;
      }
    }

    return false;
  }

  /**
   * Get confidence score
   * @returns {number}
   */
  getConfidence() {
    return this.confidence;
  }

  /**
   * Extract job metadata from page (if available)
   * @returns {Object|null}
   */
  extractMetadata() {
    // Try to extract from JSON-LD structured data
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        if (data['@type'] === 'JobPosting') {
          return {
            title: data.title,
            company: data.hiringOrganization?.name,
            location: data.jobLocation?.address?.addressLocality,
            description: data.description
          };
        }
      } catch (e) {
        continue;
      }
    }

    // Try to extract from meta tags
    const getMetaContent = (name) => {
      const meta = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
      return meta?.getAttribute('content');
    };

    const title = getMetaContent('og:title') || getMetaContent('twitter:title') || document.title;

    return title ? { title } : null;
  }
}

// Initialize detector when activated by keyboard shortcut
console.log('🔍 Quick Resume AI - Detector script loaded', {
  readyState: document.readyState,
  url: window.location.href
});

// Don't run anything automatically - only when activated via shortcut
// Extension is now activated only by keyboard shortcut (Alt+R or Cmd+Shift+R)

// Make detector available globally
window.SmartJobDetector = SmartJobDetector;
window.extensionActivated = extensionActivated;

console.log('✅ Detector loaded successfully');

} // End of redeclaration guard

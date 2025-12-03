// Content scraper - Extracts job information from page
console.log('📝 HappyResumes - Scraper loading...');

// Prevent redeclaration if script is injected multiple times
if (typeof window.JobScraper !== 'undefined') {
  console.log('📝 Scraper already loaded, skipping');
} else {

class JobScraper {
  constructor() {
    this.contentSelectors = CONFIG.EXTRACTION.CONTENT_SELECTORS;
    this.maxLength = CONFIG.EXTRACTION.MAX_CONTENT_LENGTH;
    this.contextChars = CONFIG.EXTRACTION.CONTEXT_CHARS;
  }

  /**
   * Extract job content from page
   * @returns {Object}
   */
  extractJobContent() {
    const content = this.findJobContent();
    const textContent = this.extractText(content);
    const metadata = this.extractBasicMetadata();

    return {
      textContent: textContent, // Send full content without truncation
      fullDescription: textContent, // Full job description for resume generation
      url: window.location.href,
      pageTitle: document.title,
      metadata
    };
  }

  /**
   * Find the main job content area
   * @returns {HTMLElement}
   */
  findJobContent() {
    // LinkedIn-specific selectors (try first)
    const linkedinSelectors = [
      '.jobs-description__content',
      '.jobs-box__html-content',
      '[class*="job-description"]',
      '[class*="jobs-description"]',
      'article[class*="jobs"]',
      '.jobs-details',
      '#job-details'
    ];

    // Try LinkedIn selectors first
    for (const selector of linkedinSelectors) {
      try {
        const element = document.querySelector(selector);
        if (element && element.innerText.length > 200) {
          console.log('📄 Found LinkedIn content using selector:', selector);
          return element;
        }
      } catch (e) {
        continue;
      }
    }

    // Try generic selectors
    for (const selector of this.contentSelectors) {
      try {
        const element = document.querySelector(selector);
        if (element && element.innerText.length > 200) {
          console.log('📄 Found content using selector:', selector);
          return element;
        }
      } catch (e) {
        continue;
      }
    }

    // Fallback: find largest text block
    console.log('⚠️ Using fallback: largest text block');
    return this.findLargestTextBlock();
  }

  /**
   * Find the element with the most text content
   * @returns {HTMLElement}
   */
  findLargestTextBlock() {
    let largestElement = document.body;
    let maxLength = 0;

    const candidates = document.querySelectorAll('div, section, article, main');
    for (const element of candidates) {
      const text = element.innerText || '';
      if (text.length > maxLength && text.length < 50000) {
        maxLength = text.length;
        largestElement = element;
      }
    }

    return largestElement;
  }

  /**
   * Extract clean text from element
   * @param {HTMLElement} element
   * @returns {string}
   */
  extractText(element) {
    let text = element.innerText || element.textContent || '';

    // Clean up whitespace
    text = text
      .replace(/\s+/g, ' ')           // Multiple spaces → single space
      .replace(/\n{3,}/g, '\n\n')     // Multiple newlines → double newline
      .trim();

    return text;
  }

  /**
   * Intelligently truncate text to fit within limits
   * Keep beginning and end context
   * @param {string} text
   * @returns {string}
   */
  truncateIntelligently(text) {
    if (text.length <= this.maxLength) {
      return text;
    }

    // Keep first portion and last portion
    const mainContent = text.substring(0, this.maxLength - this.contextChars);
    const endContext = text.substring(text.length - this.contextChars);

    return `${mainContent}\n\n...(content truncated)...\n\n${endContext}`;
  }

  /**
   * Extract basic metadata from page
   * @returns {Object}
   */
  extractBasicMetadata() {
    const metadata = {};

    // Try to extract job title
    metadata.title = this.extractJobTitle();

    // Try to extract company name
    metadata.company = this.extractCompanyName();

    // Try to extract location
    metadata.location = this.extractLocation();

    return metadata;
  }

  /**
   * Extract job title from page
   * @returns {string|null}
   */
  extractJobTitle() {
    // LinkedIn-specific selectors
    const linkedinTitleSelectors = [
      '.jobs-unified-top-card__job-title',
      '.job-details-jobs-unified-top-card__job-title',
      'h1[class*="job-title"]',
      'h2[class*="job-title"]',
      '.jobs-details-top-card__job-title'
    ];

    for (const selector of linkedinTitleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.innerText.trim()) {
        console.log('✅ Found job title via selector:', selector);
        return element.innerText.trim();
      }
    }

    // Check structured data
    const structuredData = this.getStructuredData();
    if (structuredData?.title) {
      return structuredData.title;
    }

    // Check meta tags
    const metaTitle = this.getMetaContent('og:title') ||
                      this.getMetaContent('twitter:title');
    if (metaTitle) {
      // Clean up LinkedIn meta titles (remove " - Company Name | LinkedIn")
      return metaTitle.split(' - ')[0].split(' | ')[0].trim();
    }

    // Check h1
    const h1 = document.querySelector('h1');
    if (h1) {
      return h1.innerText.trim();
    }

    // Fallback to page title
    return document.title.split(' - ')[0].split(' | ')[0].trim();
  }

  /**
   * Extract company name
   * @returns {string|null}
   */
  extractCompanyName() {
    // LinkedIn-specific selectors
    const linkedinCompanySelectors = [
      '.jobs-unified-top-card__company-name',
      '.job-details-jobs-unified-top-card__company-name',
      'a[class*="company-name"]',
      '.jobs-details-top-card__company-name',
      '[class*="job-details"] a[data-tracking-control-name*="company"]'
    ];

    for (const selector of linkedinCompanySelectors) {
      const element = document.querySelector(selector);
      if (element && element.innerText.trim()) {
        console.log('✅ Found company via selector:', selector);
        return element.innerText.trim();
      }
    }

    // Check structured data
    const structuredData = this.getStructuredData();
    if (structuredData?.hiringOrganization?.name) {
      return structuredData.hiringOrganization.name;
    }

    // Check meta tags
    const metaSite = this.getMetaContent('og:site_name');
    if (metaSite && metaSite !== 'LinkedIn') {
      return metaSite;
    }

    // Try to find company name in text
    const text = document.body.innerText;
    const companyMatch = text.match(/(?:Company|Employer|Organization):\s*([^\n]+)/i);
    if (companyMatch) {
      return companyMatch[1].trim();
    }

    return null;
  }

  /**
   * Extract location
   * @returns {string|null}
   */
  extractLocation() {
    // Check structured data
    const structuredData = this.getStructuredData();
    if (structuredData?.jobLocation?.address?.addressLocality) {
      return structuredData.jobLocation.address.addressLocality;
    }

    // Try to find location in text
    const text = document.body.innerText;
    const locationMatch = text.match(/(?:Location|City|Office):\s*([^\n]+)/i);
    if (locationMatch) {
      return locationMatch[1].trim();
    }

    return null;
  }

  /**
   * Get structured data (JSON-LD) from page
   * @returns {Object|null}
   */
  getStructuredData() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        if (data['@type'] === 'JobPosting') {
          return data;
        }
      } catch (e) {
        continue;
      }
    }
    return null;
  }

  /**
   * Get meta tag content
   * @param {string} name
   * @returns {string|null}
   */
  getMetaContent(name) {
    const meta = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
    return meta?.getAttribute('content');
  }
}

// Export for use by other scripts
console.log('📝 Quick Resume AI - Scraper script loaded');
window.jobScraper = new JobScraper();
console.log('✅ Job scraper initialized');

// Listen for auto-scrape-and-generate command from keyboard shortcut
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'auto-scrape-and-generate') {
    // Automatically scrape job posting
    const jobData = window.jobScraper.extractJobContent();

    if (jobData && jobData.fullDescription && jobData.fullDescription.length > 100) {
      // Show notification that generation started
      showNotification('🚀 Generating resume...', 'info');

      // Send to background for processing (optional, or handle directly)
      chrome.runtime.sendMessage({
        action: 'generate-resume',
        jobData: jobData
      });

      // Trigger API call directly from content script
      (async () => {
        try {
          const response = await apiClient.processJob(jobData.fullDescription, {
            jobTitle: jobData.metadata?.title || 'Position',
            company: jobData.metadata?.company || 'Company'
          });

          if (response.jobId) {
            showNotification('✅ Resume generation started! Check the extension popup for progress.', 'success');
          }
        } catch (error) {
          console.error('Auto-generate failed:', error);
          showNotification('❌ Failed to generate resume. Please try again.', 'error');
        }
      })();

      sendResponse({ success: true });
    } else {
      showNotification('❌ Could not find job description on this page', 'error');
      sendResponse({ success: false, error: 'No job description found' });
    }

    return true; // Keep message channel open
  }
});

// Toast notification helper
function showNotification(message, type) {
  // Create toast notification on page
  const toast = document.createElement('div');
  toast.className = `quick-resume-toast ${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 24px;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 999999;
    font-family: system-ui;
    font-size: 14px;
    max-width: 320px;
    animation: slideIn 0.3s ease-out;
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

console.log('✅ Scraper loaded successfully');

} // End of redeclaration guard

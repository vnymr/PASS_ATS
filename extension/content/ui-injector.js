// Only initialize when extension is activated
console.log('🎨 HappyResumes - UI Injector loading...');

// Prevent redeclaration if script is injected multiple times
if (typeof window.uiInitialized !== 'undefined') {
  console.log('🎨 UI Injector already loaded, skipping');
} else {

let uiInitialized = false;
let uiManager = null;

// Listen for job detection or manual input events
window.addEventListener('job-detected', (event) => {
  console.log('📝 Job detected event received:', event.detail);
  if (!uiInitialized) {
    initializeUI();
    uiInitialized = true;
  }

  // Show loading state and start extraction
  showShortcutActivationFeedback();
  setTimeout(() => {
    // Always use silent mode for keyboard shortcuts - no popup
    uiManager.setSilentMode(true);
    uiManager.handleJobExtraction(event.detail);
  }, 500);
});

window.addEventListener('job-extracted', (event) => {
  console.log('📦 Job extracted event received:', event.detail);
  if (!uiInitialized) {
    initializeUI();
    uiInitialized = true;
  }

  // Process the extracted job data
  uiManager.processExtractedJob(event.detail);
});

window.addEventListener('show-manual-input', (event) => {
  console.log('📝 Manual input event received:', event.detail);
  if (!uiInitialized) {
    initializeUI();
    uiInitialized = true;
  }

  // Show manual input form
  showShortcutActivationFeedback();
  setTimeout(() => {
    // Use silent mode for keyboard shortcuts - show toast instead of popup
    uiManager.setSilentMode(true);
    uiManager.showManualInputUI(event.detail.message);
  }, 500);
});

function initializeUI() {
  console.log('🎨 Initializing UI Manager...');
  uiManager = new UIManager();
  uiManager.init();
  window.uiManager = uiManager; // Make available globally for onclick handlers
}

function showShortcutActivationFeedback() {
  // Create quick flash animation
  const flash = document.createElement('div');
  flash.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 14px;
    font-weight: 600;
    z-index: 999999999;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease-out;
  `;
  flash.textContent = '⚡ Scanning for job...';

  document.body.appendChild(flash);

  // Remove after 2 seconds
  setTimeout(() => {
    flash.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => flash.remove(), 300);
  }, 2000);
}

// Add animations
if (!document.getElementById('quick-resume-animations')) {
  const style = document.createElement('style');
  style.id = 'quick-resume-animations';
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(400px);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

// UI Manager - Handles overlay states for resume generation
class UIManager {
  constructor() {
    this.overlay = null;
    this.currentState = 'idle'; // idle, extracting, preview, generating, success, error
    this.jobData = null;
    this.jobId = null;
    this.isSilent = false;
    this.silentRunActive = false;
    this.lastProgressSegment = null;
  }

  /**
   * Initialize - Set up UI manager
   */
  init() {
    console.log('🎨 UI Manager initialized');
    // No auto-initialization needed
  }

  setSilentMode(isSilent) {
    this.isSilent = !!isSilent;
    this.silentRunActive = !!isSilent;
    if (this.isSilent) {
      this.lastProgressSegment = null;
    }
  }

  exitSilentMode() {
    this.isSilent = false;
    this.silentRunActive = false;
    this.lastProgressSegment = null;
  }

  /**
   * Handle job extraction when job is detected
   */
  async handleJobExtraction(details) {
    console.log('🚀 Starting extraction flow...', details);

    try {
      if (this.isSilent) {
        this.showToast('Extracting job details...', 'info');
      } else {
        this.showExtractingState();
      }

      // Extract job content
      const scraper = window.jobScraper;
      const extractedContent = scraper.extractJobContent();

      console.log('📦 Extracted content:', {
        textLength: extractedContent.textContent.length,
        url: extractedContent.url,
        title: extractedContent.pageTitle,
        metadata: extractedContent.metadata
      });

      // Call API to extract structured job data
      const jobData = await apiClient.extractJob(
        extractedContent.textContent,
        extractedContent.url,
        extractedContent.pageTitle
      );

      // Merge scraped metadata with API-extracted data
      const enrichedJobData = {
        ...jobData,
        // Prefer scraped metadata if API didn't extract it
        jobTitle: jobData.jobTitle || extractedContent.metadata?.title,
        company: jobData.company || extractedContent.metadata?.company,
        location: jobData.location || extractedContent.metadata?.location,
        metadata: {
          ...extractedContent.metadata,
          ...jobData.metadata
        }
      };

      console.log('✅ Job data extracted:', enrichedJobData);
      await this.processExtractedJob(enrichedJobData);

    } catch (error) {
      console.error('❌ Failed to extract job:', error);

      // Handle extension context invalidation
      if (error.message && error.message.includes('Extension context invalidated')) {
        this.showToast('🔄 Extension was reloaded. Please refresh this page to continue.', 'error', 5000);
        return;
      }

      this.showError('Failed to extract job data: ' + error.message);
    }
  }

  /**
   * Process extracted job data
   */
  async processExtractedJob(jobData) {
    const normalizedJobData = {
      ...jobData,
      fullDescription: jobData.fullDescription ||
                       jobData.description ||
                       jobData.originalDescription ||
                       jobData.textContent ||
                       '',
      // Extract metadata fields to top level for easy access
      jobTitle: jobData.jobTitle || jobData.metadata?.title || jobData.title,
      company: jobData.company || jobData.metadata?.company,
      location: jobData.location || jobData.metadata?.location
    };

    this.jobData = normalizedJobData;

    // Always go directly to generation for keyboard shortcuts - no popup
    this.showToast('Generating tailored resume...', 'info');
    await this.startGeneration();
  }

  /**
   * Prepare interactive preview when not in silent mode
   */
  showJobPreview(jobData) {
    this.showPreviewState(jobData);
  }

  /**
   * Show manual input UI
   */
  showManualInputUI(message) {
    console.log('📝 Showing manual input UI');

    if (this.isSilent) {
      this.showToast(message || 'Could not auto-extract job. Open the extension popup to paste manually.', 'error');
      return;
    }

    this.currentState = 'manual';
    // Show toast instead of popup
    this.showToast('Please paste job description in the extension popup.', 'info');

    const overlay = this.overlay;
    overlay.innerHTML = `
      <div class="resume-modal">
        <div class="modal-header">
          <h2>Quick Resume AI</h2>
          <button class="close-btn" onclick="window.uiManager.closeOverlay()">×</button>
        </div>
        <div class="modal-body">
          <p>${message}</p>
          <textarea
            id="job-description-input"
            placeholder="Paste the complete job description here..."
            style="width: 100%; min-height: 200px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; resize: vertical;"
          ></textarea>
          <button
            id="generate-from-manual"
            style="margin-top: 16px; width: 100%; padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 6px; font-size: 16px; font-weight: 600; cursor: pointer;"
            onclick="window.uiManager.handleManualSubmit()"
          >
            Generate Resume
          </button>
        </div>
      </div>
    `;

    overlay.style.display = 'flex';
  }

  /**
   * Handle manual job description submission
   */
  async handleManualSubmit() {
    const textarea = document.getElementById('job-description-input');
    const jobDescription = textarea.value.trim();

    if (!jobDescription) {
      alert('Please paste a job description');
      return;
    }

    // Show extracting state
    if (this.isSilent) {
      this.showToast('Extracting job details...', 'info');
    } else {
      this.showExtractingState();
    }

    try {
      // Call API to extract structured job data
      const jobData = await apiClient.extractJob(
        jobDescription,
        window.location.href,
        document.title
      );

      console.log('✅ Job data extracted from manual input:', jobData);
      this.processExtractedJob(jobData);

    } catch (error) {
      console.error('❌ Failed to extract job from manual input:', error);
      this.showError('Failed to process job description: ' + error.message);
    }
  }

  /**
   * Handle generation trigger from popup
   */
  async handleGenerationTrigger() {
    console.log('🚀 Starting generation flow...');

    // Show extracting state
    if (this.isSilent) {
      this.showToast('Extracting job details...', 'info');
    } else {
      this.showExtractingState();
    }

    try {
      // Extract job content
      const scraper = window.jobScraper;
      const extractedContent = scraper.extractJobContent();

      console.log('📦 Extracted content:', {
        textLength: extractedContent.textContent.length,
        url: extractedContent.url,
        title: extractedContent.pageTitle
      });

      // Call API to extract structured job data
      const jobData = await apiClient.extractJob(
        extractedContent.textContent,
        extractedContent.url,
        extractedContent.pageTitle
      );

      console.log('✅ Job data extracted:', jobData);

      // Add full job description to jobData for resume generation
      // Priority: API-returned description > full text content > truncated content
      jobData.fullDescription = jobData.description ||
                               extractedContent.fullDescription ||
                               extractedContent.textContent;

      console.log('📝 Job data prepared:', {
        hasDescription: !!jobData.description,
        fullDescriptionLength: jobData.fullDescription?.length,
        jobTitle: jobData.jobTitle,
        company: jobData.company
      });

      // Show preview state
      this.jobData = jobData;
      this.showPreviewState(jobData);

    } catch (error) {
      console.error('❌ Extraction failed:', error);

      if (error.message === 'UNAUTHORIZED') {
        if (this.isSilent) {
          this.showToast('Please sign in via the extension popup to continue.', 'error');
          return;
        }
        // Show toast instead of popup
        this.showToast('Please log in through the extension popup first.', 'error');
      } else if (error.message === 'RATE_LIMITED') {
        if (this.isSilent) {
          this.showToast('Rate limit reached. Try again in a moment.', 'error');
          return;
        }
        // Show toast instead of popup
        this.showToast('Please wait a moment before trying again.', 'error');
      } else {
        if (this.isSilent) {
          this.showToast('Could not extract job. Open the extension popup to paste manually.', 'error');
          return;
        }
        // Show manual input fallback
        this.showManualInputState();
      }
    }
  }

  /**
   * Generic error handler for overlay flows
   */
  showError(message) {
    if (this.isSilent) {
      this.showToast(message, 'error');
      return;
    }

    // Show toast instead of popup
    this.showToast(message, 'error');
  }

  /**
   * Trigger generation from manual input (popup sends job data directly)
   */
  async handleManualGeneration(jobData) {
    this.jobData = jobData;
    await this.startGeneration();
  }

  /**
   * Show extracting state
   */
  showExtractingState() {
    if (this.isSilent) {
      this.currentState = 'extracting';
      this.showToast('Analyzing job posting...', 'info');
      return;
    }

    this.currentState = 'extracting';
    // Show toast instead of popup
    this.showToast('Analyzing job posting...', 'info');
  }

  /**
   * Show preview state with extracted job data
   */
  showPreviewState(jobData) {
    // Skip popup in silent mode - go directly to generation
    if (this.isSilent) {
      this.jobData = jobData;
      this.startGeneration();
      return;
    }

    this.currentState = 'preview';

    const skillsList = jobData.skills && jobData.skills.length > 0
      ? `<ul class="qrai-job-list">${jobData.skills.map(skill => `<li>${skill}</li>`).join('')}</ul>`
      : '<p class="qrai-job-value">None specified</p>';

    const requirementsList = jobData.keyRequirements && jobData.keyRequirements.length > 0
      ? `<ul class="qrai-job-list">${jobData.keyRequirements.map(req => `<li>${req}</li>`).join('')}</ul>`
      : '';

    // Show toast instead of popup
    this.showToast('Starting resume generation...', 'info');
  }

  /**
   * Start resume generation
   */
  async startGeneration() {
    if (!this.jobData) {
      console.error('No job data available');
      return;
    }

    this.currentState = 'generating';
    if (this.isSilent) {
      this.showToast('Starting resume generation...', 'info');
    } else {
      this.showGeneratingState();
    }

    try {
      // Prepare full job description
      const jobDescription = this.jobData.fullDescription ||
                            this.jobData.description ||
                            JSON.stringify(this.jobData);

      console.log('📤 Sending job to API:', {
        descriptionLength: jobDescription.length,
        jobTitle: this.jobData.jobTitle,
        company: this.jobData.company
      });

      // Call process-job API
      const result = await apiClient.processJob(jobDescription, {
        jobTitle: this.jobData.jobTitle,
        company: this.jobData.company
      });

      this.jobId = result.jobId;
      console.log('✅ Job started:', this.jobId);

      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
          action: 'START_JOB',
          jobId: this.jobId,
          token: apiClient.token,
          jobInfo: {
            company: this.jobData.company || 'Unknown',
            title: this.jobData.jobTitle || 'Position'
          }
        });
      }

      // Start polling
      this.startPolling();

    } catch (error) {
      console.error('❌ Generation failed:', error);

      // Handle extension context invalidation
      if (error.message && error.message.includes('Extension context invalidated')) {
        this.showToast('🔄 Extension was reloaded. Please refresh this page to continue.', 'error', 5000);
        return;
      }

      if (error.message === 'UNAUTHORIZED') {
        if (this.isSilent) {
          this.showToast('Please sign in via the extension popup to continue.', 'error');
          return;
        }
        // Show toast instead of popup
        this.showToast('Please log in through the extension popup first.', 'error');
      } else if (error.message === 'RATE_LIMITED') {
        if (this.isSilent) {
          this.showToast('Rate limit reached. Try again in a moment.', 'error');
          return;
        }
        // Show toast instead of popup
        this.showToast('Please wait a moment before generating another resume.', 'error');
      } else {
        if (this.isSilent) {
          this.showToast(error.message || 'Generation failed. Please try again.', 'error');
          // Keep silent mode - don't turn it off
        } else {
          // Show toast instead of popup
          this.showToast(error.message || 'Generation failed. Please try again.', 'error');
        }
      }
    }
  }

  /**
   * Show generating state
   */
  showGeneratingState(progress = 0) {
    if (this.isSilent) {
      const statusMessages = [
        'Analyzing job requirements...',
        'Tailoring your experience...',
        'Optimizing keywords...',
        'Formatting resume...',
        'Finalizing document...'
      ];

      const messageIndex = Math.floor(progress / 20);
      const message = statusMessages[Math.min(messageIndex, statusMessages.length - 1)];
      this.showToast(message, 'info');
      return;
    }

    // Show toast instead of popup
    const statusMessages = [
      'Analyzing job requirements...',
      'Tailoring your experience...',
      'Optimizing keywords...',
      'Formatting resume...',
      'Finalizing document...'
    ];

    const messageIndex = Math.floor(progress / 20);
    const message = statusMessages[Math.min(messageIndex, statusMessages.length - 1)];
    
    this.showToast(message, 'info');
  }

  /**
   * Start polling for job status
   */
  startPolling() {
    const poller = new JobPoller(
      this.jobId,
      (status) => this.handleStatusUpdate(status),
      (result) => this.handleGenerationComplete(result),
      (error) => this.handleGenerationError(error)
    );

    poller.start();
    this.currentPoller = poller;
  }

  /**
   * Handle status update from polling
   */
  handleStatusUpdate(status) {
    console.log('📊 Status update:', status);

    // Use actual progress from API (0-100)
    const progress = status.progress || 0;
    if (this.isSilent) {
      const segment = Math.floor(progress / 25);
      if (segment !== this.lastProgressSegment) {
        this.showGeneratingState(progress);
        this.lastProgressSegment = segment;
      }
    } else {
      this.showGeneratingState(progress);
    }
  }

  /**
   * Handle generation complete
   */
  handleGenerationComplete(result) {
    console.log('✅ Generation complete:', result);
    if (this.currentPoller) {
      this.currentPoller.stop();
      this.currentPoller = null;
    }

    if (this.isSilent) {
      // Completely silent - no UI feedback
    } else {
      this.showSuccessState();
    }
  }

  /**
   * Handle generation error
   */
  handleGenerationError(error) {
    console.error('❌ Generation error:', error);
    if (this.currentPoller) {
      this.currentPoller.stop();
      this.currentPoller = null;
    }

    if (this.isSilent) {
      // Show toast instead of popup
      this.showToast(typeof error === 'string' ? error : 'Generation failed. Please try again.', 'error');
    } else {
      // Show toast instead of popup
      this.showToast(typeof error === 'string' ? error : 'Generation failed. Please try again.', 'error');
    }
  }

  /**
   * Show success state
   */
  showSuccessState() {
    // Skip popup in silent mode - show toast instead
    if (this.isSilent) {
      this.showToast('Resume ready! Open the extension to download.', 'success');
      return;
    }

    this.currentState = 'success';
    // Show toast instead of popup
    this.showToast('Resume generated successfully! Check the extension popup to download.', 'success');
  }

  /**
   * Show error state
   */
  showErrorState(title, message, actions = []) {
    // Skip popup in silent mode - show toast instead
    if (this.isSilent) {
      this.showToast(`${title}: ${message}`, 'error');
      return;
    }

    this.currentState = 'error';
    // Show toast instead of popup
    this.showToast(message, 'error');

    // Store action handlers
    this.actionHandlers = actions.map(a => a.handler);
  }

  /**
   * Show manual input fallback
   */
  showManualInputState() {
    if (this.isSilent) {
      this.showToast('Could not extract job. Paste the description from the extension popup.', 'error');
      return;
    }

    this.currentState = 'manual';
    // Show toast instead of popup
    this.showToast('Could not extract job. Please use the extension popup to paste job description.', 'error');
  }

  /**
   * Generate from manual input
   */
  async generateFromManual() {
    const description = document.getElementById('qrai-manual-desc').value;
    const title = document.getElementById('qrai-manual-title').value;
    const company = document.getElementById('qrai-manual-company').value;

    if (!description || description.length < 100) {
      this.showToast('Please paste a full job description (at least 100 characters)', 'error');
      return;
    }

    // Set job data and start generation
    this.jobData = {
      fullDescription: description,
      description,
      jobTitle: title || 'Position',
      company: company || 'Company'
    };

    await this.startGeneration();
  }

  /**
   * Download resume
   */
  async downloadResume() {
    if (!this.jobId) {
      console.error('No job ID available');
      return;
    }

    try {
      await apiClient.downloadResume(this.jobId);
      this.showToast('Resume downloaded! 🎉', 'success');
      this.closeOverlay();
    } catch (error) {
      console.error('Download failed:', error);
      this.showToast('Download failed. Please try again.', 'error');
    }
  }

  /**
   * Create overlay
   */
  createOverlay(content) {
    if (this.isSilent) {
      return;
    }

    // Remove existing overlay
    if (this.overlay) {
      this.overlay.remove();
    }

    // Create new overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'qrai-overlay';
    this.overlay.innerHTML = `<div class="qrai-card">${content}</div>`;

    // Close on background click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.closeOverlay();
      }
    });

    document.body.appendChild(this.overlay);
  }

  /**
   * Close overlay
   */
  closeOverlay() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }

    // Stop polling if active
    if (this.currentPoller) {
      this.currentPoller.stop();
      this.currentPoller = null;
    }

    this.currentState = 'idle';
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    // Keep toast notifications - they're small and non-intrusive
    const toast = document.createElement('div');
    toast.className = `qrai-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, CONFIG.UI.TOAST_DURATION);
  }

  /**
   * Open extension popup
   */
  openExtensionPopup() {
    chrome.runtime.sendMessage({ action: 'openPopup' });
  }
}

// Job Poller Class
class JobPoller {
  constructor(jobId, onUpdate, onComplete, onError) {
    this.jobId = jobId;
    this.onUpdate = onUpdate;
    this.onComplete = onComplete;
    this.onError = onError;
    this.attempts = 0;
    this.maxAttempts = CONFIG.POLLING.MAX_ATTEMPTS;
    this.intervals = CONFIG.POLLING.BACKOFF_INTERVALS;
    this.stopped = false;
  }

  async start() {
    if (this.stopped) return;

    const interval = this.intervals[Math.min(this.attempts, this.intervals.length - 1)];

    try {
      const status = await apiClient.getJobStatus(this.jobId);

      this.onUpdate(status);

      if (status.status === 'COMPLETED') {
        this.onComplete(status);
        return;
      }

      if (status.status === 'FAILED') {
        this.onError(status.error || 'Generation failed');
        return;
      }

      this.attempts++;

      if (this.attempts >= this.maxAttempts) {
        this.onError('Generation timeout. Please check your history later.');
        return;
      }

      // Schedule next poll
      setTimeout(() => this.start(), interval);

    } catch (error) {
      console.error('Polling error:', error);
      this.onError('Network error. Please check your connection.');
    }
  }

  stop() {
    this.stopped = true;
  }
}

// Don't initialize automatically - wait for activation
console.log('🎨 Quick Resume AI - UI Manager script loaded');

// Make UIManager available globally for when it's needed
window.UIManager = UIManager;
window.uiInitialized = uiInitialized;
window.uiManager = uiManager;

console.log('✅ UI Injector loaded successfully');

} // End of redeclaration guard

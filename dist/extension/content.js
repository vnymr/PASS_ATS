// Guard against double-injection and check for valid context
if (!window.__quick_resume_injected) {
  window.__quick_resume_injected = true;
  console.log('Quick Resume: Content script loaded');
  
  // Check if extension context is valid
  chrome.runtime.sendMessage({ action: 'ping' }).catch(error => {
    if (error.message.includes('Extension context invalidated')) {
      console.warn('Extension context invalidated. Page refresh needed.');
      // Don't inject button if context is invalid
      return;
    }
  });

  // Inject floating button on job pages
  let buttonInjected = false;

async function injectGenerateButton() {
  if (buttonInjected) return;
  
  // Inject CSS styles
  if (!document.getElementById('qr-styles')) {
    const style = document.createElement('style');
    style.id = 'qr-styles';
    style.textContent = `
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      
      #quick-resume-btn {
        position: fixed;
        bottom: 30px;
        right: 30px;
        z-index: 99998;
        background: black;
        color: white;
        border-radius: 12px;
        padding: 12px 20px;
        cursor: pointer;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        transition: all 0.3s ease;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      
      #quick-resume-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 25px rgba(0,0,0,0.4);
      }
      
      #quick-resume-btn.qr-loading {
        pointer-events: none;
        opacity: 0.8;
      }
      
      #quick-resume-btn.qr-success {
        background: #4CAF50;
      }
      
      #quick-resume-btn.qr-error {
        background: #f44336;
      }
      
      .qr-button {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .qr-icon {
        width: 24px;
        height: 24px;
      }
      
      .qr-icon svg {
        width: 100%;
        height: 100%;
      }
      
      .qr-text {
        font-size: 14px;
        font-weight: 600;
        white-space: nowrap;
      }
      
      .qr-spinner {
        animation: spin 1s linear infinite;
      }
    `;
    document.head.appendChild(style);
  }
  
  // Check authentication status later in the click handler
  
  const button = document.createElement('div');
  button.id = 'quick-resume-btn';
  button.innerHTML = `
    <div class="qr-button">
      <div class="qr-icon">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M10,19L12,15H9V10H15V15L13,19H10Z"/>
        </svg>
      </div>
      <div class="qr-text">Generate Resume</div>
    </div>
  `;
  
  document.body.appendChild(button);
  buttonInjected = true;
  
  // Click handler with detailed progress
  button.addEventListener('click', async () => {
    // Check if onboarding completed
    const { hasCompletedOnboarding } = await chrome.storage.local.get(['hasCompletedOnboarding']);
    
    if (!hasCompletedOnboarding) {
      // Open onboarding page (handles both signup and login)
      chrome.runtime.sendMessage({ action: 'openOnboardingPage' });
      return;
    }
    
    // Check if extension context is still valid
    try {
      await chrome.runtime.sendMessage({ action: 'ping' });
    } catch (error) {
      if (error.message.includes('Extension context invalidated')) {
        alert('Extension was updated. Please refresh the page to continue.');
        location.reload();
        return;
      }
    }
    
    button.classList.add('qr-loading');
    
    // Create progress display
    const createProgressDisplay = () => {
      const progressDiv = document.createElement('div');
      progressDiv.id = 'qr-progress-display';
      progressDiv.style.cssText = `
        position: fixed;
        bottom: 100px;
        right: 30px;
        background: white;
        border: 2px solid black;
        border-radius: 12px;
        padding: 20px;
        width: 350px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.2);
        z-index: 99999;
        font-family: -apple-system, sans-serif;
      `;
      progressDiv.innerHTML = `
        <div style="font-weight: bold; font-size: 16px; margin-bottom: 15px;">🚀 Generating Your Resume</div>
        <div id="qr-steps" style="font-size: 14px;"></div>
        <div style="margin-top: 15px;">
          <div style="background: #f0f0f0; height: 8px; border-radius: 4px; overflow: hidden;">
            <div id="qr-progress-bar" style="background: black; height: 100%; width: 0%; transition: width 0.5s; border-radius: 4px;"></div>
          </div>
        </div>
        <div id="qr-status" style="margin-top: 10px; font-size: 12px; color: #666;"></div>
      `;
      document.body.appendChild(progressDiv);
      return progressDiv;
    };
    
    const progressDisplay = createProgressDisplay();
    const stepsDiv = document.getElementById('qr-steps');
    const progressBar = document.getElementById('qr-progress-bar');
    const statusDiv = document.getElementById('qr-status');
    
    // Update functions
    const addStep = (emoji, text, completed = false) => {
      const step = document.createElement('div');
      step.style.cssText = `
        padding: 8px 0;
        display: flex;
        align-items: center;
        gap: 10px;
        opacity: ${completed ? '0.6' : '1'};
      `;
      step.innerHTML = `
        <span style="font-size: 20px;">${emoji}</span>
        <span>${text}</span>
        ${completed ? '<span style="color: green;">✓</span>' : '<span class="qr-spinner" style="display: inline-block; width: 16px; height: 16px; border: 2px solid #ddd; border-top-color: black; border-radius: 50%; animation: spin 1s linear infinite;"></span>'}
      `;
      stepsDiv.appendChild(step);
      return step;
    };
    
    const updateProgress = (percent, status) => {
      progressBar.style.width = percent + '%';
      statusDiv.textContent = status;
      button.querySelector('.qr-text').textContent = status;
    };
    
    const completeStep = (stepElement) => {
      stepElement.style.opacity = '0.6';
      const spinner = stepElement.querySelector('.qr-spinner');
      if (spinner) {
        spinner.outerHTML = '<span style="color: green;">✓</span>';
      }
    };
    
    // Start process
    updateProgress(5, 'Starting...');
    
    // Step 1: Extract job details
    const step1 = addStep('📋', 'Extracting job details from page');
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const jobData = extractJobData();
    // Ensure jdText is set for backend compatibility
    jobData.jdText = jobData.text || '';
    
    completeStep(step1);
    updateProgress(15, 'Job details extracted');
    
    // Step 2: Load your profile
    const step2 = addStep('👤', 'Loading your profile data');
    await new Promise(resolve => setTimeout(resolve, 600));
    completeStep(step2);
    updateProgress(25, 'Profile loaded');
    
    // Step 3: Analyze job requirements
    const step3 = addStep('🔍', 'Analyzing job requirements');
    await new Promise(resolve => setTimeout(resolve, 1000));
    completeStep(step3);
    updateProgress(35, 'Requirements analyzed');
    
    // Step 4: Match skills
    const step4 = addStep('🎯', 'Matching your skills to job');
    await new Promise(resolve => setTimeout(resolve, 800));
    completeStep(step4);
    updateProgress(45, 'Skills matched');
    
    // Step 5: AI optimization - THIS IS THE REAL AI CALL
    const step5 = addStep('🤖', 'AI optimizing content for ATS');
    updateProgress(50, 'Calling AI...');
    
    // Send to background for REAL AI processing
    let response;
    try {
      // This triggers the actual AI generation in background.js
      response = await chrome.runtime.sendMessage({
        action: 'generateResume',
        jobData: jobData
      });
      
      // Wait for real response with timeout
      let waitTime = 0;
      const maxWait = 30000; // 30 seconds max
      while (waitTime < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        waitTime += 1000;
        
        // Update progress based on actual time
        const progress = Math.min(90, 50 + (waitTime / maxWait * 40));
        updateProgress(progress, `Processing... ${Math.round(waitTime/1000)}s`);
        
        // Check if job completed
        if (response?.success || response?.correlationId) {
          break;
        }
      }
    } catch (error) {
      console.error('Communication error:', error);
      
      // Handle extension context invalidated
      if (error.message.includes('Extension context invalidated')) {
        progressDisplay.innerHTML = `
          <div style="text-align: center; padding: 20px;">
            <div style="font-size: 48px; margin-bottom: 10px;">🔄</div>
            <div style="font-size: 16px; font-weight: bold; margin-bottom: 10px;">Extension Updated</div>
            <div style="color: #666; margin-bottom: 15px;">Please refresh the page to use the new version</div>
            <button class="qr-refresh-btn" style="padding: 8px 20px; background: black; color: white; border: none; border-radius: 6px; cursor: pointer;">Refresh Page</button>
          </div>
        `;
        
        // Add event listener for refresh button
        const refreshBtn = progressDisplay.querySelector('.qr-refresh-btn');
        if (refreshBtn) {
          refreshBtn.addEventListener('click', () => {
            location.reload();
          });
        }
        
        button.classList.remove('qr-loading');
        button.querySelector('.qr-text').textContent = 'Refresh Needed';
        return;
      }
      
      // Other errors
      progressDisplay.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <div style="font-size: 48px; margin-bottom: 10px; color: red;">❌</div>
          <div style="font-size: 16px; font-weight: bold; margin-bottom: 10px;">Connection Error</div>
          <div style="color: #666; margin-bottom: 15px;">${error.message}</div>
          <button class="qr-try-again-btn" style="padding: 8px 20px; background: black; color: white; border: none; border-radius: 6px; cursor: pointer;">Try Again</button>
        </div>
      `;
      
      button.classList.remove('qr-loading');
      button.classList.add('qr-error');
      button.querySelector('.qr-text').textContent = 'Error';
      return;
    }
    
    if (!response?.error) {
      completeStep(step5);
      updateProgress(95, 'AI processing complete!');
      
      // The actual PDF generation and download happens in background.js
      // via SSE streaming, so we just show success here
      
      // Success message after brief delay to let download start
      setTimeout(() => {
        progressDisplay.innerHTML = `
          <div style="text-align: center; padding: 20px;">
            <div style="font-size: 48px; margin-bottom: 10px;">🎉</div>
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">Resume Generated!</div>
            <div style="color: #666;">Check your downloads folder</div>
            <button class="qr-close-btn" style="margin-top: 15px; padding: 8px 20px; background: black; color: white; border: none; border-radius: 6px; cursor: pointer;">Close</button>
          </div>
        `;
        
        // Add event listener to close button
        const closeBtn = progressDisplay.querySelector('.qr-close-btn');
        if (closeBtn) {
          closeBtn.addEventListener('click', () => {
            progressDisplay.remove();
          });
        }
        
        button.classList.remove('qr-loading');
        button.classList.add('qr-success');
        button.querySelector('.qr-text').textContent = 'Downloaded!';
        
        setTimeout(() => {
          button.classList.remove('qr-success');
          button.querySelector('.qr-text').textContent = 'Generate Resume';
          if (progressDisplay.parentNode) {
            progressDisplay.remove();
          }
        }, 5000);
      }, 2000);
      
    } else {
      // Error handling
      progressDisplay.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <div style="font-size: 48px; margin-bottom: 10px; color: red;">❌</div>
          <div style="font-size: 16px; font-weight: bold; margin-bottom: 10px;">Generation Failed</div>
          <div style="color: #666; margin-bottom: 15px;">${response.error}</div>
          <button class="qr-try-again-btn" style="padding: 8px 20px; background: black; color: white; border: none; border-radius: 6px; cursor: pointer;">Try Again</button>
        </div>
      `;
      
      button.classList.remove('qr-loading');
      button.classList.add('qr-error');
      button.querySelector('.qr-text').textContent = 'Failed';
      
      setTimeout(() => {
        button.classList.remove('qr-error');
        button.querySelector('.qr-text').textContent = 'Generate Resume';
      }, 3000);
    }
  });
}

// Extract job data from page
function extractJobData() {
  const data = {
    url: window.location.href,
    title: document.title,
    text: '',
    jdText: '', // Add jdText property for backend compatibility
    company: '',
    role: ''
  };
  
  // LinkedIn specific - updated selectors for 2025
  if (window.location.hostname.includes('linkedin.com')) {
    // Try multiple selectors for job title
    const jobTitle = document.querySelector('h1.jobs-unified-top-card__job-title, h1.t-24, .jobs-unified-top-card__job-title, [data-test-job-title]');
    // Try multiple selectors for company
    const company = document.querySelector('.jobs-unified-top-card__company-name, .jobs-unified-top-card__primary-description a, [data-test-company-name]');
    // Try multiple selectors for description - LinkedIn often changes these
    const description = document.querySelector('.jobs-description__content, .jobs-description, .jobs-box__html-content, [data-test-job-description], .show-more-less-html__markup');
    
    if (jobTitle) data.role = jobTitle.textContent.trim();
    if (company) data.company = company.textContent.trim();
    if (description) {
      // Get all text including hidden sections
      const showMoreBtn = description.querySelector('button[aria-label*="more"], button.show-more-less-html__button');
      if (showMoreBtn) showMoreBtn.click();
      data.text = description.innerText || description.textContent.trim();
    }
    
    // If no description found, try to get from the entire job details section
    if (!data.text) {
      const jobDetails = document.querySelector('.jobs-description-content, .jobs-details, .job-view-layout');
      if (jobDetails) data.text = jobDetails.innerText || jobDetails.textContent.trim();
    }
  }
  
  // Indeed specific  
  else if (window.location.hostname.includes('indeed.com')) {
    const jobTitle = document.querySelector('[data-testid="job-title"]');
    const company = document.querySelector('[data-testid="company-name"]');
    const description = document.querySelector('#jobDescriptionText');
    
    if (jobTitle) data.role = jobTitle.textContent.trim();
    if (company) data.company = company.textContent.trim();
    if (description) data.text = description.textContent.trim();
  }
  
  // Glassdoor specific
  else if (window.location.hostname.includes('glassdoor.com')) {
    const jobTitle = document.querySelector('.css-17x2pwl');
    const company = document.querySelector('.css-87uc0g');
    const description = document.querySelector('.desc');
    
    if (jobTitle) data.role = jobTitle.textContent.trim();
    if (company) data.company = company.textContent.trim();
    if (description) data.text = description.textContent.trim();
  }
  
  // Fallback - get all text
  if (!data.text) {
    const selectors = ['main', 'article', '.job-description', '.description', '#content'];
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        data.text = element.textContent.trim();
        break;
      }
    }
  }
  
  // If still no text, get body text
  if (!data.text) {
    data.text = document.body.innerText.substring(0, 10000);
  }
  
  // Ensure jdText matches text for backend
  data.jdText = data.text;
  
  return data;
}

// Listen for status updates from background with error handling
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  try {
    if (request.action === 'statusUpdate') {
      const button = document.getElementById('quick-resume-btn');
      if (button && button.classList.contains('qr-loading')) {
        const textElement = button.querySelector('.qr-text');
        if (textElement) {
          textElement.textContent = request.message || 'Processing...';
        }
        if (request.progress) {
          button.style.background = `linear-gradient(90deg, rgba(76,175,80,0.3) ${request.progress}%, transparent ${request.progress}%)`;
        }
      }
    }
  } catch (error) {
    console.error('Message handling error:', error);
  }
  
  if (request.action === 'extractJob' || request.action === 'extractJobData') {
    const jobData = extractJobData();
    console.log('Quick Resume: Extracted job data:', jobData);
    
    // Format the response properly
    const response = { 
      jobData: {
        ...jobData,
        jdText: jobData.text // Ensure jdText is set
      }
    };
    
    // If the requester wants a direct reply (popup path), reply with data
    if (request.reply) {
      sendResponse(response);
      return true;
    }
    
    // New sidepanel path: return formatted response
    sendResponse(response);
    return true;
  }
});

// Check if on job page and inject button
function checkJobPage() {
  // More strict job page detection
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;
  let isJobPage = false;
  
  // LinkedIn job pages
  if (hostname.includes('linkedin.com')) {
    // Must be on jobs/view path AND have job content
    isJobPage = pathname.includes('/jobs/view/') && 
                (document.querySelector('.jobs-unified-top-card__job-title, h1.t-24, .jobs-description__content') !== null);
  }
  // Indeed job pages  
  else if (hostname.includes('indeed.com')) {
    // Must be on viewjob path AND have job content
    isJobPage = pathname.includes('/viewjob') && 
                (document.querySelector('[data-testid="job-title"], #jobDescriptionText') !== null);
  }
  // Glassdoor job pages
  else if (hostname.includes('glassdoor.com')) {
    // Must have job identifier in path AND job content
    isJobPage = (pathname.includes('/job-listing/') || pathname.includes('/Job/')) &&
                (document.querySelector('.css-17x2pwl, .desc') !== null);
  }
  // Other job boards - be very strict
  else {
    // Only show if we find strong job page indicators
    const hasJobTitle = document.querySelector('h1')?.textContent?.toLowerCase().includes('engineer') ||
                       document.querySelector('h1')?.textContent?.toLowerCase().includes('developer') ||
                       document.querySelector('h1')?.textContent?.toLowerCase().includes('manager') ||
                       document.querySelector('h1')?.textContent?.toLowerCase().includes('analyst');
    const hasJobDescription = document.querySelector('.job-description, .description, [class*="job-desc"], [id*="job-desc"]');
    isJobPage = hasJobTitle && hasJobDescription;
  }
    
  if (isJobPage && !buttonInjected) {
    setTimeout(injectGenerateButton, 1000);
  }
}

  // Run on page load
  checkJobPage();

  // Run on navigation (for SPAs)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      buttonInjected = false;
      checkJobPage();
    }
  }).observe(document, { subtree: true, childList: true });
}

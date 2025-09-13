// Initialize popup with authentication check
async function init() {
  const container = document.getElementById('content');
  
  // Check authentication status
  const { isAuthenticated, hasCompletedOnboarding } = await chrome.storage.local.get([
    'isAuthenticated',
    'hasCompletedOnboarding'
  ]);
  
  if (!isAuthenticated) {
    // Show sign in prompt
    container.innerHTML = `
      <div class="setup-prompt">
        <p>Sign in to start generating AI-powered resumes</p>
        <button id="signInBtn">Sign In / Create Account</button>
      </div>
    `;
    
    document.getElementById('signInBtn').addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
      window.close();
    });
    return;
  }
  
  if (!hasCompletedOnboarding) {
    // Show onboarding prompt
    container.innerHTML = `
      <div class="setup-prompt">
        <p>Complete your profile setup to start</p>
        <button id="setupBtn">Complete Setup</button>
      </div>
    `;
    
    document.getElementById('setupBtn').addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
      window.close();
    });
    return;
  }
  
  // Try to open sidepanel
  container.innerHTML = `
    <div class="setup-prompt">
      <p>Opening Quick Resume AI...</p>
    </div>
  `;
  
  try {
    // Open sidepanel
    await chrome.sidePanel.open({ windowId: (await chrome.windows.getCurrent()).id });
    window.close();
  } catch (error) {
    // Fallback for older Chrome versions or if sidepanel fails
    container.innerHTML = `
      <div class="setup-prompt">
        <p>Click to open Quick Resume AI</p>
        <button id="openPanel">Open Dashboard</button>
      </div>
    `;
    
    document.getElementById('openPanel').addEventListener('click', async () => {
      try {
        await chrome.sidePanel.open({ windowId: (await chrome.windows.getCurrent()).id });
      } catch (e) {
        // Open in new tab as fallback
        chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') });
      }
      window.close();
    });
  }
}

// Check if user has completed setup (legacy)
async function checkSetup() {
  const data = await chrome.storage.local.get(['isAuthenticated', 'hasCompletedOnboarding']);
  return data.isAuthenticated && data.hasCompletedOnboarding;
}

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', init);
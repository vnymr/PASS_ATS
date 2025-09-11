// Initialize popup - redirect to sidepanel
async function init() {
  const container = document.getElementById('content');
  
  // Open sidepanel instead
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
    // Fallback for older Chrome versions
    container.innerHTML = `
      <div class="setup-prompt">
        <p>Click to open Quick Resume AI</p>
        <button id="openPanel">Open Panel</button>
      </div>
    `;
    
    document.getElementById('openPanel').addEventListener('click', async () => {
      try {
        await chrome.sidePanel.open({ windowId: (await chrome.windows.getCurrent()).id });
        window.close();
      } catch (e) {
        // Final fallback - check setup status
        const isSetup = await checkSetup();
        if (!isSetup) {
          chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
        } else {
          chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel_new.html') });
        }
        window.close();
      }
    });
  }
}

// Check if user has completed setup
async function checkSetup() {
  const data = await chrome.storage.local.get(['profile', 'tempId']);
  return data.profile && data.tempId;
}

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', init);
// SSE reconnection logic
let retryCount = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

// Start job on load using pending payload
(async function init() {
  try {
    const { pendingJob } = await chrome.storage.local.get('pendingJob');
    if (!pendingJob) return appendLog('No job payload found.');
    appendLog('Starting generation job...');

    const { serverUrl } = await chrome.storage.local.get('serverUrl');
    const API_BASE = (serverUrl || 'https://passats-production.up.railway.app').replace(/\/$/, '');
    const resp = await fetch(`${API_BASE}/generate/job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pendingJob)
    });
    if (!resp.ok) throw new Error('Failed to start job');
    const { jobId } = await resp.json();
    appendLog(`Job ID: ${jobId}`);
    setProgress(8);

    let es;
    
    function connectSSE() {
      es = new EventSource(`${API_BASE}/generate/stream/${jobId}`);
      
      es.onerror = (error) => {
        console.error('SSE error:', error);
        es.close();
        
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          appendLog(`Connection lost. Retrying (${retryCount}/${MAX_RETRIES})...`);
          setTimeout(connectSSE, RETRY_DELAY * retryCount);
        } else {
          appendLog('Connection failed. Please check your network.');
          showError('Connection lost. Please refresh and try again.');
        }
      };
      
      return es;
    }
    
    es = connectSSE();
    es.addEventListener('status', (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.message) {
          document.getElementById('statusText').textContent = data.message;
          appendLog(data.message);
        }
        if (typeof data.progress === 'number') setProgress(data.progress);
      } catch {}
    });
    es.addEventListener('complete', (ev) => {
      try {
        const data = JSON.parse(ev.data);
        setProgress(100);
        document.getElementById('loading').style.display = 'none';
        document.getElementById('success').classList.add('show');
        
        // Remove any existing listeners to prevent duplicates
        const viewBtn = document.getElementById('viewPdf');
        const closeBtn = document.getElementById('close');
        
        const newViewBtn = viewBtn.cloneNode(true);
        const newCloseBtn = closeBtn.cloneNode(true);
        
        viewBtn.parentNode.replaceChild(newViewBtn, viewBtn);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        
        newViewBtn.addEventListener('click', () => {
          window.open(data.pdfUrl);
        });
        newCloseBtn.addEventListener('click', () => window.close());
        
        // Auto-download
        if (chrome?.downloads?.download) {
          chrome.downloads.download({ url: data.pdfUrl, filename: data.fileName || 'resume.pdf', saveAs: true });
        }
      } catch (err) {
        console.error('Error handling complete event:', err);
      }
      es.close();
    });
    es.addEventListener('error', (ev) => {
      if (ev.data) {
        try {
          const data = JSON.parse(ev.data);
          appendLog('Error: ' + data.error);
          showError(data.error);
        } catch { 
          appendLog('An error occurred.');
          showError('An unexpected error occurred.');
        }
        es.close();
      }
    });
  } catch (e) {
    appendLog('Failed to initialize job: ' + e.message);
  }
})();

function showError(message) {
  const loading = document.getElementById('loading');
  const statusText = document.getElementById('statusText');
  
  if (loading && statusText) {
    statusText.textContent = message;
    statusText.style.color = '#666';
    
    // Add retry button
    if (!document.getElementById('retryBtn')) {
      const retryBtn = document.createElement('button');
      retryBtn.id = 'retryBtn';
      retryBtn.textContent = 'Retry';
      retryBtn.style.marginTop = '20px';
      retryBtn.onclick = () => window.location.reload();
      loading.appendChild(retryBtn);
    }
  }
}

// Listen for completion and status from background (legacy path)
function appendLog(line) {
  const log = document.getElementById('log');
  const div = document.createElement('div');
  const ts = new Date().toLocaleTimeString();
  div.textContent = `[${ts}] ${line}`;
  log.appendChild(div);
}

function setProgress(pct) {
  const bar = document.getElementById('progressBar');
  bar.style.width = Math.min(99, Math.max(0, pct)) + '%';
}

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'statusUpdate') {
    if (request.message) {
      document.getElementById('statusText').textContent = request.message;
      appendLog(request.message);
    }
    if (typeof request.progress === 'number') {
      setProgress(request.progress);
    }
  }
  if (request.action === 'generationComplete') {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('success').classList.add('show');
    
    document.getElementById('viewPdf').addEventListener('click', () => {
      window.open(request.pdfUrl);
    });
    
    document.getElementById('close').addEventListener('click', () => {
      window.close();
    });
  }
});

// Auto close after 20 seconds if no response
setTimeout(() => {
  const success = document.getElementById('success');
  if (!success.classList.contains('show')) {
    window.location.href = chrome.runtime.getURL('error.html');
  }
}, 20000);


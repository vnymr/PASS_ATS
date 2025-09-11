// Start job on load using pending payload
(async function init() {
  try {
    const { pendingJob } = await chrome.storage.local.get('pendingJob');
    if (!pendingJob) return appendLog('No job payload found.');
    appendLog('Starting generation job...');

    const { serverUrl } = await chrome.storage.local.get('serverUrl');
    const API_BASE = (serverUrl || 'http://localhost:3000').replace(/\/$/, '');
    const resp = await fetch(`${API_BASE}/generate/job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pendingJob)
    });
    if (!resp.ok) throw new Error('Failed to start job');
    const { jobId } = await resp.json();
    appendLog(`Job ID: ${jobId}`);
    setProgress(8);

    const es = new EventSource(`${API_BASE}/generate/stream/${jobId}`);
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
        document.getElementById('viewPdf').addEventListener('click', () => {
          window.open(data.pdfUrl);
        });
        document.getElementById('close').addEventListener('click', () => window.close());
        // Auto-download
        if (chrome?.downloads?.download) {
          chrome.downloads.download({ url: data.pdfUrl, filename: data.fileName || 'resume.pdf', saveAs: true });
        }
      } catch {}
      es.close();
    });
    es.addEventListener('error', (ev) => {
      try {
        const data = JSON.parse(ev.data);
        appendLog('Error: ' + data.error);
      } catch { appendLog('An error occurred.'); }
      es.close();
      setTimeout(() => {
        window.location.href = chrome.runtime.getURL('error.html');
      }, 500);
    });
  } catch (e) {
    appendLog('Failed to initialize job: ' + e.message);
  }
})();

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


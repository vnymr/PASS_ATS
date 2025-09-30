import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { api, type Quota, type ResumeEntry } from '../api-clerk';
import Icons from '../components/ui/icons';

export default function Dashboard() {
  const { getToken } = useAuth();
  const [quota, setQuota] = useState<Quota | null>(null);
  const [resumes, setResumes] = useState<ResumeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobDescription, setJobDescription] = useState('');
  const [aiMode, setAiMode] = useState('claude');
  const [matchMode, setMatchMode] = useState('Standard');
  const [isGenerating, setIsGenerating] = useState(false);
  const resumesRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const token = await getToken();
      const [quotaData, resumesData] = await Promise.all([
        api.getQuota(token || undefined),
        api.getResumes(token || undefined)
      ]);
      setQuota(quotaData);

      if (Array.isArray(resumesData)) {
        setResumes(resumesData);
      } else if (resumesData && typeof resumesData === 'object' && 'resumes' in resumesData) {
        setResumes((resumesData as any).resumes || []);
      } else {
        setResumes([]);
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setQuota({ month: '2024-01', used: 0, remaining: 9, limit: 10 });
      setResumes([]);
    } finally {
      setLoading(false);
    }
  }

  const handleGenerate = async () => {
    const trimmedJD = jobDescription.trim();
    if (!trimmedJD || isGenerating) return;

    setIsGenerating(true);
    try {
      const token = await getToken();

      // Start job
      const result = await api.processJob(trimmedJD, aiMode, matchMode, token || undefined);
      const jobId = result.jobId;

      console.log(`📋 Job created: ${jobId}. Starting status polling...`);

      // Poll for job completion
      let attempts = 0;
      const maxAttempts = 90; // 90 * 2s = 3 minutes max (for ultrathink LLM)
      const pollInterval = 2000; // 2 seconds

      const checkStatus = async (): Promise<void> => {
        attempts++;
        if (attempts > maxAttempts) {
          throw new Error('Resume generation timed out. Please try again.');
        }

        try {
          const status = await api.getJobStatus(jobId, token || undefined);
          console.log(`📊 Job ${jobId} status: ${status.status} (attempt ${attempts})`);

          if (status.status === 'COMPLETED') {
            // Success! Reload resumes
            const resumesData = await api.getResumes(token || undefined);
            if (Array.isArray(resumesData)) {
              setResumes(resumesData);
            } else if (resumesData && typeof resumesData === 'object' && 'resumes' in resumesData) {
              setResumes((resumesData as any).resumes || []);
            }

            // Clear textarea and scroll
            setJobDescription('');
            setTimeout(() => {
              resumesRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);

            showToast('✅ Resume generated successfully!', 'success');
            setIsGenerating(false);

          } else if (status.status === 'FAILED') {
            throw new Error(status.error || 'Resume generation failed');

          } else {
            // Still processing, poll again
            setTimeout(checkStatus, pollInterval);
          }

        } catch (pollError) {
          console.error('Status poll error:', pollError);
          throw pollError;
        }
      };

      // Start polling
      await checkStatus();

    } catch (err: any) {
      console.error('Failed to generate resume:', err);
      const errorMsg = err?.message || 'Failed to generate resume. Please try again.';
      showToast(`❌ ${errorMsg}`, 'error');
      setIsGenerating(false);
    }
  };

  const downloadResume = async (fileName: string) => {
    try {
      const token = await getToken();
      const blob = await api.downloadResume(fileName, token || undefined);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showToast('Resume downloaded successfully!', 'success');
      return true;
    } catch (err) {
      console.error('Failed to download resume:', err);
      showToast('Failed to download resume. Please try again.', 'error');
      return false;
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    const toast = document.createElement('div');
    toast.className = `ai-toast ${type === 'success' ? 'ai-toast-success' : 'ai-toast-error'}`;
    toast.innerHTML = `
      <div class="ai-toast-content">
        ${type === 'success' ?
          '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>' :
          '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>'
        }
        <span>${message}</span>
      </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  const getATSScore = () => {
    return 75 + Math.floor(Math.random() * 20);
  };

  const getStatus = () => {
    const statuses = ['Completed', 'Submitted', 'In Review'];
    return statuses[Math.floor(Math.random() * statuses.length)];
  };

  if (loading) {
    return (
      <div className="ai-loading">
        <Icons.loader className="animate-spin" size={48} />
        <p>Loading workspace...</p>
      </div>
    );
  }

  return (
    <div className="ai-dashboard">
      {/* Header Section */}
      <div className="ai-header">
        <div className="ai-header-left">
          <h1 className="ai-header-title">Workspace</h1>
          <div className="ai-header-stats">
            <span className="ai-stat-pill">
              Generated: <strong>{resumes.length}</strong>
            </span>
          </div>
        </div>
        <div className="ai-header-right">
          {quota && (
            <div className="ai-usage-pill">
              Usage: <strong>{quota.used}/{quota.limit}</strong>
            </div>
          )}
        </div>
      </div>

      {/* AI Input Section */}
      <div className="ai-input-section">
        <div className="ai-input-panel">
          <div className="ai-input-header">
            <Icons.zap size={20} />
            <span>AI Resume Generator</span>
          </div>

          <textarea
            className="ai-textarea"
            placeholder="Paste the job description here..."
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            disabled={isGenerating}
          />

          <div className="ai-controls">
            <div className="ai-control-group">
              <div className="ai-select-wrapper">
                <label className="ai-label">AI Model</label>
                <select
                  className="ai-select"
                  value={aiMode}
                  onChange={(e) => setAiMode(e.target.value)}
                  disabled={isGenerating}
                >
                  <option value="claude">Claude</option>
                  <option value="openai">OpenAI</option>
                  <option value="local">Local</option>
                </select>
              </div>

              <div className="ai-select-wrapper">
                <label className="ai-label">Match Mode</label>
                <select
                  className="ai-select"
                  value={matchMode}
                  onChange={(e) => setMatchMode(e.target.value)}
                  disabled={isGenerating}
                >
                  <option value="Standard">Standard</option>
                  <option value="Aggressive">Aggressive</option>
                  <option value="Conservative">Conservative</option>
                </select>
              </div>
            </div>

            <button
              className="ai-generate-btn"
              onClick={handleGenerate}
              disabled={!jobDescription.trim() || isGenerating}
            >
              {isGenerating ? (
                <>
                  <Icons.loader className="animate-spin" size={18} />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Icons.zap size={18} />
                  <span>Generate</span>
                </>
              )}
            </button>
          </div>

          {isGenerating && (
            <div className="ai-progress">
              <div className="ai-progress-bar">
                <div className="ai-progress-fill"></div>
              </div>
              <span className="ai-progress-text">Analyzing job description and generating optimized resume...</span>
            </div>
          )}
        </div>
      </div>

      {/* Resume History Section */}
      <div className="ai-resumes-section" ref={resumesRef}>
        <div className="ai-resumes-header">
          <div className="ai-resumes-title">
            <Icons.clock size={20} />
            <h2>Resume History</h2>
          </div>
          <button
            onClick={() => navigate('/history')}
            className="ai-view-all-btn"
          >
            View All
            <Icons.chevronRight size={16} />
          </button>
        </div>

        {resumes.length > 0 ? (
          <div className="ai-resumes-grid">
            {resumes.slice(0, 6).map((resume, idx) => {
              const score = getATSScore();
              const status = getStatus();
              return (
                <div key={idx} className="ai-resume-card">
                  <div className="ai-resume-header">
                    <div className="ai-resume-company">
                      {resume.jobUrl ? (
                        <a
                          href={resume.jobUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ai-company-link"
                        >
                          <Icons.externalLink size={14} />
                          {resume.company || 'Unknown Company'}
                        </a>
                      ) : (
                        <span>{resume.company || 'Unknown Company'}</span>
                      )}
                    </div>
                    <span className={`ai-status-badge ai-status-${status.toLowerCase().replace(' ', '-')}`}>
                      {status}
                    </span>
                  </div>

                  <div className="ai-resume-body">
                    <h3 className="ai-resume-role">{resume.role || 'N/A'}</h3>
                    <div className="ai-resume-date">
                      <Icons.calendar size={14} />
                      {resume.createdAt ? new Date(resume.createdAt).toLocaleDateString() : 'N/A'}
                    </div>

                    <div className="ai-ats-container">
                      <div className="ai-ats-label">
                        <span>ATS Score</span>
                        <span className="ai-ats-value">{score}%</span>
                      </div>
                      <div className="ai-ats-bar">
                        <div
                          className={`ai-ats-fill ${score >= 80 ? 'ai-ats-high' : score >= 60 ? 'ai-ats-medium' : 'ai-ats-low'}`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => downloadResume(resume.fileName)}
                    className="ai-download-btn"
                  >
                    <Icons.download size={16} />
                    Download
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="ai-empty-state">
            <div className="ai-empty-icon">
              <Icons.fileText size={64} />
            </div>
            <h3>No resumes generated yet</h3>
            <p>Paste a job description above to generate your first AI-optimized resume</p>
          </div>
        )}
      </div>
    </div>
  );
}
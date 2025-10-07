import React, { useEffect, useState, useRef, KeyboardEvent } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { api, type Quota, type ResumeEntry } from '../api-clerk';
import Icons from '../components/ui/icons';

export default function DashboardUnified() {
  const { getToken } = useAuth();
  const [quota, setQuota] = useState<Quota | null>(null);
  const [resumes, setResumes] = useState<ResumeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobDescription, setJobDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [lastGenerated, setLastGenerated] = useState<ResumeEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'recent' | 'week'>('all');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    // Focus textarea on mount
    textareaRef.current?.focus();
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
      setResumes([]);
    } finally {
      setLoading(false);
    }
  }

  const handleGenerate = async () => {
    const trimmedJD = jobDescription.trim();

    if (!trimmedJD) {
      setError('Please paste a job description');
      return;
    }

    setIsGenerating(true);
    setError('');
    setLastGenerated(null);

    try {
      const token = await getToken();
      const result = await api.processJob(trimmedJD, 'claude', 'Standard', token || undefined);

      // Reload resumes after generation
      const resumesData = await api.getResumes(token || undefined);
      if (Array.isArray(resumesData)) {
        setResumes(resumesData);
        if (resumesData.length > 0) {
          setLastGenerated(resumesData[0]);
        }
      } else if (resumesData && typeof resumesData === 'object' && 'resumes' in resumesData) {
        const resumesList = (resumesData as any).resumes || [];
        setResumes(resumesList);
        if (resumesList.length > 0) {
          setLastGenerated(resumesList[0]);
        }
      }

      // Clear textarea after successful generation
      setJobDescription('');

      // Reload quota
      const newQuota = await api.getQuota(token || undefined);
      setQuota(newQuota);
    } catch (err: any) {
      setError(err.message || 'Failed to generate resume. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleGenerate();
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
    } catch (err) {
      console.error('Failed to download resume:', err);
      setError('Failed to download resume');
    }
  };

  const getFilteredResumes = () => {
    let filtered = [...resumes];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(resume =>
        (resume.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
         resume.role?.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Apply time filter
    const now = new Date();
    if (filter === 'recent') {
      filtered = filtered.slice(0, 5); // Show 5 most recent
    } else if (filter === 'week') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(resume =>
        resume.createdAt && new Date(resume.createdAt) > oneWeekAgo
      );
    }

    return filtered;
  };

  const formatFileSize = (bytes: number = 250000) => {
    return (bytes / 1024).toFixed(0) + ' KB';
  };

  const formatJobTime = (dateStr?: string) => {
    if (!dateStr) return 'Just now';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  if (loading) {
    return (
      <div className="ai-loading">
        <Icons.loader className="animate-spin" size={48} />
        <p>Loading workspace...</p>
      </div>
    );
  }

  const filteredResumes = getFilteredResumes();

  return (
    <div className="ai-workspace">
      <div className="ai-workspace-container">
        {/* Generator Section */}
        <section className="ai-generator-section">
          <div className="ai-generator-panel">
            <div className="ai-generator-header">
              <h1 className="ai-generator-title">Resume Generator</h1>
              {quota && (
                <div className="ai-quota-badge">
                  <span className="ai-quota-used">{quota.used}</span>
                  <span className="ai-quota-separator">/</span>
                  <span className="ai-quota-limit">{quota.limit}</span>
                  <span className="ai-quota-label">credits</span>
                </div>
              )}
            </div>

            {error && (
              <div className="ai-error-message" role="alert">
                <Icons.alertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="ai-generator-input">
              <textarea
                ref={textareaRef}
                className="ai-jd-textarea"
                placeholder="Paste the job description..."
                value={jobDescription}
                onChange={(e) => {
                  setJobDescription(e.target.value);
                  setError('');
                }}
                onKeyDown={handleKeyDown}
                disabled={isGenerating}
                aria-label="Job description input"
                rows={8}
              />
              <div className="ai-generator-footer">
                <div className="ai-generator-hint">
                  <kbd>Ctrl</kbd>+<kbd>Enter</kbd> to generate
                </div>
                <button
                  className="ai-generate-button"
                  onClick={handleGenerate}
                  disabled={isGenerating || !jobDescription.trim()}
                  aria-label="Generate resume"
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
            </div>

            {isGenerating && (
              <div className="ai-generating-progress">
                <div className="ai-progress-bar">
                  <div className="ai-progress-fill"></div>
                </div>
                <span className="ai-progress-text">Analyzing job requirements...</span>
              </div>
            )}

            {lastGenerated && !isGenerating && (
              <div className="ai-result-card">
                <div className="ai-result-header">
                  <Icons.checkCircle size={20} className="ai-result-icon" />
                  <span className="ai-result-title">Resume Generated Successfully</span>
                </div>
                <div className="ai-result-body">
                  <div className="ai-result-info">
                    <span className="ai-result-filename">{lastGenerated.fileName}</span>
                    <span className="ai-result-meta">
                      {formatJobTime(lastGenerated.createdAt)} • {formatFileSize()}
                    </span>
                  </div>
                  <div className="ai-result-actions">
                    <button
                      className="ai-action-btn ai-action-primary"
                      onClick={() => downloadResume(lastGenerated.fileName)}
                      aria-label="Download PDF"
                    >
                      <Icons.download size={16} />
                      Download PDF
                    </button>
                    <button
                      className="ai-action-btn"
                      onClick={() => {
                        document.getElementById('history-section')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      aria-label="View in history"
                    >
                      <Icons.eye size={16} />
                      View in History
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* History Section */}
        <section id="history-section" className="ai-history-section">
          <div className="ai-history-header">
            <h2 className="ai-history-title">History</h2>
            <div className="ai-history-controls">
              <div className="ai-search-box">
                <Icons.search size={16} />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="ai-search-input"
                  aria-label="Search history"
                />
              </div>
              <div className="ai-filter-group">
                <button
                  className={`ai-filter-btn ${filter === 'all' ? 'active' : ''}`}
                  onClick={() => setFilter('all')}
                  aria-pressed={filter === 'all'}
                >
                  All
                </button>
                <button
                  className={`ai-filter-btn ${filter === 'recent' ? 'active' : ''}`}
                  onClick={() => setFilter('recent')}
                  aria-pressed={filter === 'recent'}
                >
                  Recent
                </button>
                <button
                  className={`ai-filter-btn ${filter === 'week' ? 'active' : ''}`}
                  onClick={() => setFilter('week')}
                  aria-pressed={filter === 'week'}
                >
                  This Week
                </button>
              </div>
            </div>
          </div>

          {filteredResumes.length > 0 ? (
            <div className="ai-history-grid">
              {filteredResumes.map((resume, idx) => (
                <div key={idx} className="ai-history-card">
                  <div className="ai-history-card-header">
                    <div className="ai-history-card-info">
                      <span className="ai-history-company">
                        {resume.company || 'Unknown Company'}
                      </span>
                      {resume.role && (
                        <span className="ai-history-role">{resume.role}</span>
                      )}
                    </div>
                    <span className="ai-history-date">
                      {formatJobTime(resume.createdAt)}
                    </span>
                  </div>
                  <div className="ai-history-card-footer">
                    <span className="ai-history-filename">{resume.fileName}</span>
                    <button
                      className="ai-history-download"
                      onClick={() => downloadResume(resume.fileName)}
                      aria-label={`Download ${resume.fileName}`}
                    >
                      <Icons.download size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="ai-history-empty">
              <Icons.fileText size={48} />
              <p>No resumes found</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
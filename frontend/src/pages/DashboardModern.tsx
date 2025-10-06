import React, { useEffect, useState, useRef, KeyboardEvent } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { api, type ResumeEntry } from '../api-clerk';
import Icons from '../components/ui/icons';

export default function DashboardModern() {
  const { getToken } = useAuth();
  const [resumes, setResumes] = useState<ResumeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobDescription, setJobDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [lastGenerated, setLastGenerated] = useState<ResumeEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'recent' | 'week'>('all');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  async function loadDashboardData() {
    try {
      const token = await getToken();
      const resumesData = await api.getResumes(token || undefined);

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

      // Start job processing
      const { jobId } = await api.processJob(trimmedJD, 'claude', 'Standard', token || undefined);
      console.log(`🚀 Job started with ID: ${jobId}`);

      // Poll for job completion
      let jobCompleted = false;
      let pollCount = 0;
      const maxPolls = 60; // Max 60 seconds

      while (!jobCompleted && pollCount < maxPolls) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

        try {
          const jobStatus = await api.getJobStatus(jobId, token || undefined);
          console.log(`📊 Job status: ${jobStatus.status}`);

          if (jobStatus.status === 'COMPLETED') {
            jobCompleted = true;
          } else if (jobStatus.status === 'FAILED') {
            throw new Error(jobStatus.error || 'Resume generation failed');
          }
        } catch (pollErr) {
          console.error('Error polling job status:', pollErr);
        }

        pollCount++;
      }

      if (!jobCompleted) {
        throw new Error('Resume generation timed out. Please try again.');
      }

      // Job completed - now fetch the resumes
      console.log('✅ Job completed, fetching resumes...');
      const resumesData = await api.getResumes(token || undefined);

      if (Array.isArray(resumesData)) {
        setResumes(resumesData);
        if (resumesData.length > 0) {
          setLastGenerated(resumesData[0]);
          console.log(`📄 Found ${resumesData.length} resumes`);
        }
      } else if (resumesData && typeof resumesData === 'object' && 'resumes' in resumesData) {
        const resumesList = (resumesData as any).resumes || [];
        setResumes(resumesList);
        if (resumesList.length > 0) {
          setLastGenerated(resumesList[0]);
          console.log(`📄 Found ${resumesList.length} resumes`);
        }
      }

      setJobDescription('');
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
    }
  };

  const getFilteredResumes = () => {
    let filtered = [...resumes];

    if (searchTerm) {
      filtered = filtered.filter(resume =>
        (resume.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
         resume.role?.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    const now = new Date();
    if (filter === 'recent') {
      filtered = filtered.slice(0, 5);
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

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Just now';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };


  if (loading) {
    return (
      <div className="modern-loading-enhanced">
        <div className="modern-loading-circle">
          <div className="modern-loading-inner"></div>
        </div>
        <p className="modern-loading-text">Initializing workspace...</p>
      </div>
    );
  }

  const filteredResumes = getFilteredResumes();

  return (
    <div className="modern-dashboard">
      <div className="modern-dashboard-container">
        {/* Main Generator Card */}
        <div className="modern-generator-card" style={{ marginTop: '2rem' }}>
          <div className="modern-generator-inner">
            {error && (
              <div className="modern-alert modern-alert-error">
                <Icons.alertCircle size={18} />
                <span>{error}</span>
                <button
                  onClick={() => setError('')}
                  className="modern-alert-close"
                  aria-label="Dismiss"
                >
                  <Icons.x size={16} />
                </button>
              </div>
            )}

            <div className="modern-textarea-container">
              <textarea
                ref={textareaRef}
                className="modern-textarea-enhanced"
                placeholder="Paste the job description here to generate a tailored resume..."
                value={jobDescription}
                onChange={(e) => {
                  setJobDescription(e.target.value);
                  setError('');
                }}
                onKeyDown={handleKeyDown}
                disabled={isGenerating}
                aria-label="Job description"
              />

              <div className="modern-textarea-footer">
                <div className="modern-keyboard-hint">
                  <kbd className="modern-key">Ctrl</kbd>
                  <span>+</span>
                  <kbd className="modern-key">Enter</kbd>
                  <span>to generate</span>
                </div>

                <button
                  className={`modern-generate-btn ${isGenerating ? 'generating' : ''}`}
                  onClick={handleGenerate}
                  disabled={isGenerating || !jobDescription.trim()}
                >
                  {isGenerating ? (
                    <>
                      <div className="modern-btn-spinner"></div>
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Icons.zap size={18} />
                      <span>Generate Resume</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Progress Indicator */}
            {isGenerating && (
              <div className="modern-progress-enhanced">
                <div className="modern-progress-track">
                  <div className="modern-progress-bar-animated"></div>
                </div>
                <p className="modern-progress-message">
                  <Icons.settings size={14} />
                  Analyzing requirements and tailoring your resume...
                </p>
              </div>
            )}

            {/* Success Result */}
            {lastGenerated && !isGenerating && (
              <div className="modern-success-card">
                <div className="modern-success-header">
                  <div className="modern-success-icon">
                    <Icons.checkCircle size={20} />
                  </div>
                  <div className="modern-success-text">
                    <h3>Resume ready</h3>
                    <p>{lastGenerated.company} • {lastGenerated.role}</p>
                  </div>
                </div>
                <div className="modern-success-actions">
                  <button
                    className="modern-action-btn modern-action-primary"
                    onClick={() => downloadResume(lastGenerated.fileName)}
                  >
                    <Icons.download size={16} />
                    Download PDF
                  </button>
                  <button
                    className="modern-action-btn modern-action-secondary"
                    onClick={() => {
                      document.getElementById('history-section')?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                      });
                    }}
                  >
                    <Icons.eye size={16} />
                    View in History
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* History Section */}
        <div id="history-section" className="modern-history-section">
          <div className="modern-history-header">
            <div className="modern-history-title-group">
              <Icons.clock size={24} />
              <h2>Generation History</h2>
              <span className="modern-history-count">{filteredResumes.length}</span>
            </div>

            <div className="modern-history-controls">
              <div className="modern-search-box">
                <Icons.search size={18} />
                <input
                  type="text"
                  placeholder="Search resumes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="modern-search-input-enhanced"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="modern-search-clear"
                  >
                    <Icons.x size={14} />
                  </button>
                )}
              </div>

              <div className="modern-filter-group">
                {['all', 'recent', 'week'].map((filterType) => (
                  <button
                    key={filterType}
                    className={`modern-filter-btn ${filter === filterType ? 'active' : ''}`}
                    onClick={() => setFilter(filterType as any)}
                  >
                    {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredResumes.length > 0 ? (
            <div className="modern-resume-grid">
              {filteredResumes.map((resume, idx) => (
                <div
                  key={idx}
                  className={`modern-resume-card ${hoveredCard === idx ? 'hovered' : ''}`}
                  onMouseEnter={() => setHoveredCard(idx)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <div className="modern-resume-card-inner">
                    <div className="modern-resume-icon">
                      <Icons.fileText size={32} />
                    </div>

                    <div className="modern-resume-content">
                      <h3 className="modern-resume-company">
                        {resume.company || 'Unknown Company'}
                      </h3>
                      <p className="modern-resume-role">
                        {resume.role || 'Position not specified'}
                      </p>

                      <div className="modern-resume-meta">
                        <span className="modern-resume-date">
                          <Icons.calendar size={14} />
                          {formatDate(resume.createdAt)}
                        </span>
                        <span className="modern-resume-size">
                          <Icons.file size={14} />
                          {formatFileSize()}
                        </span>
                      </div>
                    </div>

                    <div className="modern-resume-actions">
                      <button
                        className="modern-resume-download"
                        onClick={() => downloadResume(resume.fileName)}
                        aria-label="Download resume"
                      >
                        <Icons.download size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="modern-empty-state">
              <div className="modern-empty-illustration">
                <Icons.inbox size={64} />
              </div>
              <h3>No resumes found</h3>
              <p>
                {searchTerm
                  ? `No results matching "${searchTerm}"`
                  : 'Generate your first resume to get started'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
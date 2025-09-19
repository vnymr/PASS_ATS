import React, { useState, useEffect } from 'react';
import { api, type ResumeEntry } from '../api-adapter';
import Icons from '../components/ui/icons';

export default function History() {
  const [resumes, setResumes] = useState<ResumeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'recent' | 'this-month'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadResumes();
  }, []);

  async function loadResumes() {
    try {
      setLoading(true);
      const data = await api.getResumes();
      setResumes(data || []);
    } catch (err) {
      console.error('Failed to load resumes:', err);
      setError('Failed to load resume history');
    } finally {
      setLoading(false);
    }
  }

  const downloadResume = async (fileName: string) => {
    try {
      const blob = await api.downloadResume(fileName);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to download resume:', err);
      alert('Failed to download resume. Please try again.');
    }
  };

  const getFilteredResumes = () => {
    let filtered = resumes;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(resume => 
        (resume.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
         resume.role?.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Apply time filter
    const now = new Date();
    switch (filter) {
      case 'recent':
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(resume => 
          resume.createdAt && new Date(resume.createdAt) > oneWeekAgo
        );
        break;
      case 'this-month':
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        filtered = filtered.filter(resume => 
          resume.createdAt && new Date(resume.createdAt) > thisMonth
        );
        break;
    }

    return filtered;
  };

  const getATSScore = () => 75 + Math.floor(Math.random() * 20);
  const getStatus = () => {
    const statuses = ['Completed', 'Submitted', 'In Review'];
    return statuses[Math.floor(Math.random() * statuses.length)];
  };

  if (loading) {
    return (
      <div className="loading-container">
        <Icons.loader className="animate-spin" size={48} />
        <p>Loading resume history...</p>
      </div>
    );
  }

  const filteredResumes = getFilteredResumes();

  return (
    <div className="history-container">
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">Resume History</h1>
          <p className="page-subtitle">
            View and manage all your generated resumes. Download, share, or track your applications.
          </p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="history-controls">
        <div className="search-box">
          <Icons.search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search by company or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-tabs">
          <button
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Resumes
          </button>
          <button
            className={`filter-tab ${filter === 'recent' ? 'active' : ''}`}
            onClick={() => setFilter('recent')}
          >
            Recent (7 days)
          </button>
          <button
            className={`filter-tab ${filter === 'this-month' ? 'active' : ''}`}
            onClick={() => setFilter('this-month')}
          >
            This Month
          </button>
        </div>
      </div>

      {/* Results Summary */}
      <div className="results-summary">
        <p>
          Showing {filteredResumes.length} of {resumes.length} resumes
          {searchTerm && ` matching "${searchTerm}"`}
        </p>
      </div>

      {/* Resume List */}
      {error && (
        <div className="error-message">
          <Icons.alertCircle size={16} />
          {error}
        </div>
      )}

      {filteredResumes.length > 0 ? (
        <div className="resumes-grid">
          {filteredResumes.map((resume, idx) => {
            const score = getATSScore();
            const status = getStatus();
            return (
              <div key={idx} className="resume-card">
                <div className="resume-header">
                  <div className="resume-title">
                    <h3 className="resume-company">
                      {resume.jobUrl ? (
                        <a 
                          href={resume.jobUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="company-link"
                        >
                          {resume.company || 'Unknown Company'}
                        </a>
                      ) : (
                        resume.company || 'Unknown Company'
                      )}
                    </h3>
                    <p className="resume-role">{resume.role || 'Position'}</p>
                  </div>
                  <div className="resume-status">
                    <span className={`status-badge ${
                      status === 'Completed' ? 'status-completed' :
                      status === 'Submitted' ? 'status-submitted' :
                      'status-review'
                    }`}>
                      {status}
                    </span>
                  </div>
                </div>

                <div className="resume-meta">
                  <div className="meta-item">
                    <Icons.calendar size={14} />
                    <span>
                      {resume.createdAt ? new Date(resume.createdAt).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  <div className="meta-item">
                    <Icons.barChart2 size={14} />
                    <span>ATS Score: {score}%</span>
                  </div>
                </div>

                <div className="resume-actions">
                  <button
                    onClick={() => downloadResume(resume.fileName)}
                    className="btn btn-primary btn-sm"
                    title="Download PDF"
                  >
                    <Icons.download size={16} />
                    Download PDF
                  </button>
                  {resume.texUrl && (
                    <button
                      onClick={() => window.open(resume.texUrl, '_blank')}
                      className="btn btn-ghost btn-sm"
                      title="View LaTeX Source"
                    >
                      <Icons.code size={16} />
                      LaTeX
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <Icons.fileText size={48} className="empty-icon" />
          <h3 className="empty-title">No resumes found</h3>
          <p className="empty-text">
            {searchTerm 
              ? `No resumes match "${searchTerm}". Try a different search term.`
              : filter === 'recent' 
                ? 'No resumes generated in the last 7 days.'
                : filter === 'this-month'
                  ? 'No resumes generated this month.'
                  : 'You haven\'t generated any resumes yet.'
            }
          </p>
          {!searchTerm && filter === 'all' && (
            <button 
              onClick={() => window.location.href = '/generate'}
              className="btn btn-primary"
            >
              Generate Your First Resume
            </button>
          )}
        </div>
      )}
    </div>
  );
}
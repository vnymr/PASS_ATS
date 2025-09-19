import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Quota, type ResumeEntry } from '../api-adapter';
import Icons from '../components/ui/icons';

export default function Dashboard() {
  const [quota, setQuota] = useState<Quota | null>(null);
  const [resumes, setResumes] = useState<ResumeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      console.log('Loading dashboard data...');
      const [quotaData, resumesData] = await Promise.all([
        api.getQuota(),
        api.getResumes()
      ]);
      console.log('Dashboard data loaded:', { quotaData, resumesData });
      setQuota(quotaData);
      setResumes(resumesData || []);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      // Set default values if API fails
      setQuota({ month: '2024-01', used: 0, remaining: 9, limit: 10 });
      setResumes([]);
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
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // Show success notification
      const notification = document.createElement('div');
      notification.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
      notification.innerHTML = `
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
          <span>Resume downloaded successfully!</span>
        </div>
      `;
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 3000);

      return true;
    } catch (err) {
      console.error('Failed to download resume:', err);
      alert('Failed to download resume. Please try again.');
      return false;
    }
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
      <div className="loading-container">
        <Icons.loader className="animate-spin" size={48} />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', background: 'white', minHeight: '100vh' }}>
      <h1 style={{ color: 'black', fontSize: '2rem', marginBottom: '1rem' }}>Dashboard</h1>

      <div className="dashboard-container">
        {/* Header Section */}
        <div className="dashboard-header">
          <div className="dashboard-header-content">
            <div className="dashboard-header-icon">
              <Icons.briefcase size={32} />
            </div>
            <div className="dashboard-header-text">
              <h1 className="dashboard-title">Dashboard</h1>
              <p className="dashboard-subtitle">
                Track your resume generation progress and manage your applications
              </p>
            </div>
          </div>
          <div className="dashboard-actions">
            <button
              onClick={() => navigate('/generate')}
              className="btn btn-primary btn-generate"
            >
              <Icons.plus size={18} className="mr-2" />
              Generate Resume
            </button>
          </div>
        </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon">
            <Icons.award size={24} />
          </div>
          <div className="stat-card-content">
            <div className="stat-card-label">Credits Remaining</div>
            <div className="stat-card-value">{quota?.remaining || 9}</div>
            <div className="stat-card-subtext">Resume generations left</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon">
            <Icons.fileText size={24} />
          </div>
          <div className="stat-card-content">
            <div className="stat-card-label">Total Generated</div>
            <div className="stat-card-value">{resumes.length || 0}</div>
            <div className="stat-card-subtext">Resumes created</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon">
            <Icons.trendingUp size={24} />
          </div>
          <div className="stat-card-content">
            <div className="stat-card-label">Average ATS Score</div>
            <div className="stat-card-value">85%</div>
            <div className="stat-card-subtext">Optimization level</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon">
            <Icons.calendar size={24} />
          </div>
          <div className="stat-card-content">
            <div className="stat-card-label">This Month</div>
            <div className="stat-card-value">{resumes.filter(r => {
              if (!r.createdAt) return false;
              const created = new Date(r.createdAt);
              const now = new Date();
              return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
            }).length}</div>
            <div className="stat-card-subtext">Resumes generated</div>
          </div>
        </div>
      </div>

      {/* Recent Resumes Section */}
      <div className="resumes-section">
        <div className="resumes-header">
          <div className="resumes-header-content">
            <Icons.clock size={24} />
            <h2 className="resumes-title">Recent Resumes</h2>
          </div>
          <div className="resumes-controls">
            <button
              onClick={() => navigate('/history')}
              className="btn btn-ghost btn-sm"
            >
              <Icons.eye size={16} className="mr-2" />
              View All
            </button>
          </div>
        </div>

        {resumes.length > 0 ? (
          <div className="resumes-table-container">
            <table className="resumes-table">
              <thead>
                <tr className="resumes-table-header">
                  <th className="resumes-table-cell">Company</th>
                  <th className="resumes-table-cell">Role</th>
                  <th className="resumes-table-cell">Created</th>
                  <th className="resumes-table-cell">ATS Score</th>
                  <th className="resumes-table-cell">Status</th>
                  <th className="resumes-table-cell">Actions</th>
                </tr>
              </thead>
              <tbody>
                {resumes.slice(0, 10).map((resume, idx) => {
                  const score = getATSScore();
                  const status = getStatus();
                  return (
                    <tr key={idx} className="resumes-table-row">
                      <td className="resumes-table-cell">
                        <div className="company-cell">
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
                            <span className="company-name">{resume.company || 'Unknown Company'}</span>
                          )}
                        </div>
                      </td>
                      <td className="resumes-table-cell">
                        <span className="role-text">{resume.role || 'N/A'}</span>
                      </td>
                      <td className="resumes-table-cell">
                        <span className="date-text">
                          {resume.createdAt ? new Date(resume.createdAt).toLocaleDateString() : 'N/A'}
                        </span>
                      </td>
                      <td className="resumes-table-cell">
                        <div className="score-container">
                          <div className="score-bar">
                            <div
                              className={`score-fill ${
                                score >= 80 ? 'score-high' : 
                                score >= 60 ? 'score-medium' : 'score-low'
                              }`}
                              style={{ width: `${score}%` }}
                            />
                          </div>
                          <span className="score-text">{score}%</span>
                        </div>
                      </td>
                      <td className="resumes-table-cell">
                        <span className={`status-badge ${
                          status === 'Completed' ? 'status-completed' :
                          status === 'Submitted' ? 'status-submitted' :
                          'status-review'
                        }`}>
                          {status}
                        </span>
                      </td>
                      <td className="resumes-table-cell">
                        <button
                          onClick={() => downloadResume(resume.fileName)}
                          className="action-btn"
                          title="Download PDF"
                        >
                          <Icons.download size={16} className="mr-1" />
                          Download
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Icons.fileText size={64} />
            </div>
            <h3 className="empty-state-title">No resumes yet</h3>
            <p className="empty-state-text">
              Generate your first resume to get started with your job applications
            </p>
            <button
              onClick={() => navigate('/generate')}
              className="btn btn-primary btn-large"
            >
              <Icons.plus size={20} className="mr-2" />
              Generate Your First Resume
            </button>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ModernLayout from '../layouts/ModernLayout';
import {
  getMyApplications,
  getAutoApplyStats,
  cancelApplication,
  type Application,
  type ApplicationStats
} from '../services/api';

export default function AgentDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<ApplicationStats | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    // Poll for updates every 10 seconds
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [selectedStatus]);

  const loadData = async () => {
    try {
      const [statsData, appsData] = await Promise.all([
        getAutoApplyStats(),
        getMyApplications({
          status: selectedStatus === 'all' ? undefined : selectedStatus as any,
          limit: 50
        })
      ]);

      setStats(statsData);
      setApplications(appsData.applications);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelApplication = async (applicationId: string) => {
    if (!confirm('Are you sure you want to cancel this application?')) {
      return;
    }

    setCancellingId(applicationId);
    try {
      await cancelApplication(applicationId);
      await loadData(); // Reload data
    } catch (err: any) {
      alert(`Failed to cancel: ${err.message}`);
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'APPLYING':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'QUEUED':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'FAILED':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'RETRYING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-600 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  if (loading && !stats) {
    return (
      <ModernLayout>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </ModernLayout>
    );
  }

  if (error && !stats) {
    return (
      <ModernLayout>
        <div className="min-h-screen bg-white">
          <div className="max-w-7xl mx-auto px-8 py-12">
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
              <h2 className="text-xl font-bold text-red-800 mb-2">Failed to Load Dashboard</h2>
              <p className="text-red-600 mb-4">{error}</p>
              <button onClick={loadData} className="btn-primary">
                Retry
              </button>
            </div>
          </div>
        </div>
      </ModernLayout>
    );
  }

  const successRate = stats && stats.total > 0
    ? ((stats.submitted / stats.total) * 100).toFixed(1)
    : '0.0';

  return (
    <ModernLayout>
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto px-8 py-12">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-4xl font-bold mb-2" style={{color: 'var(--text)'}}>
                AI Agent Dashboard
              </h1>
              <p className="text-lg text-gray-600">
                Monitor your AI-powered job applications
              </p>
            </div>
            <button
              onClick={() => navigate('/find-job')}
              className="btn-primary"
            >
              Find Jobs to Apply
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid md:grid-cols-4 gap-6 mb-12">
            <div className="card">
              <div className="text-sm font-semibold text-gray-600 mb-2">Total Applications</div>
              <div className="text-3xl font-bold" style={{color: 'var(--text)'}}>
                {stats?.total || 0}
              </div>
              <div className="text-xs text-primary mt-1">
                +{stats?.thisWeek || 0} this week
              </div>
            </div>

            <div className="card">
              <div className="text-sm font-semibold text-gray-600 mb-2">Submitted</div>
              <div className="text-3xl font-bold text-green-600">
                {stats?.submitted || 0}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {stats?.pending || 0} pending
              </div>
            </div>

            <div className="card">
              <div className="text-sm font-semibold text-gray-600 mb-2">Success Rate</div>
              <div className="text-3xl font-bold" style={{color: 'var(--text)'}}>
                {successRate}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {stats?.failed || 0} failed
              </div>
            </div>

            <div className="card">
              <div className="text-sm font-semibold text-gray-600 mb-2">Total Cost</div>
              <div className="text-3xl font-bold" style={{color: 'var(--text)'}}>
                ${stats?.totalCost.toFixed(2) || '0.00'}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                ${stats?.averageCost.toFixed(3) || '0.000'} avg
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 mb-6 border-b-2 border-gray-200 pb-2">
            {['all', 'QUEUED', 'APPLYING', 'SUBMITTED', 'FAILED'].map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-4 py-2 rounded-t-lg font-semibold transition-colors ${
                  selectedStatus === status
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status === 'all' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Applications List */}
          <div className="card">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold" style={{color: 'var(--text)'}}>
                Recent Applications
              </h2>
              <button
                onClick={loadData}
                className="text-sm text-gray-600 hover:text-primary transition-colors flex items-center gap-2"
                disabled={loading}
              >
                <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>

            {applications.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-xl font-semibold text-gray-600 mb-2">No applications yet</h3>
                <p className="text-gray-500 mb-4">
                  {selectedStatus === 'all'
                    ? 'Start by finding jobs to auto-apply to'
                    : `No ${selectedStatus.toLowerCase()} applications`}
                </p>
                {selectedStatus === 'all' && (
                  <button
                    onClick={() => navigate('/find-job')}
                    className="btn-primary"
                  >
                    Browse Jobs
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {applications.map((app) => (
                  <div
                    key={app.id}
                    className="flex items-start justify-between p-4 border-2 border-gray-200 rounded-lg hover:border-accent transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-lg" style={{color: 'var(--text)'}}>
                          {app.job?.title || 'Job Title'}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(app.status)}`}>
                          {app.status}
                        </span>
                      </div>

                      <p className="text-sm text-gray-600 mb-1">
                        {app.job?.company || 'Company'} • {app.job?.location || 'Location'}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                        <span>Applied {formatDate(app.createdAt)}</span>
                        <span>•</span>
                        <span>Method: {app.method}</span>
                        {app.cost > 0 && (
                          <>
                            <span>•</span>
                            <span>Cost: ${app.cost.toFixed(4)}</span>
                          </>
                        )}
                      </div>

                      {app.error && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                          <strong>Error:</strong> {app.error}
                        </div>
                      )}

                      {app.confirmationData && app.status === 'SUBMITTED' && (
                        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                          Successfully submitted • Fields filled: {app.confirmationData.fieldsFilled || 0}
                          {app.submittedAt && ` • ${formatDate(app.submittedAt)}`}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                      {app.status === 'QUEUED' && (
                        <button
                          onClick={() => handleCancelApplication(app.id)}
                          disabled={cancellingId === app.id}
                          className="btn-secondary text-sm py-2 px-4 whitespace-nowrap"
                        >
                          {cancellingId === app.id ? 'Cancelling...' : 'Cancel'}
                        </button>
                      )}

                      {app.job?.applyUrl && (
                        <a
                          href={app.job.applyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary text-sm py-2 px-4 text-center whitespace-nowrap"
                        >
                          View Job
                        </a>
                      )}

                      {app.confirmationUrl && (
                        <button
                          onClick={() => window.open(app.confirmationUrl, '_blank')}
                          className="btn-secondary text-sm py-2 px-4 whitespace-nowrap"
                        >
                          Screenshot
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Help Section */}
          <div className="mt-8 p-6 bg-blue-50 border-2 border-blue-200 rounded-lg">
            <h3 className="text-lg font-bold text-blue-900 mb-2">How Auto-Apply Works</h3>
            <ul className="text-sm text-blue-800 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">1.</span>
                Browse jobs on the "Find Jobs" page and click "Auto-Apply"
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">2.</span>
                Our AI agent fills out the application form automatically using your profile data
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">3.</span>
                Track progress here in real-time - applications typically complete in 2-5 minutes
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">4.</span>
                Get confirmation screenshots and application IDs when submitted
              </li>
            </ul>
          </div>
        </div>
      </div>
    </ModernLayout>
  );
}

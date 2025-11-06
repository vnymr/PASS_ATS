import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Briefcase, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { ApplicationCard } from './ApplicationCard';
import { ProgressCard } from './ProgressCard';

interface DashboardPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Application {
  id: string;
  job: {
    title: string;
    company: string;
    location: string;
  };
  status: 'QUEUED' | 'APPLYING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  error?: string | null;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';

export function DashboardPanel({ isOpen, onClose }: DashboardPanelProps) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    queued: 0,
    applying: 0,
    failed: 0,
  });

  useEffect(() => {
    if (isOpen) {
      loadApplications();
      const interval = setInterval(loadApplications, 10000); // Refresh every 10s
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  async function loadApplications() {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/my-applications?limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setApplications(data.applications || []);

        // Calculate stats
        const apps = data.applications || [];
        setStats({
          total: apps.length,
          completed: apps.filter((a: Application) => a.status === 'COMPLETED').length,
          queued: apps.filter((a: Application) => a.status === 'QUEUED').length,
          applying: apps.filter((a: Application) => a.status === 'APPLYING').length,
          failed: apps.filter((a: Application) => a.status === 'FAILED').length,
        });
      }
    } catch (error) {
      console.error('Failed to load applications:', error);
    } finally {
      setLoading(false);
    }
  }

  function getApplicationStatus(status: string): 'pending' | 'reviewing' | 'interview' | 'rejected' | 'accepted' {
    switch (status) {
      case 'COMPLETED':
        return 'accepted';
      case 'APPLYING':
        return 'reviewing';
      case 'FAILED':
        return 'rejected';
      case 'QUEUED':
      default:
        return 'pending';
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  }

  const successRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <>
      {/* Panel */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: isOpen ? 0 : '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 w-full md:w-[440px] bg-background shadow-2xl z-50 overflow-y-auto"
        style={{
          top: '72px',
          height: 'calc(100vh - 72px)'
        }}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2
                className="text-foreground mb-1"
                style={{
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                  fontSize: '20px',
                  fontWeight: 600,
                }}
              >
                Application Tracker
              </h2>
              <p
                style={{
                  color: 'var(--text-600)',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                  fontSize: '14px',
                }}
              >
                Monitor your auto-apply progress
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-[8px] transition-colors duration-200"
              style={{
                backgroundColor: 'transparent',
                color: 'var(--text-600)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--background-100)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stats Section */}
          <div className="mb-8">
            <div className="flex items-center space-x-2 mb-4">
              <TrendingUp className="w-4 h-4 text-foreground" />
              <h3
                className="text-foreground"
                style={{
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                  fontSize: '16px',
                  fontWeight: 600,
                }}
              >
                Your Progress
              </h3>
            </div>

            <div className="space-y-3">
              <ProgressCard
                title="Applications Sent"
                count={stats.completed}
                total={stats.total || 1}
                description={stats.total === 0 ? 'Start auto-applying to jobs!' : `${stats.completed} completed, ${stats.queued + stats.applying} in progress`}
                delay={0}
              />
              <ProgressCard
                title="Success Rate"
                count={successRate}
                total={100}
                description={successRate > 80 ? 'Excellent success rate!' : successRate > 50 ? 'Keep improving!' : 'Keep trying!'}
                delay={0.1}
              />
              {stats.applying > 0 && (
                <ProgressCard
                  title="Currently Applying"
                  count={stats.applying}
                  total={stats.queued + stats.applying}
                  description={`${stats.queued} jobs in queue`}
                  delay={0.2}
                />
              )}
            </div>
          </div>

          {/* Recent Applications Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Briefcase className="w-4 h-4 text-foreground" />
                <h3
                  className="text-foreground"
                  style={{
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                    fontSize: '16px',
                    fontWeight: 600,
                  }}
                >
                  Recent Applications
                </h3>
              </div>
              {stats.total > 0 && (
                <span
                  style={{
                    color: 'var(--text-600)',
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                    fontSize: '13px',
                  }}
                >
                  {stats.total} total
                </span>
              )}
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-card rounded-[16px] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.08)] animate-pulse"
                  >
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : applications.length === 0 ? (
              <div className="text-center py-12">
                <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p
                  style={{
                    color: 'var(--text-600)',
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                    fontSize: '14px',
                  }}
                >
                  No applications yet. Start auto-applying to jobs!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {applications.map((app, index) => (
                  <ApplicationCard
                    key={app.id}
                    title={app.job.title}
                    company={app.job.company}
                    location={app.job.location}
                    appliedDate={formatDate(app.createdAt)}
                    status={getApplicationStatus(app.status)}
                    delay={index * 0.05}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Queue Status */}
          {(stats.queued > 0 || stats.applying > 0) && (
            <div className="mt-8 rounded-[16px] p-5" style={{ backgroundColor: 'var(--primary-50)' }}>
              <div className="flex items-center space-x-2 mb-2">
                <Clock className="w-4 h-4" style={{ color: 'var(--primary-600)' }} />
                <h4
                  className="text-foreground"
                  style={{
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                    fontSize: '14px',
                    fontWeight: 600,
                  }}
                >
                  Queue Status
                </h4>
              </div>
              <p
                style={{
                  color: 'var(--text-600)',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                  fontSize: '13px',
                  lineHeight: '1.5',
                }}
              >
                {stats.applying > 0 && `${stats.applying} application${stats.applying > 1 ? 's' : ''} currently being submitted. `}
                {stats.queued > 0 && `${stats.queued} job${stats.queued > 1 ? 's' : ''} waiting in queue.`}
              </p>
            </div>
          )}

          {/* Success Tip */}
          {stats.completed > 0 && (
            <div className="mt-4 rounded-[16px] p-5" style={{ backgroundColor: 'var(--background-50)' }}>
              <div className="flex items-center space-x-2 mb-2">
                <CheckCircle className="w-4 h-4" style={{ color: 'var(--secondary-500)' }} />
                <h4
                  className="text-foreground"
                  style={{
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                    fontSize: '14px',
                    fontWeight: 600,
                  }}
                >
                  💡 Pro Tip
                </h4>
              </div>
              <p
                style={{
                  color: 'var(--text-600)',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                  fontSize: '13px',
                  lineHeight: '1.5',
                }}
              >
                Follow up on your completed applications within 48 hours for better response rates!
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

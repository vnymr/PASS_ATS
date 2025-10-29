import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UserButton, useAuth } from '@clerk/clerk-react';
import PromptBox from '../components/PromptBox';
import { htmlToPlainText } from '../utils/htmlCleaner';
import { autoApplyToJob } from '../services/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  salary?: string;
  description: string;
  requirements?: string;
  postedDate: string;
  atsType?: string;
  aiApplyable?: boolean;
  applyUrl: string;
}

export default function FindJob() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string>('');
  const [autoApplying, setAutoApplying] = useState(false);

  useEffect(() => {
    if (initialQuery) {
      searchJobs(initialQuery);
    }
  }, [initialQuery]);

  const searchJobs = async (searchQuery: string) => {
    setIsLoading(true);
    setQuery(searchQuery);
    setError(null);

    try {
      const token = await getToken();

      const response = await fetch(`${API_BASE_URL}/api/ai-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          query: searchQuery,
          limit: 20,
          offset: 0
        })
      });

      if (!response.ok) {
        throw new Error('Failed to search jobs');
      }

      const data = await response.json();

      setJobs(data.jobs || []);
      setExplanation(data.explanation || '');

      if (data.jobs && data.jobs.length > 0) {
        setSelectedJob(data.jobs[0]);
      }
    } catch (err) {
      console.error('Error searching jobs:', err);
      setError('Failed to search jobs. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewSearch = (newQuery: string) => {
    navigate(`/find-jobs?q=${encodeURIComponent(newQuery)}`);
    searchJobs(newQuery);
  };

  const formatPostedDate = (date: string) => {
    const postedDate = new Date(date);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - postedDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  const handleAutoApply = async (job: Job) => {
    setAutoApplying(true);
    try {
      const result = await autoApplyToJob({ jobId: job.id });

      if (result.success) {
        alert(`✅ Application queued successfully!\n\nApplication ID: ${result.applicationId}\nStatus: ${result.status}\n${result.message}\n\nCheck your Agent Dashboard to track progress.`);
        navigate('/dashboard');
      } else {
        alert('Failed to queue application. Please try again.');
      }
    } catch (err: any) {
      console.error('Auto-apply error:', err);

      // Check for specific error types
      if (err.message.includes('Profile not found') || err.message.includes('Application data not configured')) {
        alert('⚠️ Profile Setup Required\n\nPlease complete your profile setup first to use auto-apply.\n\nGo to Profile → Application Settings');
        navigate('/profile');
      } else if (err.message.includes('Already applied')) {
        alert('ℹ️ You have already applied to this job.\n\nCheck your Agent Dashboard to see the status.');
        navigate('/dashboard');
      } else if (err.message.includes('cannot be auto-applied')) {
        alert('⚠️ This job requires manual application.\n\nThe ATS platform is too complex for auto-apply. You can still generate a tailored resume and apply manually.');
      } else {
        alert(`❌ Failed to queue application:\n\n${err.message}`);
      }
    } finally {
      setAutoApplying(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/home')}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--primary)' }}>
                <span className="text-white font-bold text-lg">B</span>
              </div>
              <span className="text-xl font-semibold" style={{ color: 'var(--text)' }}>BottleCap</span>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 text-sm font-medium transition-colors hover:opacity-70"
                style={{ color: 'var(--text)' }}
              >
                Dashboard
              </button>
              <button
                onClick={() => navigate('/profile')}
                className="px-4 py-2 text-sm font-medium transition-colors hover:opacity-70"
                style={{ color: 'var(--text)' }}
              >
                Profile
              </button>
              <UserButton />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pt-20 px-4 max-w-7xl mx-auto pb-12">
        {/* Search Bar */}
        <div className="mb-8 max-w-3xl mx-auto">
          <PromptBox onSearch={handleNewSearch} />
          {query && explanation && (
            <p className="mt-3 text-sm opacity-70" style={{ color: 'var(--text)' }}>
              {explanation}
            </p>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="max-w-3xl mx-auto mb-8 p-4 rounded-lg bg-red-50 border border-red-200">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mb-4" style={{ borderColor: 'var(--primary)' }}></div>
            <p className="text-lg font-medium" style={{ color: 'var(--text)' }}>Finding the best jobs for you...</p>
          </div>
        )}

        {/* Results */}
        {!isLoading && jobs.length > 0 && (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Job List */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text)' }}>
                {jobs.length} Jobs Found
              </h2>
              {jobs.map((job) => (
                <div
                  key={job.id}
                  onClick={() => setSelectedJob(job)}
                  className={`p-6 rounded-xl border-2 cursor-pointer transition-all hover:shadow-lg ${
                    selectedJob?.id === job.id ? 'ring-2 ring-primary' : ''
                  }`}
                  style={{
                    borderColor: selectedJob?.id === job.id ? 'var(--primary)' : '#e5e7eb',
                    backgroundColor: 'var(--background)'
                  }}
                >
                  {/* Badges */}
                  <div className="flex items-center gap-2 mb-3">
                    {job.aiApplyable && (
                      <div
                        className="px-3 py-1 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: 'var(--secondary)', color: 'white' }}
                      >
                        🤖 AI Can Apply
                      </div>
                    )}
                    {job.atsType && (
                      <div
                        className="px-2 py-1 rounded text-xs font-semibold"
                        style={{ backgroundColor: 'var(--accent)', color: 'white' }}
                      >
                        {job.atsType}
                      </div>
                    )}
                  </div>

                  {/* Job Info */}
                  <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>
                    {job.title}
                  </h3>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="font-semibold" style={{ color: 'var(--primary)' }}>
                      {job.company}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm opacity-70" style={{ color: 'var(--text)' }}>
                    <p>📍 {job.location}</p>
                    {job.salary && <p>💰 {job.salary}</p>}
                    <p>🕐 {formatPostedDate(job.postedDate)}</p>
                  </div>
                  <p className="mt-3 text-sm line-clamp-2" style={{ color: 'var(--text)' }}>
                    {htmlToPlainText(job.description)}
                  </p>
                </div>
              ))}
            </div>

            {/* Job Details Panel */}
            <div className="lg:sticky lg:top-24 h-fit">
              {selectedJob ? (
                <div
                  className="p-8 rounded-xl border-2"
                  style={{
                    borderColor: 'var(--primary)',
                    backgroundColor: 'var(--background)',
                  }}
                >
                  {/* Badges */}
                  <div className="flex items-center gap-2 mb-4">
                    {selectedJob.aiApplyable && (
                      <div
                        className="px-4 py-2 rounded-full text-sm font-bold"
                        style={{ backgroundColor: 'var(--secondary)', color: 'white' }}
                      >
                        🤖 AI Can Apply
                      </div>
                    )}
                    {selectedJob.atsType && (
                      <div
                        className="px-3 py-1 rounded text-sm font-semibold"
                        style={{ backgroundColor: 'var(--accent)', color: 'white' }}
                      >
                        {selectedJob.atsType}
                      </div>
                    )}
                  </div>

                  <h2 className="text-3xl font-bold mb-3" style={{ color: 'var(--text)' }}>
                    {selectedJob.title}
                  </h2>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xl font-semibold" style={{ color: 'var(--primary)' }}>
                      {selectedJob.company}
                    </span>
                  </div>

                  <div className="space-y-2 mb-6 text-sm" style={{ color: 'var(--text)' }}>
                    <p className="flex items-center gap-2">
                      <span className="text-lg">📍</span> {selectedJob.location}
                    </p>
                    {selectedJob.salary && (
                      <p className="flex items-center gap-2">
                        <span className="text-lg">💰</span> {selectedJob.salary}
                      </p>
                    )}
                    <p className="flex items-center gap-2">
                      <span className="text-lg">🕐</span> Posted {formatPostedDate(selectedJob.postedDate)}
                    </p>
                  </div>

                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text)' }}>
                      About the Role
                    </h3>
                    <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--text)' }}>
                      {htmlToPlainText(selectedJob.description)}
                    </p>
                  </div>

                  {selectedJob.requirements && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text)' }}>
                        Requirements
                      </h3>
                      <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--text)' }}>
                        {htmlToPlainText(selectedJob.requirements)}
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    {selectedJob.aiApplyable ? (
                      <button
                        onClick={() => handleAutoApply(selectedJob)}
                        disabled={autoApplying}
                        className="flex-1 py-3 px-6 rounded-lg font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: 'var(--primary)' }}
                      >
                        {autoApplying ? '⏳ Queueing...' : '🤖 Auto-Apply'}
                      </button>
                    ) : (
                      <button
                        onClick={() => window.open(selectedJob.applyUrl, '_blank')}
                        className="flex-1 py-3 px-6 rounded-lg font-semibold text-white transition-all hover:opacity-90"
                        style={{ backgroundColor: 'var(--primary)' }}
                      >
                        Apply Manually
                      </button>
                    )}
                    <button
                      onClick={() => navigate('/dashboard')}
                      className="py-3 px-6 rounded-lg font-semibold border-2 transition-all hover:opacity-70"
                      style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
                    >
                      📊 Dashboard
                    </button>
                  </div>

                  {selectedJob.aiApplyable && (
                    <p className="mt-4 text-xs text-center opacity-60" style={{ color: 'var(--text)' }}>
                      Auto-apply will submit your application automatically using AI
                    </p>
                  )}
                </div>
              ) : (
                <div
                  className="p-12 rounded-xl border-2 text-center"
                  style={{
                    borderColor: '#e5e7eb',
                    backgroundColor: 'var(--background)',
                  }}
                >
                  <div className="text-6xl mb-4">👈</div>
                  <p className="text-lg font-medium" style={{ color: 'var(--text)' }}>
                    Select a job to view details
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && jobs.length === 0 && query && !error && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>
              No jobs found
            </h3>
            <p className="opacity-70 mb-6" style={{ color: 'var(--text)' }}>
              Try adjusting your search query or try different keywords
            </p>
            <button
              onClick={() => navigate('/home')}
              className="px-6 py-3 rounded-lg font-semibold text-white transition-all hover:opacity-90"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              Back to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

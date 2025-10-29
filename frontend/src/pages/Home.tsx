import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import ModernLayout from '../layouts/ModernLayout';
import { PromptBox } from '../components/ui/chatgpt-prompt-input';
import JobCard from '../components/JobCard';
import JobDetailPanel from '../components/JobDetailPanel';
import {
  searchJobs,
  generateResume,
  checkResumeStatus,
  downloadResume,
  detectIntent,
  getJobs,
  getJobSuggestions,
  Job,
  ResumeStatusResponse,
} from '../services/api';
import Icons from '../components/ui/icons';

type ActionState = 'idle' | 'processing' | 'showing_jobs' | 'generating_resume';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [input, setInput] = useState('');
  const [state, setState] = useState<ActionState>('idle');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsTotal, setJobsTotal] = useState(0);
  const [searchExplanation, setSearchExplanation] = useState('');
  const [searchOffset, setSearchOffset] = useState(0);
  const [loadingMoreSearch, setLoadingMoreSearch] = useState(false);
  const [currentSearchQuery, setCurrentSearchQuery] = useState('');
  const [resumeJobId, setResumeJobId] = useState<string | null>(null);
  const [resumeStatus, setResumeStatus] = useState<ResumeStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Featured/Trending Jobs (shown when idle)
  const [featuredJobs, setFeaturedJobs] = useState<Job[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [featuredTotal, setFeaturedTotal] = useState(0);
  const [featuredOffset, setFeaturedOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  // Job Detail Modal
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setError(null);
    setState('processing');

    try {
      const intent = await detectIntent(input);

      if (intent.intent === 'resume' && intent.extractedData?.jobDescription) {
        setState('generating_resume');
        const result = await generateResume({
          jobDescription: intent.extractedData.jobDescription,
        });

        setResumeJobId(result.jobId);
        pollResumeStatus(result.jobId);
      } else {
        const searchQuery = intent.extractedData?.searchQuery || input;
        const result = await searchJobs(searchQuery, 24); // Load 24 jobs initially

        setJobs(result.jobs);
        setJobsTotal(result.total);
        setSearchExplanation(result.explanation);
        setSearchOffset(24);
        setCurrentSearchQuery(searchQuery);
        setState('showing_jobs');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setState('idle');
    }
  };

  const pollResumeStatus = async (jobId: string) => {
    const maxAttempts = 60;
    let attempts = 0;

    const poll = setInterval(async () => {
      attempts++;

      try {
        const status = await checkResumeStatus(jobId);
        setResumeStatus(status);

        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(poll);
        }

        if (attempts >= maxAttempts) {
          clearInterval(poll);
          setError('Resume generation timed out');
        }
      } catch (err) {
        clearInterval(poll);
        setError('Failed to check resume status');
      }
    }, 2000);
  };

  const handleDownloadResume = async () => {
    if (!resumeJobId) return;

    try {
      const blob = await downloadResume(resumeJobId, 'pdf');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `resume-${resumeJobId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError('Failed to download resume');
    }
  };

  const handleReset = () => {
    setInput('');
    setState('idle');
    setJobs([]);
    setJobsTotal(0);
    setSearchExplanation('');
    setSearchOffset(0);
    setCurrentSearchQuery('');
    setResumeJobId(null);
    setResumeStatus(null);
    setError(null);
  };

  // Load more search results
  const loadMoreSearchResults = async () => {
    if (loadingMoreSearch || jobs.length >= jobsTotal || !currentSearchQuery) return;

    setLoadingMoreSearch(true);
    try {
      const result = await searchJobs(currentSearchQuery, 24, searchOffset);

      setJobs([...jobs, ...result.jobs]);
      setSearchOffset(searchOffset + 24);
    } catch (err: any) {
      console.error('Failed to load more search results:', err);
      setError('Failed to load more results');
    } finally {
      setLoadingMoreSearch(false);
    }
  };

  // Load featured jobs and suggestions on mount
  useEffect(() => {
    const loadInitialData = async () => {
      setLoadingFeatured(true);
      try {
        const [jobsData, suggestionsData] = await Promise.all([
          getJobs({ filter: 'ai_applyable', limit: 24 }).catch(() => ({ jobs: [], total: 0, hasMore: false })),
          getJobSuggestions().catch(() => ({
            suggestions: [
              'remote software engineer jobs',
              'senior full stack developer positions',
              'frontend engineer roles at startups',
              'product manager opportunities'
            ],
            stats: {}
          }))
        ]);

        setFeaturedJobs(jobsData.jobs);
        setFeaturedTotal(jobsData.total);
        setFeaturedOffset(24);
        setSuggestions(suggestionsData.suggestions);
      } catch (err: any) {
        console.error('Failed to load featured jobs:', err);
        // Fallback suggestions if everything fails
        setSuggestions([
          'remote software engineer jobs',
          'senior full stack developer positions',
          'frontend engineer roles at startups',
          'product manager opportunities'
        ]);
      } finally {
        setLoadingFeatured(false);
      }
    };

    loadInitialData();
  }, []);

  // Load more featured jobs
  const loadMoreFeaturedJobs = async () => {
    if (loadingMore || featuredJobs.length >= featuredTotal) return;

    setLoadingMore(true);
    try {
      const jobsData = await getJobs({
        filter: 'ai_applyable',
        limit: 24,
        offset: featuredOffset
      });

      setFeaturedJobs([...featuredJobs, ...jobsData.jobs]);
      setFeaturedOffset(featuredOffset + 24);
    } catch (err: any) {
      console.error('Failed to load more jobs:', err);
      setError('Failed to load more jobs');
    } finally {
      setLoadingMore(false);
    }
  };

  const Icon = (name: keyof typeof Icons) => {
    const Component = Icons[name];
    return <Component className="w-5 h-5" />;
  };

  return (
    <ModernLayout>
      <div className="min-h-screen" style={{ backgroundColor: 'var(--background)', fontFamily: 'Inter, sans-serif' }}>
        <div className="max-w-4xl mx-auto px-6 py-12">
          {/* AI Input Section */}
          <div className="mb-8 max-w-4xl mx-auto">
            {/* Hero Section */}
            <div className="mb-4">
              <h1 className="text-3xl font-semibold" style={{ color: 'var(--text)' }}>
                Hi, <span style={{ color: 'var(--primary)' }}>{user?.firstName || 'there'}</span>. Let's find your job.
              </h1>
            </div>
            <form onSubmit={handleSubmit}>
              <PromptBox
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Try 'Find me jobs at SF startups' or 'Remote frontend developer roles' or paste a job description..."
                disabled={state === 'processing' || state === 'generating_resume'}
              />
            </form>

            {/* Status Message */}
            {state !== 'idle' && (
              <div className="mt-3 text-center">
                <span className="text-sm font-medium" style={{ color: 'var(--primary)' }}>
                  {state === 'processing' && 'Processing your request...'}
                  {state === 'showing_jobs' && `Found ${jobsTotal} matching jobs`}
                  {state === 'generating_resume' && 'Generating your tailored resume...'}
                </span>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="mt-3 p-3 rounded-xl border" style={{
                backgroundColor: 'var(--error-bg, #FEE2E2)',
                borderColor: 'var(--error)',
                color: 'var(--error-text, #991B1B)'
              }}>
                <div className="flex items-center gap-2 text-sm">
                  {Icon('alertCircle')}
                  <span className="font-medium">{error}</span>
                </div>
              </div>
            )}
          </div>


          {/* Job Results Section */}
          {state === 'showing_jobs' && jobs.length > 0 && (
            <div>
              {/* Results Header */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-3xl font-bold" style={{ color: 'var(--text)' }}>
                    {jobsTotal} Jobs Found
                  </h2>
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 rounded-xl font-medium transition-all hover:opacity-90 flex items-center gap-2"
                    style={{
                      backgroundColor: 'var(--background)',
                      color: 'var(--text)',
                      boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.08)',
                    }}
                  >
                    {Icon('search')}
                    <span>New Search</span>
                  </button>
                </div>
                <p className="text-base" style={{ color: 'var(--gray-600)' }}>
                  {searchExplanation}
                </p>
              </div>

              {/* Job Cards Grid */}
              <div className="space-y-4">
                {jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onGenerateResume={(selectedJob) => {
                      setInput(`Generate a resume for this job:\n\n${selectedJob.title} at ${selectedJob.company}\n\n${selectedJob.description}`);
                    }}
                    onViewJob={(url) => window.open(url, '_blank')}
                  />
                ))}
              </div>

              {/* Load More Button for Search Results */}
              {jobs.length < jobsTotal && (
                <div className="mt-8 text-center">
                  <button
                    onClick={loadMoreSearchResults}
                    disabled={loadingMoreSearch}
                    className="px-8 py-3 rounded-xl font-semibold transition-all hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
                    style={{
                      backgroundColor: 'var(--primary)',
                      color: 'var(--background)',
                    }}
                  >
                    {loadingMoreSearch ? (
                      <>
                        <div
                          className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
                          style={{ borderColor: 'var(--background)', borderTopColor: 'transparent' }}
                        />
                        <span>Loading...</span>
                      </>
                    ) : (
                      <>
                        {Icon('chevronDown')}
                        <span>Load More Results ({jobsTotal - jobs.length} remaining)</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Resume Generation Status */}
          {state === 'generating_resume' && resumeStatus && (
            <div className="p-8 rounded-2xl text-center" style={{
              backgroundColor: 'var(--background-elevated)',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
            }}>
              {resumeStatus.status === 'pending' && (
                <>
                  <div className="w-16 h-16 mx-auto mb-6">
                    <div
                      className="w-full h-full border-4 border-t-transparent rounded-full animate-spin"
                      style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }}
                    />
                  </div>
                  <p className="text-xl font-bold" style={{ color: 'var(--text)' }}>
                    Preparing your resume...
                  </p>
                </>
              )}

              {resumeStatus.status === 'processing' && (
                <>
                  <div className="w-16 h-16 mx-auto mb-6">
                    <div
                      className="w-full h-full border-4 border-t-transparent rounded-full animate-spin"
                      style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }}
                    />
                  </div>
                  <p className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>
                    Generating your tailored resume...
                  </p>
                  {resumeStatus.progress && (
                    <p className="text-sm text-gray-600">
                      {resumeStatus.progress}% complete
                    </p>
                  )}
                </>
              )}

              {resumeStatus.status === 'completed' && (
                <>
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: 'var(--success)' }}>
                    {Icon('check')}
                  </div>
                  <p className="text-xl font-bold mb-6" style={{ color: 'var(--text)' }}>
                    Resume generated successfully!
                  </p>
                  <button onClick={handleDownloadResume} className="px-6 py-3 rounded-xl font-medium transition-all hover:opacity-90 inline-flex items-center gap-2" style={{
                    backgroundColor: 'var(--primary)',
                    color: 'var(--background)',
                  }}>
                    {Icon('download')}
                    Download Resume (PDF)
                  </button>
                </>
              )}

              {resumeStatus.status === 'failed' && (
                <>
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: 'var(--error)' }}>
                    {Icon('x')}
                  </div>
                  <p className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>
                    Resume generation failed
                  </p>
                  <p className="text-sm text-gray-600">
                    {resumeStatus.error || 'Please try again'}
                  </p>
                </>
              )}
            </div>
          )}

          {/* Featured Jobs Section - Show when idle */}
          {state === 'idle' && (
            <div className="mt-12">
              {/* Search Suggestions */}
              {suggestions.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text)' }}>
                    Popular Searches
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.slice(0, 6).map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => setInput(suggestion)}
                        className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105"
                        style={{
                          backgroundColor: 'var(--primary-100)',
                          color: 'var(--primary)',
                        }}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Featured Jobs Grid */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
                    AI-Powered Jobs
                  </h2>
                  <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--primary)' }}>
                    {Icon('zap')}
                    <span className="font-semibold">
                      {featuredTotal > 0 ? `${featuredTotal.toLocaleString()} jobs with AI apply` : `${featuredJobs.length} jobs with AI apply`}
                    </span>
                  </div>
                </div>

                {loadingFeatured && (
                  <div className="flex items-center justify-center py-12">
                    <div
                      className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin"
                      style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }}
                    />
                  </div>
                )}

                {!loadingFeatured && featuredJobs.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {featuredJobs.map((job) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        compact={true}
                        onClick={(clickedJob) => {
                          setSelectedJob(clickedJob);
                          setIsModalOpen(true);
                        }}
                        onGenerateResume={(selectedJob) => {
                          setInput(`Generate a resume for this job:\n\n${selectedJob.title} at ${selectedJob.company}\n\n${selectedJob.description}`);
                        }}
                        onViewJob={(url) => window.open(url, '_blank')}
                      />
                    ))}
                  </div>
                )}

                {!loadingFeatured && featuredJobs.length === 0 && (
                  <div className="p-12 rounded-2xl text-center" style={{
                    backgroundColor: 'var(--background-elevated)',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
                  }}>
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{
                      backgroundColor: 'var(--primary-100)',
                      color: 'var(--primary)',
                    }}>
                      {Icon('search')}
                    </div>
                    <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text)' }}>
                      Start Your Job Search
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Try searching for jobs using the search bar above
                    </p>
                    <p className="text-sm text-gray-500">
                      Example: "remote software engineer" or "product manager in SF"
                    </p>
                  </div>
                )}

                {/* Load More Button */}
                {!loadingFeatured && featuredJobs.length > 0 && featuredJobs.length < featuredTotal && (
                  <div className="mt-8 text-center">
                    <button
                      onClick={loadMoreFeaturedJobs}
                      disabled={loadingMore}
                      className="px-8 py-3 rounded-xl font-semibold transition-all hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
                      style={{
                        backgroundColor: 'var(--primary)',
                        color: 'var(--background)',
                      }}
                    >
                      {loadingMore ? (
                        <>
                          <div
                            className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
                            style={{ borderColor: 'var(--background)', borderTopColor: 'transparent' }}
                          />
                          <span>Loading...</span>
                        </>
                      ) : (
                        <>
                          {Icon('chevronDown')}
                          <span>Load More Jobs ({featuredTotal - featuredJobs.length} remaining)</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Job Detail Side Panel */}
      <JobDetailPanel
        job={selectedJob}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedJob(null);
        }}
        onGenerateResume={(job) => {
          setInput(`Generate a resume for this job:\n\n${job.title} at ${job.company}\n\n${job.description}`);
        }}
        onApply={(url) => window.open(url, '_blank')}
      />

      {/* Backdrop when panel is open */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 z-40 transition-opacity"
          onClick={() => {
            setIsModalOpen(false);
            setSelectedJob(null);
          }}
        />
      )}
    </ModernLayout>
  );
}

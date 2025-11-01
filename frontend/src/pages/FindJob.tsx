import { useState, useMemo, useEffect, useCallback, useRef, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import Card from '../ui/Card';
import { useAuth } from '@clerk/clerk-react';
import type { Job as JobType, GetJobsResponse } from '../services/api';
import JobCard from '../components/JobCard';
import JobDetailPanel from '../components/JobDetailPanel';
import logger from '../utils/logger';
import MinimalSearch from '../components/MinimalSearch';

const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';
const PAGE_SIZE = 50;

type JobWithExtras = JobType & {
  logoUrl?: string | null;
  jobType?: string | null;
  tags?: string[] | null;
  salaryRange?: string | null;
  remote?: boolean | null;
};

type SearchMeta = {
  query: string;
  offset: number;
  hasMore: boolean;
};

type BrowseMeta = {
  offset: number;
  hasMore: boolean;
};

const buildUrl = (path: string) => (API_BASE_URL ? `${API_BASE_URL}${path}` : path);

function useDebouncedValue<T>(value: T, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      window.clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

function normalizeJob(job: JobWithExtras): JobWithExtras {
  return {
    ...job,
    title: job.title ?? 'Untitled role',
    company: job.company ?? 'Unknown Company',
    location: job.location ?? 'Location not specified',
    description: job.description ?? '',
    requirements: job.requirements ?? '',
    applyUrl: job.applyUrl ?? '',
  };
}

function formatPostedDate(date: string | null | undefined) {
  if (!date) {
    return 'Recently posted';
  }

  const postedDate = new Date(date);
  if (Number.isNaN(postedDate.getTime())) {
    return 'Recently posted';
  }

  const now = new Date();
  const diffMs = now.getTime() - postedDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return 'Today';
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months === 1 ? '' : 's'} ago`;
  }

  const years = Math.floor(diffDays / 365);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

function truncate(text: string, maxLength = 180) {
  if (!text) {
    return '';
  }
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength).trim()}…`;
}

export default function FindJob() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialQueryRef = useRef(searchParams.get('q')?.trim() ?? '');
  const [searchInput, setSearchInput] = useState(initialQueryRef.current);
  const [activeQuery, setActiveQuery] = useState(initialQueryRef.current);
  const [mode, setMode] = useState<'browse' | 'search'>(initialQueryRef.current ? 'search' : 'browse');
  const [jobs, setJobs] = useState<JobWithExtras[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobWithExtras | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [explanation, setExplanation] = useState('');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [autoApplying, setAutoApplying] = useState(false);
  const [savedJobs, setSavedJobs] = useState<Record<string, boolean>>({});
  const [hoveredJobId, setHoveredJobId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [browseMeta, setBrowseMeta] = useState<BrowseMeta>({ offset: 0, hasMore: false });
  const [searchMeta, setSearchMeta] = useState<SearchMeta>({ query: initialQueryRef.current, offset: initialQueryRef.current ? PAGE_SIZE : 0, hasMore: false });
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const debouncedSearch = useDebouncedValue(searchInput, 500);
  const requestIdRef = useRef(0);
  const skipDebounceRef = useRef(Boolean(initialQueryRef.current));
  const lastUrlQueryRef = useRef(initialQueryRef.current);

  const filteredJobs = useMemo(() => {
    if (!remoteOnly) {
      return jobs;
    }

    return jobs.filter(job => {
      const location = job.location?.toLowerCase() ?? '';
      return location.includes('remote') || location.includes('anywhere');
    });
  }, [jobs, remoteOnly]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const updateBreakpoint = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);
    return () => window.removeEventListener('resize', updateBreakpoint);
  }, []);

  useEffect(() => {
    if (filteredJobs.length === 0) {
      if (selectedJob) {
        setSelectedJob(null);
      }
      return;
    }

    if (!selectedJob || !filteredJobs.some(job => job.id === selectedJob.id)) {
      setSelectedJob(filteredJobs[0]);
    }
  }, [filteredJobs, selectedJob]);

  const fetchJobs = useCallback(
    async ({ offset = 0, append = false }: { offset?: number; append?: boolean } = {}) => {
      const requestId = ++requestIdRef.current;

      if (append) {
        setIsLoadingMore(true);
      } else {
        setLoading(true);
      }

      setError('');

      try {
        const token = await getToken();

        if (!token) {
          throw new Error('Authentication required. Please sign in again.');
        }

        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
        };

        const response = await fetch(buildUrl(`/api/jobs?limit=${PAGE_SIZE}&offset=${offset}`), {
          headers,
        });

        if (!response.ok) {
          throw new Error('Failed to load jobs');
        }

        const data = (await response.json()) as GetJobsResponse;
        logger.debug('API Response', { total: data.total, jobCount: data.jobs?.length });
        if (requestId !== requestIdRef.current) {
          return;
        }

        const normalized = (data.jobs || []).map(job => normalizeJob(job as JobWithExtras));

        setBrowseMeta({
          offset: offset + PAGE_SIZE,
          hasMore: Boolean(data.hasMore),
        });

        setJobs(prev => (append ? [...prev, ...normalized] : normalized));

        if (!append) {
          setSelectedJob(normalized[0] ?? null);
        }

        if (!append) {
          setMode('browse');
          setActiveQuery('');
          setExplanation('');
          setSearchMeta({ query: '', offset: 0, hasMore: false });
          lastUrlQueryRef.current = '';
          setSearchParams({});
        }
      } catch (err) {
        if (requestId === requestIdRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to load jobs');
          if (!append) {
            setJobs([]);
            setSelectedJob(null);
          }
        }
      } finally {
        if (requestId === requestIdRef.current) {
          if (append) {
            setIsLoadingMore(false);
          } else {
            setLoading(false);
          }
        }
      }
    },
    [getToken, setSearchParams]
  );

  const runSearch = useCallback(
    async (
      query: string,
      { offset = 0, append = false }: { offset?: number; append?: boolean } = {}
    ) => {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) {
        return;
      }

      const requestId = ++requestIdRef.current;

      if (append) {
        setIsLoadingMore(true);
      } else {
        setLoading(true);
      }

      setError('');
      setMode('search');
      setActiveQuery(trimmedQuery);
      lastUrlQueryRef.current = trimmedQuery;
      setSearchParams(trimmedQuery ? { q: trimmedQuery } : {});

      try {
        const token = await getToken();

        if (!token) {
          throw new Error('Authentication required. Please sign in again.');
        }

        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
        };

        // Use simple search with query parameter instead of AI search
        const searchUrl = buildUrl(`/api/jobs?search=${encodeURIComponent(trimmedQuery)}&limit=${PAGE_SIZE}&offset=${offset}`);
        logger.debug('Making API call to /api/jobs with search', { query: trimmedQuery, limit: PAGE_SIZE, offset });

        const response = await fetch(searchUrl, { headers });

        if (!response.ok) {
          throw new Error('Failed to search jobs');
        }

        const data = (await response.json()) as GetJobsResponse;
        logger.debug('Search API Response', {
          totalResults: data.total,
          jobsCount: data.jobs?.length,
          hasMore: data.hasMore,
          isAppend: append
        });

        if (requestId !== requestIdRef.current) {
          return;
        }

        const normalized = (data.jobs || []).map(job => normalizeJob(job as JobWithExtras));

        // Simple explanation for search results
        setExplanation(`Found ${data.total} job${data.total === 1 ? '' : 's'} matching "${trimmedQuery}"`);

        logger.debug('Updating jobs state', {
          append,
          previousCount: jobs.length,
          newJobsCount: normalized.length,
          willResultIn: append ? jobs.length + normalized.length : normalized.length
        });
        setJobs(prev => (append ? [...prev, ...normalized] : normalized));

        if (!append) {
          setSelectedJob(normalized[0] ?? null);
        }

        setSearchMeta({
          query: trimmedQuery,
          offset: offset + PAGE_SIZE,
          hasMore: Boolean(data.hasMore),
        });
      } catch (err) {
        if (requestId === requestIdRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to search jobs');
          if (!append) {
            setJobs([]);
            setSelectedJob(null);
            setExplanation('');
          }
        }
      } finally {
        if (requestId === requestIdRef.current) {
          if (append) {
            setIsLoadingMore(false);
          } else {
            setLoading(false);
          }
        }
      }
    },
    [getToken, setSearchParams, jobs.length]
  );

  useEffect(() => {
    if (initialQueryRef.current) {
      runSearch(initialQueryRef.current, { offset: 0, append: false });
    } else {
      fetchJobs({ offset: 0, append: false });
    }
  }, [fetchJobs, runSearch]);

  useEffect(() => {
    logger.debug('[RUNTIME] Mounted: FindJob');
  }, []);

  useEffect(() => {
    const urlQuery = searchParams.get('q')?.trim() ?? '';
    if (urlQuery === lastUrlQueryRef.current) {
      return;
    }

    lastUrlQueryRef.current = urlQuery;
    skipDebounceRef.current = true;
    setSearchInput(urlQuery);

    if (urlQuery) {
      setMode('search');
      setActiveQuery(urlQuery);
      runSearch(urlQuery, { offset: 0, append: false });
    } else {
      setMode('browse');
      setActiveQuery('');
      setExplanation('');
      setSearchMeta({ query: '', offset: 0, hasMore: false });
      fetchJobs({ offset: 0, append: false });
    }
  }, [searchParams, runSearch, fetchJobs]);

  useEffect(() => {
    const trimmed = debouncedSearch.trim();

    if (skipDebounceRef.current) {
      skipDebounceRef.current = false;
      return;
    }

    if (!trimmed) {
      if (mode === 'search' || activeQuery) {
        setMode('browse');
        setActiveQuery('');
        setExplanation('');
        setSearchMeta({ query: '', offset: 0, hasMore: false });
        lastUrlQueryRef.current = '';
        setSearchParams({});
        fetchJobs({ offset: 0, append: false });
      }
      return;
    }

    runSearch(trimmed, { offset: 0, append: false });
  }, [debouncedSearch, mode, activeQuery, runSearch, fetchJobs, setSearchParams]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = searchInput.trim();

    if (!trimmed) {
      handleClearSearch();
      return;
    }

    skipDebounceRef.current = true;
    runSearch(trimmed, { offset: 0, append: false });
  };

  const handleClearSearch = () => {
    skipDebounceRef.current = true;
    setSearchInput('');
    setMode('browse');
    setActiveQuery('');
    setExplanation('');
    setSearchMeta({ query: '', offset: 0, hasMore: false });
    lastUrlQueryRef.current = '';
    setSearchParams({});
    fetchJobs({ offset: 0, append: false });
  };

  const toggleRemoteOnly = () => {
    setRemoteOnly(prev => !prev);
  };

  const toggleSaveJob = (jobId: string) => {
    setSavedJobs(prev => {
      const next = { ...prev };
      if (next[jobId]) {
        delete next[jobId];
      } else {
        next[jobId] = true;
      }
      return next;
    });
  };

  const handleLoadMore = () => {
    if (mode === 'search' && activeQuery) {
      runSearch(activeQuery, { offset: searchMeta.offset, append: true });
    } else {
      fetchJobs({ offset: browseMeta.offset, append: true });
    }
  };

  const handleRetry = () => {
    setError('');
    if (mode === 'search' && activeQuery) {
      skipDebounceRef.current = true;
      runSearch(activeQuery, { offset: 0, append: false });
    } else {
      fetchJobs({ offset: 0, append: false });
    }
  };

  const handleAutoApply = async (job: JobWithExtras) => {
    setAutoApplying(true);
    try {
      const token = await getToken();

      if (!token) {
        window.alert('Please sign in again to auto-apply for this job.');
        navigate('/auth');
        return;
      }

      const response = await fetch(buildUrl('/api/auto-apply'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ jobId: job.id }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to queue application');
      }

      const result = await response.json();

      if (result.success) {
        window.alert(
          `✅ Application queued successfully!\n\nApplication ID: ${result.applicationId}\nStatus: ${result.status}\n${result.message}\n\nCheck your Agent Dashboard to track progress.`
        );
        navigate('/dashboard');
      } else {
        window.alert('Failed to queue application. Please try again.');
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('No resume found') || err.message.includes('upload a resume') || err.message.includes('Profile not found') || err.message.includes('Application data not configured')) {
          window.alert(
            '⚠️ Auto-Apply setup required.\n\nPlease complete your auto-apply setup:\n1. Fill out application questions\n2. Upload a resume PDF\n\nGo to: Auto-Apply → Complete Setup'
          );
          navigate('/application-questions');
        } else if (err.message.includes('Already applied')) {
          window.alert('ℹ️ You have already applied to this job. Check your Agent Dashboard for status updates.');
          navigate('/dashboard');
        } else if (err.message.includes('cannot be auto-applied')) {
          window.alert('⚠️ This job requires a manual application. You can still generate a tailored resume and apply manually.');
        } else {
          window.alert(`❌ Failed to queue application:\n\n${err.message}`);
        }
      } else {
        window.alert('❌ Failed to queue application. Please try again later.');
      }
    } finally {
      setAutoApplying(false);
    }
  };

  const canLoadMore = mode === 'search' ? searchMeta.hasMore : browseMeta.hasMore;
  const isInitialLoading = loading && !isLoadingMore;
  const showEmptyState = !isInitialLoading && !error && filteredJobs.length === 0;

  // Tailwind replaces previous inline style objects

  return (
    <div className="flex-1 w-full bg-background min-h-screen text-text font-sans">
      {/* Minimal Search Header */}
      <MinimalSearch
        value={searchInput}
        onChange={setSearchInput}
        onSubmit={() => {
          const trimmed = searchInput.trim();
          if (trimmed) {
            skipDebounceRef.current = true;
            runSearch(trimmed, { offset: 0, append: false });
          }
        }}
        title="Find your next opportunity"
      />

      <div className="max-w-[1160px] mx-auto flex flex-col gap-4 px-4 lg:px-6 pb-8">
        <div className="flex flex-col gap-3">

          {/* Filters and Count */}
          <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-[rgba(12,19,16,0.06)]">
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={toggleRemoteOnly}
                className={`rounded-full px-[14px] py-[6px] text-[13px] font-medium cursor-pointer transition ${remoteOnly ? 'border border-primary bg-[var(--primary-50)] text-primary' : 'border border-[rgba(12,19,16,0.12)] bg-white text-accent'}`}
              >
                {remoteOnly ? 'Remote only: On' : 'Remote only: Off'}
              </button>
              {mode === 'search' && activeQuery && (
                <span className="text-[13px] text-[var(--gray-600)]">"{activeQuery}"</span>
              )}
            </div>

            <div className="text-[13px] text-[var(--gray-600)] font-semibold">
              {filteredJobs.length} {filteredJobs.length === 1 ? 'role' : 'roles'}
            </div>
          </div>

          {mode === 'search' && explanation && (
            <div className="text-xs text-primary">{explanation}</div>
          )}
        </div>

        <div className={`${selectedJob && isDetailOpen ? 'md:flex' : 'grid'} gap-4 items-start ${selectedJob && isDetailOpen ? '' : 'grid-cols-1'} transition-all duration-300`}>
          <div className={`${isMobile ? 'flex flex-col gap-4 pr-0' : 'pr-1'} overflow-hidden ${selectedJob && isDetailOpen && !isMobile ? 'md:w-[620px] md:flex-none' : ''}`}>
            <div className={`${isMobile ? 'flex flex-col gap-4' : selectedJob && isDetailOpen ? 'flex flex-col gap-3 max-h-[calc(100vh-260px)] overflow-y-auto pr-1.5' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[calc(100vh-260px)] overflow-y-auto pr-1.5'}`}>
              {isInitialLoading && (
                <>
                  {Array.from({ length: isMobile ? 4 : 6 }).map((_, index) => (
                  <div key={`skeleton-${index}`} className="bg-elevated rounded-2xl border border-[rgba(28,63,64,0.12)] p-5 shadow-sm flex flex-col gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-[var(--primary-50)] opacity-60" />
                    <div className="flex flex-col gap-3">
                      <div className="w-[70%] h-[18px] rounded-lg bg-[rgba(28,63,64,0.12)] opacity-60" />
                      <div className="w-1/2 h-[14px] rounded-lg bg-[rgba(28,63,64,0.12)] opacity-60" />
                      <div className="w-[85%] h-3 rounded-md bg-[rgba(28,63,64,0.10)] opacity-60" />
                    </div>
                  </div>
                  ))}
                </>
              )}

              {!isInitialLoading && filteredJobs.map(job => (
                <Card key={job.id} className={`${selectedJob?.id === job.id ? 'border-primary-600' : ''}`}>
                  <JobCard
                    job={job}
                    compact={!isMobile}
                    onClick={() => { setSelectedJob(job); setIsDetailOpen(true); }}
                    onGenerateResume={() => navigate('/generate', { state: { jobId: job.id } })}
                    onViewJob={(url) => window.open(url, '_blank', 'noopener')}
                    onAutoApply={(jobId) => handleAutoApply(job)}
                  />
                </Card>
              ))}

              {showEmptyState && (
                <div className="bg-elevated rounded-2xl border border-[rgba(28,63,64,0.12)] p-10 text-center text-[var(--gray-600)] shadow-md">
                  <div className="text-[40px] mb-3">🔍</div>
                  <h3 className="text-xl font-semibold mb-2 text-text">No jobs match your filters</h3>
                  <p className="text-sm mb-5">Try broadening your search or turning off filters to see more opportunities.</p>
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="px-6 py-3 rounded-xl border-0 bg-primary text-white font-semibold cursor-pointer shadow-[0_6px_18px_rgba(62,172,167,0.25)]"
                  >
                    Reset search
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="mt-2 bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.3)] rounded-xl p-4 flex items-center justify-between gap-3 text-[#b91c1c] text-sm">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="px-4 py-2 rounded-lg border-0 bg-primary text-white font-semibold cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {canLoadMore && !error && (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className={`mt-3 px-5 py-3 rounded-xl border border-[rgba(28,63,64,0.16)] bg-elevated text-accent font-semibold transition ${isLoadingMore ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              >
                {isLoadingMore ? 'Loading more jobs…' : 'Load more jobs'}
              </button>
            )}
          </div>

          {/* Job Detail Panel - Side by Side on Desktop */}
          {selectedJob && isDetailOpen && !isMobile && (
            <div className="sticky top-[180px] self-start">
              <JobDetailPanel
                job={selectedJob as any}
                isOpen={true}
                onClose={() => setIsDetailOpen(false)}
                onGenerateResume={(job) => navigate('/generate', { state: { jobId: job.id } })}
                onApply={(url) => window.open(url, '_blank', 'noopener')}
                onAutoApply={(job) => handleAutoApply(job as any)}
                isSidePanel={true}
              />
            </div>
          )}
        </div>
      </div>

      {/* Mobile Overlay Detail Panel */}
      {isMobile && (
        <JobDetailPanel
          job={selectedJob as any}
          isOpen={Boolean(selectedJob) && isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          onGenerateResume={(job) => navigate('/generate', { state: { jobId: job.id } })}
          onApply={(url) => window.open(url, '_blank', 'noopener')}
          onAutoApply={(job) => handleAutoApply(job as any)}
          isSidePanel={false}
        />
      )}
    </div>
  );
}
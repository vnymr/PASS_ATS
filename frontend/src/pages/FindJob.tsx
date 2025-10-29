import { useState, useMemo, useEffect, useCallback, useRef, type FormEvent, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import type { Job as JobType, GetJobsResponse, JobSearchResult } from '../services/api';
import JobCard from '../components/JobCard';
import JobDetailPanel from '../components/JobDetailPanel';

const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';
const PAGE_SIZE = 20;

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
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        };

        const response = await fetch(buildUrl('/api/ai-search'), {
          method: 'POST',
          headers,
          body: JSON.stringify({ query: trimmedQuery, limit: PAGE_SIZE, offset }),
        });

        if (!response.ok) {
          throw new Error('Failed to search jobs');
        }

        const data = (await response.json()) as JobSearchResult;
        if (requestId !== requestIdRef.current) {
          return;
        }

        const normalized = (data.jobs || []).map(job => normalizeJob(job as JobWithExtras));

        setExplanation(data.explanation || '');
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
    [getToken, setSearchParams]
  );

  useEffect(() => {
    if (initialQueryRef.current) {
      runSearch(initialQueryRef.current, { offset: 0, append: false });
    } else {
      fetchJobs({ offset: 0, append: false });
    }
  }, [fetchJobs, runSearch]);

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
        if (err.message.includes('Profile not found') || err.message.includes('Application data not configured')) {
          window.alert(
            '⚠️ Profile setup required. Please complete your profile (Profile → Application Settings) before using auto-apply.'
          );
          navigate('/profile');
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

  const jobListContainerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    overflow: 'hidden',
    paddingRight: isMobile ? 0 : '4px',
  };

  const jobScrollAreaStyle: CSSProperties = isMobile
    ? {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }
    : {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        maxHeight: 'calc(100vh - 260px)',
        overflowY: 'auto',
        paddingRight: '6px',
      };

  const detailPanelStyle: CSSProperties = {
    position: 'relative',
    alignSelf: 'flex-start',
  };

  const searchWrapperStyle: CSSProperties = {
    position: 'sticky',
    top: '72px',
    zIndex: 10,
    backgroundColor: 'var(--background)',
    padding: isMobile ? '12px 0 16px' : '16px 0 20px',
    borderBottom: '1px solid rgba(12, 19, 16, 0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  };

  const searchBarStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: '#ffffff',
    border: '1px solid rgba(12, 19, 16, 0.1)',
    borderRadius: '999px',
    padding: isMobile ? '12px 16px' : '16px 28px',
    boxShadow: '0 10px 30px rgba(12, 19, 16, 0.08)',
    minHeight: '64px',
    color: 'var(--text)',
  };

  const searchInputStyle: CSSProperties = {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '15px',
    background: 'transparent',
    color: 'var(--text)',
    fontWeight: 500,
    caretColor: 'var(--primary)',
  };

  const searchActionsStyle: CSSProperties = {
    display: 'flex',
    alignItems: isMobile ? 'flex-start' : 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
  };

  const filterGroupStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  };

  const searchFormStyle: CSSProperties = {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: 'stretch',
    gap: isMobile ? '8px' : '12px',
  };

  const searchButtonStyle: CSSProperties = {
    padding: isMobile ? '12px 20px' : '16px 32px',
    borderRadius: '999px',
    border: 'none',
    background: 'var(--primary)',
    color: '#ffffff',
    fontWeight: 600,
    fontSize: '15px',
    cursor: 'pointer',
    boxShadow: '0 8px 16px rgba(62, 172, 167, 0.18)',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    alignSelf: isMobile ? 'stretch' : 'center',
  };

  const clearButtonStyle: CSSProperties = {
    border: 'none',
    background: '#f5f7f7',
    color: 'var(--gray-600)',
    cursor: 'pointer',
    fontSize: '13px',
    padding: '6px 14px',
    borderRadius: '999px',
    fontWeight: 500,
  };

  const searchIconStyle: CSSProperties = {
    fontSize: '18px',
    color: 'var(--accent)',
    display: 'flex',
    alignItems: 'center',
  };

  return (
    <div
      style={{
        flex: 1,
        width: '100%',
        padding: isMobile ? '72px 16px 24px' : '88px 24px 32px',
        backgroundColor: 'var(--background)',
        minHeight: 'calc(100vh - 64px)',
        color: 'var(--text)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '1160px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={searchWrapperStyle}>
          <form onSubmit={handleSearchSubmit} style={searchFormStyle}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={searchBarStyle}>
                <span style={searchIconStyle}>🔍</span>
                <input
                  value={searchInput}
                  onChange={event => setSearchInput(event.target.value)}
                  placeholder="Search by job title, company, or skills…"
                  style={searchInputStyle}
                />
                {mode === 'search' && loading && !isLoadingMore && (
                  <div className="animate-spin" style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid rgba(62, 172, 167, 0.35)', borderTopColor: 'var(--primary)' }} />
                )}
                {searchInput && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    style={clearButtonStyle}
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            <button type="submit" style={searchButtonStyle}>
              Search
            </button>
          </form>

          <div style={searchActionsStyle}>
            <div style={filterGroupStyle}>
              <button
                type="button"
                onClick={toggleRemoteOnly}
                style={{
                  borderRadius: '999px',
                  padding: '6px 14px',
                  border: remoteOnly ? '1px solid var(--primary)' : '1px solid rgba(12, 19, 16, 0.12)',
                  background: remoteOnly ? 'var(--primary-50)' : '#ffffff',
                  color: remoteOnly ? 'var(--primary)' : 'var(--accent)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {remoteOnly ? 'Remote only: On' : 'Remote only: Off'}
              </button>
              {mode === 'search' && activeQuery && (
                <span style={{ fontSize: '13px', color: 'var(--gray-600)' }}>“{activeQuery}”</span>
              )}
            </div>

            <div style={{ fontSize: '13px', color: 'var(--gray-600)', fontWeight: 600 }}>
              {filteredJobs.length} {filteredJobs.length === 1 ? 'role' : 'roles'}
            </div>
          </div>

          {mode === 'search' && explanation && (
            <div
              style={{
                fontSize: '12px',
                color: 'var(--primary)',
              }}
            >
              {explanation}
            </div>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '16px',
            alignItems: 'flex-start',
          }}
        >
          <div style={jobListContainerStyle}>
            <div style={jobScrollAreaStyle}>
              {isInitialLoading && (
                <>
                  {Array.from({ length: isMobile ? 4 : 6 }).map((_, index) => (
                    <div
                      key={`skeleton-${index}`}
                      style={{
                        backgroundColor: 'var(--background-elevated)',
                        borderRadius: '16px',
                        border: '1px solid rgba(28, 63, 64, 0.12)',
                        padding: '20px',
                        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                      }}
                    >
                      <div
                        style={{
                          width: '64px',
                          height: '64px',
                          borderRadius: '16px',
                          background: 'var(--primary-50)',
                          opacity: 0.6,
                        }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div
                          style={{
                            width: '70%',
                            height: '18px',
                            borderRadius: '8px',
                            background: 'rgba(28, 63, 64, 0.12)',
                            opacity: 0.6,
                          }}
                        />
                        <div
                          style={{
                            width: '50%',
                            height: '14px',
                            borderRadius: '8px',
                            background: 'rgba(28, 63, 64, 0.12)',
                            opacity: 0.6,
                          }}
                        />
                        <div
                          style={{
                            width: '85%',
                            height: '12px',
                            borderRadius: '6px',
                            background: 'rgba(28, 63, 64, 0.1)',
                            opacity: 0.6,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </>
              )}

              {!isInitialLoading && filteredJobs.map(job => (
                <div key={job.id} style={{ border: selectedJob?.id === job.id ? '2px solid var(--primary)' : '1px solid rgba(12, 19, 16, 0.08)', borderRadius: '16px' }}>
                  <JobCard
                    job={job}
                    onClick={() => { setSelectedJob(job); setIsDetailOpen(true); }}
                    onGenerateResume={() => navigate('/generate-resume', { state: { jobId: job.id } })}
                    onViewJob={(url) => window.open(url, '_blank', 'noopener')}
                    onAutoApply={(jobId) => handleAutoApply(job)}
                  />
                </div>
              ))}

              {showEmptyState && (
                <div
                  style={{
                    backgroundColor: 'var(--background-elevated)',
                    borderRadius: '20px',
                    border: '1px solid rgba(28, 63, 64, 0.12)',
                    padding: '40px',
                    textAlign: 'center',
                    color: 'var(--gray-600)',
                    boxShadow: '0 2px 16px rgba(0, 0, 0, 0.06)',
                  }}
                >
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔍</div>
                  <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px', color: 'var(--text)' }}>
                    No jobs match your filters
                  </h3>
                  <p style={{ fontSize: '14px', marginBottom: '20px' }}>
                    Try broadening your search or turning off filters to see more opportunities.
                  </p>
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '12px',
                      border: 'none',
                      background: 'var(--primary)',
                      color: '#ffffff',
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 6px 18px rgba(62, 172, 167, 0.25)',
                    }}
                  >
                    Reset search
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div
                style={{
                  marginTop: '8px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '14px',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  color: '#b91c1c',
                  fontSize: '14px',
                }}
              >
                <span>{error}</span>
                <button
                  type="button"
                  onClick={handleRetry}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'var(--primary)',
                    color: '#ffffff',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
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
                style={{
                  marginTop: '12px',
                  padding: '12px 20px',
                  borderRadius: '14px',
                  border: '1px solid rgba(28, 63, 64, 0.16)',
                  background: 'var(--background-elevated)',
                  color: 'var(--accent)',
                  fontWeight: 600,
                  cursor: isLoadingMore ? 'not-allowed' : 'pointer',
                  opacity: isLoadingMore ? 0.6 : 1,
                  transition: 'all 0.2s ease',
                }}
              >
                {isLoadingMore ? 'Loading more jobs…' : 'Load more jobs'}
              </button>
            )}
          </div>

          <div style={detailPanelStyle} />
        </div>
      </div>
      <JobDetailPanel
        job={selectedJob as any}
        isOpen={Boolean(selectedJob) && isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onGenerateResume={(job) => navigate('/generate-resume', { state: { jobId: job.id } })}
        onApply={(url) => window.open(url, '_blank', 'noopener')}
        onAutoApply={(job) => handleAutoApply(job as any)}
      />
    </div>
  );
}
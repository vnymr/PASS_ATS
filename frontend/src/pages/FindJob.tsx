import { useState, useMemo, useEffect, useCallback, useRef, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import type { Job as JobType, GetJobsResponse } from '../services/api';
import JobCardSimple from '../components/JobCardSimple';
import JobDetailPanel from '../components/JobDetailPanel';
import JobDetailPanelSimple from '../components/JobDetailPanelSimple';
import logger from '../utils/logger';
import JobFilterPanel, { type JobFilters } from '../components/JobFilterPanel';
import { api } from '../api-clerk';
import { Search } from 'lucide-react';

const API_BASE_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '').trim();
const PAGE_SIZE = 20; // Reduced for lazy loading

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
  total: number;
};

type BrowseMeta = {
  offset: number;
  hasMore: boolean;
  total: number;
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
  const [error, setError] = useState('');
  const [explanation, setExplanation] = useState('');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [autoApplying, setAutoApplying] = useState(false);
  const [savedJobs, setSavedJobs] = useState<Record<string, boolean>>({});
  const [hoveredJobId, setHoveredJobId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [generatingResumes, setGeneratingResumes] = useState<Record<string, boolean>>({});
  const [generatedResumes, setGeneratedResumes] = useState<Record<string, string>>({});
  const [browseMeta, setBrowseMeta] = useState<BrowseMeta>({ offset: 0, hasMore: false, total: 0 });
  const [searchMeta, setSearchMeta] = useState<SearchMeta>({ query: initialQueryRef.current, offset: 0, hasMore: false, total: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<JobFilters>({});
  const [sortBy, setSortBy] = useState<'recommended' | 'latest' | 'salary'>('recommended');

  const debouncedSearch = useDebouncedValue(searchInput, 500);
  const requestIdRef = useRef(0);
  const skipDebounceRef = useRef(Boolean(initialQueryRef.current));
  const lastUrlQueryRef = useRef(initialQueryRef.current);

  const filteredJobs = useMemo(() => {
    let result = jobs;

    // Filter for remote only if enabled
    if (remoteOnly) {
      result = result.filter(job => {
        const location = job.location?.toLowerCase() ?? '';
        return location.includes('remote') || location.includes('anywhere');
      });
    }

    // Sort based on selected option
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'recommended':
          // Sort by relevance score (highest first)
          const scoreA = a.relevanceScore ?? 0;
          const scoreB = b.relevanceScore ?? 0;
          return scoreB - scoreA;
        case 'latest':
          // Sort by posted date (newest first)
          const dateA = a.postedDate ? new Date(a.postedDate).getTime() : 0;
          const dateB = b.postedDate ? new Date(b.postedDate).getTime() : 0;
          return dateB - dateA;
        case 'salary':
          // Sort by salary (highest first) - extract number from salary string
          const salaryA = parseInt(a.salary?.replace(/[^0-9]/g, '') || '0') || 0;
          const salaryB = parseInt(b.salary?.replace(/[^0-9]/g, '') || '0') || 0;
          return salaryB - salaryA;
        default:
          return 0;
      }
    });

    return result;
  }, [jobs, remoteOnly, sortBy]);

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
    async ({ offset = 0, append = false, filters }: { offset?: number; append?: boolean; filters?: JobFilters } = {}) => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setError('');

      try {
        const token = await getToken();

        if (!token) {
          throw new Error('Authentication required. Please sign in again.');
        }

        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
        };

        // Use provided filters or fall back to activeFilters
        const filtersToUse = filters !== undefined ? filters : activeFilters;

        // Build filter query params
        const filterParams = new URLSearchParams();
        filterParams.set('limit', String(PAGE_SIZE));
        filterParams.set('offset', String(offset));
        filterParams.set('personalized', 'true'); // Always show personalized/recommended jobs

        // Add filter parameters
        if (filtersToUse.experienceLevel?.length) {
          filterParams.set('experienceLevel', filtersToUse.experienceLevel.join(','));
        }
        if (filtersToUse.minSalary) filterParams.set('minSalary', String(filtersToUse.minSalary));
        if (filtersToUse.maxSalary) filterParams.set('maxSalary', String(filtersToUse.maxSalary));
        if (filtersToUse.locations?.length) {
          filterParams.set('locations', filtersToUse.locations.join(','));
        }
        if (filtersToUse.workType?.length) {
          filterParams.set('workType', filtersToUse.workType.join(','));
        }
        if (filtersToUse.jobType?.length) {
          filterParams.set('jobType', filtersToUse.jobType.join(','));
        }
        if (filtersToUse.postedWithin) {
          filterParams.set('postedWithin', filtersToUse.postedWithin);
        }
        if (filtersToUse.requiredSkills?.length) {
          filterParams.set('requiredSkills', filtersToUse.requiredSkills.join(','));
        }
        if (filtersToUse.preferredSkills?.length) {
          filterParams.set('preferredSkills', filtersToUse.preferredSkills.join(','));
        }
        if (filtersToUse.excludeSkills?.length) {
          filterParams.set('excludeSkills', filtersToUse.excludeSkills.join(','));
        }
        if (filtersToUse.aiApplyable !== undefined) {
          filterParams.set('aiApplyable', String(filtersToUse.aiApplyable));
        }
        if (filtersToUse.applicationComplexity?.length) {
          filterParams.set('applicationComplexity', filtersToUse.applicationComplexity.join(','));
        }

        const response = await fetch(buildUrl(`/api/jobs?${filterParams.toString()}`), {
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

        const normalized = (data.jobs || []).map((job: any) => normalizeJob(job as JobWithExtras));

        // Log for debugging
        logger.debug('Jobs fetched', {
          append,
          newJobs: normalized.length,
          currentJobs: jobs.length,
          willHave: append ? jobs.length + normalized.length : normalized.length
        });

        setBrowseMeta({
          offset: offset,
          hasMore: Boolean(data.hasMore),
          total: data.total || 0,
        });

        // Append or replace based on append flag
        if (append) {
          // Deduplicate jobs by ID when appending
          setJobs(prev => {
            const existingIds = new Set(prev.map(j => j.id));
            const newUniqueJobs = normalized.filter(j => !existingIds.has(j.id));

            // If no new unique jobs, stop loading more (prevents infinite loop)
            if (newUniqueJobs.length === 0) {
              setBrowseMeta(m => ({ ...m, hasMore: false }));
              return prev;
            }

            return [...prev, ...newUniqueJobs];
          });
        } else {
          setJobs(normalized);
          setSelectedJob(normalized[0] ?? null);
          setMode('browse');
          setActiveQuery('');
          setExplanation('');
          setSearchMeta({ query: '', offset: 0, hasMore: false, total: 0 });
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
          setLoading(false);
        }
      }
    },
    [getToken, setSearchParams, activeFilters]
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
      setLoading(true);
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

        // Use AI-powered search endpoint
        const searchUrl = buildUrl('/api/ai-search');
        logger.debug('Making AI search request', { query: trimmedQuery, limit: PAGE_SIZE, offset });

        const response = await fetch(searchUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            query: trimmedQuery,
            limit: PAGE_SIZE,
            offset: offset
          })
        });

        if (!response.ok) {
          throw new Error('Failed to search jobs');
        }

        const data = await response.json();
        logger.debug('AI Search Response', {
          totalResults: data.total,
          jobsCount: data.jobs?.length,
          hasMore: data.hasMore,
          isAppend: append,
          parsedQuery: data.parsedQuery,
          explanation: data.explanation
        });

        if (requestId !== requestIdRef.current) {
          return;
        }

        const normalized = (data.jobs || []).map((job: any) => normalizeJob(job as JobWithExtras));

        // Use AI-generated explanation
        setExplanation(data.explanation || `Found ${data.total} job${data.total === 1 ? '' : 's'} matching "${trimmedQuery}"`);

        logger.debug('Updating jobs state', {
          append,
          previousCount: jobs.length,
          newJobsCount: normalized.length,
          willResultIn: append ? jobs.length + normalized.length : normalized.length
        });

        // Append or replace based on append flag
        if (append) {
          // Deduplicate jobs by ID when appending
          setJobs(prev => {
            const existingIds = new Set(prev.map((j: JobWithExtras) => j.id));
            const newUniqueJobs = normalized.filter((j: JobWithExtras) => !existingIds.has(j.id));

            // If no new unique jobs, stop loading more (prevents infinite loop)
            if (newUniqueJobs.length === 0) {
              setSearchMeta(m => ({ ...m, hasMore: false }));
              return prev;
            }

            return [...prev, ...newUniqueJobs];
          });
        } else {
          setJobs(normalized);
          setSelectedJob(normalized[0] ?? null);
        }

        setSearchMeta({
          query: trimmedQuery,
          offset: offset,
          hasMore: Boolean(data.hasMore),
          total: data.total || 0,
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
          setLoading(false);
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
      setSearchMeta({ query: '', offset: 0, hasMore: false, total: 0 });
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
        setSearchMeta({ query: '', offset: 0, hasMore: false, total: 0 });
        lastUrlQueryRef.current = '';
        setSearchParams({});
        setCurrentPage(1);
        fetchJobs({ offset: 0, append: false });
      }
      return;
    }

    setCurrentPage(1);
    runSearch(trimmed, { offset: 0, append: false });
  }, [debouncedSearch, mode, activeQuery, runSearch, fetchJobs, setSearchParams]);

  // Go to specific page
  const goToPage = useCallback((page: number) => {
    if (loading) return;

    const newOffset = (page - 1) * PAGE_SIZE;
    setCurrentPage(page);

    // Scroll to top of job list
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (mode === 'search') {
      runSearch(activeQuery, { offset: newOffset, append: false });
    } else {
      fetchJobs({ offset: newOffset, append: false });
    }
  }, [loading, mode, activeQuery, runSearch, fetchJobs]);

  // Calculate total pages
  const totalPages = Math.ceil((mode === 'search' ? searchMeta.total : browseMeta.total) / PAGE_SIZE);
  const totalJobs = mode === 'search' ? searchMeta.total : browseMeta.total;

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
    setSearchMeta({ query: '', offset: 0, hasMore: false, total: 0 });
    lastUrlQueryRef.current = '';
    setSearchParams({});
    setCurrentPage(1);
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


  const handleRetry = () => {
    setError('');
    if (mode === 'search' && activeQuery) {
      skipDebounceRef.current = true;
      runSearch(activeQuery, { offset: 0, append: false });
    } else {
      fetchJobs({ offset: 0, append: false });
    }
  };

  const handleGenerateResume = async (job: JobType) => {
    try {
      const token = await getToken();
      if (!token) {
        logger.error('No authentication token available');
        return;
      }

      // Mark this job as generating
      setGeneratingResumes(prev => ({ ...prev, [job.id]: true }));

      // Create job description
      const jobDescription = `${job.title || 'Position'} at ${job.company || 'Company'}\n\nLocation: ${job.location || 'Not specified'}\n\n${job.description || ''}\n\n${job.requirements ? 'Requirements:\n' + job.requirements : ''}`.trim();

      logger.info('Starting resume generation', {
        jobId: job.id,
        title: job.title,
        company: job.company
      });

      // Start job processing
      const { jobId: resumeJobId } = await api.processJob(jobDescription, 'gpt-5-mini', 'standard', token);
      logger.info('Resume job queued', { resumeJobId });

      // Poll for completion
      let completed = false;
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds max

      while (!completed && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;

        try {
          const jobStatus = await api.getJobStatus(resumeJobId, token);
          logger.debug('Polling resume status', { resumeJobId, status: jobStatus.status, attempts });

          if (jobStatus.status === 'COMPLETED') {
            completed = true;
            setGeneratedResumes(prev => ({ ...prev, [job.id]: resumeJobId }));
            logger.info('Resume generation completed', { resumeJobId });
          } else if (jobStatus.status === 'FAILED') {
            throw new Error(jobStatus.error || 'Resume generation failed');
          }
        } catch (pollErr) {
          logger.error('Error polling resume status', pollErr);
        }
      }

      if (!completed) {
        throw new Error('Resume generation timed out');
      }
    } catch (error: any) {
      logger.error('Resume generation error', error);
      window.alert(`Failed to generate resume: ${error.message}`);
    } finally {
      setGeneratingResumes(prev => ({ ...prev, [job.id]: false }));
    }
  };

  const handleAutoApply = async (jobId: string) => {
    setAutoApplying(true);

    // Find the job details for better error messages
    const job = jobs.find(j => j.id === jobId);
    const atsType = job?.atsType || 'unknown';

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
        body: JSON.stringify({ jobId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to queue application');
      }

      const result = await response.json();

      if (result.success) {
        window.alert(
          `✅ Auto-Apply Queued Successfully!\n\n` +
          `Platform: ${atsType.charAt(0).toUpperCase() + atsType.slice(1)}\n` +
          `Application ID: ${result.applicationId}\n` +
          `Status: ${result.status}\n\n` +
          `${result.message}\n\n` +
          `Track progress in your Dashboard.`
        );
        // Stay on the current page instead of navigating away
      } else {
        window.alert('Failed to queue application. Please try again.');
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('No resume found') || err.message.includes('upload a resume') || err.message.includes('Profile not found') || err.message.includes('Application data not configured')) {
          window.alert(
            '⚠️ Auto-Apply Setup Required\n\n' +
            'Before using Auto-Apply, please complete:\n' +
            '1. Fill out application questions\n' +
            '2. Upload a resume PDF\n\n' +
            'Go to: Dashboard → Complete Setup'
          );
          navigate('/application-questions');
        } else if (err.message.includes('Already applied')) {
          window.alert(
            'ℹ️ Already Applied\n\n' +
            'You have already applied to this job.\n' +
            'Check your Dashboard for status updates.'
          );
          // Stay on the current page instead of navigating away
        } else if (err.message.includes('cannot be auto-applied') || err.message.includes('untrusted')) {
          window.alert(
            '⚠️ Manual Application Required\n\n' +
            `This ${atsType} job cannot be auto-applied.\n` +
            'You can still:\n' +
            '• Generate a tailored resume\n' +
            '• Apply manually on the job site'
          );
        } else {
          window.alert(
            `❌ Auto-Apply Failed\n\n${err.message}\n\n` +
            'Supported platforms: Greenhouse, Lever, iCIMS, Workday, Ashby'
          );
        }
      } else {
        window.alert('❌ Failed to queue application. Please try again later.');
      }
    } finally {
      setAutoApplying(false);
    }
  };

  const isInitialLoading = loading;
  const showEmptyState = !isInitialLoading && !error && filteredJobs.length === 0;

  return (
    <div className="flex-1 w-full min-h-screen bg-background text-text font-sans">
      <div className="max-w-[1160px] mx-auto flex flex-col gap-2 px-4 lg:px-6 pt-4 pb-0">
        <div className="flex flex-col gap-3 sticky top-0 z-20 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/60">

          {/* Search and Filters Row */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 pb-3 border-b border-[rgba(12,19,16,0.06)]">
            {/* Search Input */}
            <form
              onSubmit={handleSearchSubmit}
              className="flex-1 flex items-center gap-2"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search jobs by title, company, skills..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-gray-400"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="px-4 py-2.5 bg-primary text-white rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors whitespace-nowrap"
              >
                Search
              </button>
            </form>

            <div className="flex items-center gap-2.5">
              {/* Filter Button */}
              <button
                type="button"
                onClick={() => setIsFilterPanelOpen(true)}
                className="rounded-full px-[14px] py-[6px] text-[13px] font-medium cursor-pointer transition flex items-center gap-1.5 border border-[rgba(12,19,16,0.12)] bg-white text-accent hover:bg-gray-50"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                </svg>
                Filters
                {Object.keys(activeFilters).filter(key => {
                  const value = activeFilters[key as keyof JobFilters];
                  if (Array.isArray(value)) return value.length > 0;
                  return value !== undefined && value !== null;
                }).length > 0 && (
                  <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-primary rounded-full">
                    {Object.keys(activeFilters).filter(key => {
                      const value = activeFilters[key as keyof JobFilters];
                      if (Array.isArray(value)) return value.length > 0;
                      return value !== undefined && value !== null;
                    }).length}
                  </span>
                )}
              </button>

              {/* Sort Dropdown */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'recommended' | 'latest' | 'salary')}
                  className="appearance-none rounded-full px-[14px] py-[6px] pr-8 text-[13px] font-medium cursor-pointer transition border border-[rgba(12,19,16,0.12)] bg-white text-accent hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="recommended">Recommended</option>
                  <option value="latest">Latest</option>
                  <option value="salary">Highest Salary</option>
                </select>
                <svg
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {mode === 'search' && activeQuery && (
                <span className="text-[13px] text-[var(--gray-600)]">"{activeQuery}"</span>
              )}
            </div>
          </div>

          {mode === 'search' && explanation && (
            <div className="bg-[var(--primary-50)] border border-[rgba(62,172,167,0.2)] rounded-xl px-4 py-3 flex items-start gap-3">
              <div className="text-primary mt-0.5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-accent leading-relaxed">{explanation}</p>
              </div>
            </div>
          )}
        </div>

        <div className={`${selectedJob && isDetailOpen && !isMobile ? 'flex gap-6' : ''} items-start transition-all duration-300`}>
          <div className={`${isMobile ? 'flex flex-col gap-4 pr-0' : 'pr-1'} ${selectedJob && isDetailOpen && !isMobile ? 'w-[380px] flex-shrink-0' : 'w-full'}`}>
            <div className={`${isMobile ? 'flex flex-col gap-4' : selectedJob && isDetailOpen ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-2 gap-4'}`}>
              {isInitialLoading && (
                <>
                  {Array.from({ length: isMobile ? 4 : 6 }).map((_, index) => (
                  <div key={`skeleton-${index}`} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-20 h-4 bg-gray-200 rounded" />
                      <div className="w-5 h-5 bg-gray-200 rounded" />
                    </div>
                    <div className="flex gap-4 mb-4">
                      <div className="w-12 h-12 rounded-full bg-gray-200" />
                      <div className="flex-1">
                        <div className="w-3/4 h-5 bg-gray-200 rounded mb-2" />
                        <div className="w-1/2 h-4 bg-gray-200 rounded" />
                      </div>
                    </div>
                    <div className="flex gap-3 mb-4">
                      <div className="w-20 h-4 bg-gray-200 rounded" />
                      <div className="w-20 h-4 bg-gray-200 rounded" />
                      <div className="w-24 h-4 bg-gray-200 rounded" />
                    </div>
                    <div className="flex justify-end">
                      <div className="w-24 h-10 bg-gray-200 rounded-lg" />
                    </div>
                  </div>
                  ))}
                </>
              )}

              {!isInitialLoading && filteredJobs.map((job, index) => (
                <JobCardSimple
                  key={job.id}
                  job={job}
                  delay={index * 0.05}
                  onViewDetails={() => { setSelectedJob(job); setIsDetailOpen(true); }}
                  onGenerateResume={handleGenerateResume}
                  onViewJob={(url) => window.open(url, '_blank', 'noopener')}
                  onAutoApply={job.aiApplyable ? (j) => handleAutoApply(j.id) : undefined}
                  isGenerating={generatingResumes[job.id]}
                  resumeJobId={generatedResumes[job.id]}
                />
              ))}

              {showEmptyState && (
                <div className="bg-elevated rounded-2xl border border-[rgba(28,63,64,0.12)] p-10 text-center text-[var(--gray-600)] shadow-md">
                  <div className="flex justify-center mb-3">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                      <circle cx="11" cy="11" r="8"/>
                      <path d="m21 21-4.35-4.35"/>
                    </svg>
                  </div>
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

            {/* Pagination Controls */}
            {!isInitialLoading && totalJobs > 0 && (
              <div className="mt-8 mb-8">
                {/* Job count and page info */}
                <div className="text-center mb-4">
                  <p className="text-sm text-[var(--gray-600)]">
                    Showing {((currentPage - 1) * PAGE_SIZE) + 1}-{Math.min(currentPage * PAGE_SIZE, totalJobs)} of {totalJobs} jobs
                  </p>
                </div>

                {/* Pagination buttons */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    {/* Previous button */}
                    <button
                      type="button"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1 || loading}
                      className="px-4 py-2 rounded-lg border border-[rgba(12,19,16,0.12)] bg-white text-accent font-medium cursor-pointer hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>

                    {/* Page numbers */}
                    <div className="flex items-center gap-1">
                      {/* First page */}
                      {currentPage > 3 && (
                        <>
                          <button
                            type="button"
                            onClick={() => goToPage(1)}
                            disabled={loading}
                            className="w-10 h-10 rounded-lg border border-[rgba(12,19,16,0.12)] bg-white text-accent font-medium cursor-pointer hover:bg-gray-50 disabled:opacity-50 transition-colors"
                          >
                            1
                          </button>
                          {currentPage > 4 && <span className="px-2 text-[var(--gray-400)]">...</span>}
                        </>
                      )}

                      {/* Page numbers around current */}
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }

                        if (pageNum < 1 || pageNum > totalPages) return null;
                        if (currentPage > 3 && pageNum === 1) return null;
                        if (currentPage < totalPages - 2 && pageNum === totalPages) return null;

                        return (
                          <button
                            key={pageNum}
                            type="button"
                            onClick={() => goToPage(pageNum)}
                            disabled={loading}
                            className={`w-10 h-10 rounded-lg font-medium cursor-pointer transition-colors disabled:opacity-50 ${
                              currentPage === pageNum
                                ? 'bg-primary text-white border border-primary'
                                : 'border border-[rgba(12,19,16,0.12)] bg-white text-accent hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}

                      {/* Last page */}
                      {currentPage < totalPages - 2 && totalPages > 5 && (
                        <>
                          {currentPage < totalPages - 3 && <span className="px-2 text-[var(--gray-400)]">...</span>}
                          <button
                            type="button"
                            onClick={() => goToPage(totalPages)}
                            disabled={loading}
                            className="w-10 h-10 rounded-lg border border-[rgba(12,19,16,0.12)] bg-white text-accent font-medium cursor-pointer hover:bg-gray-50 disabled:opacity-50 transition-colors"
                          >
                            {totalPages}
                          </button>
                        </>
                      )}
                    </div>

                    {/* Next button */}
                    <button
                      type="button"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages || loading}
                      className="px-4 py-2 rounded-lg border border-[rgba(12,19,16,0.12)] bg-white text-accent font-medium cursor-pointer hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}

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

          </div>

          {/* Job Detail Panel - Side by Side on Desktop */}
          {selectedJob && isDetailOpen && !isMobile && (
            <div className="self-start sticky top-24">
              <JobDetailPanelSimple
                job={selectedJob as any}
                isOpen={true}
                onClose={() => setIsDetailOpen(false)}
                onGenerateResume={handleGenerateResume}
                onViewJob={(url) => window.open(url, '_blank', 'noopener')}
                onAutoApply={selectedJob.aiApplyable ? (j) => handleAutoApply(j.id) : undefined}
              />
            </div>
          )}
        </div>
      </div>

      {/* Mobile Overlay Detail Panel */}
      {isMobile && selectedJob && (
        <JobDetailPanel
          job={selectedJob as any}
          isOpen={Boolean(selectedJob) && isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          onGenerateResume={handleGenerateResume}
          onApply={(url) => window.open(url, '_blank', 'noopener')}
          onAutoApply={selectedJob.aiApplyable ? (job) => handleAutoApply((job as any).id) : undefined}
          isSidePanel={false}
        />
      )}

      {/* Filter Panel */}
      <JobFilterPanel
        filters={activeFilters}
        onFiltersChange={(newFilters) => {
          setActiveFilters(newFilters);
          setIsFilterPanelOpen(false);
          // Trigger refetch with new filters directly
          if (mode === 'search' && activeQuery) {
            runSearch(activeQuery, { offset: 0, append: false });
          } else {
            fetchJobs({ offset: 0, append: false, filters: newFilters });
          }
        }}
        onClose={() => setIsFilterPanelOpen(false)}
        isOpen={isFilterPanelOpen}
      />
    </div>
  );
}
import React, { useEffect, useState, useRef, KeyboardEvent } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { api, type ResumeEntry, type Profile } from '../api-clerk';
import Icons from '../components/ui/icons';
import UpgradeLimitModal from '../components/UpgradeLimitModal';
import ProfileCompletionBanner from '../components/ProfileCompletionBanner';
import { SectionHeader } from '../ui/SectionHeader';
import Card, { CardContent } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { PromptBox } from '../components/ui/chatgpt-prompt-input';
import logger from '../utils/logger';

// Simple in-memory cache
const dashboardCache = {
  resumes: null as ResumeEntry[] | null,
  profile: null as Profile | null,
  timestamp: 0,
  maxAge: 30000, // 30 seconds
};

export default function DashboardModern() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [resumes, setResumes] = useState<ResumeEntry[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [jobDescription, setJobDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [lastGenerated, setLastGenerated] = useState<ResumeEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'recent' | 'week'>('all');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [usageLimit, setUsageLimit] = useState({ used: 0, limit: 5 });
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    // Only load once per mount
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadDashboardData();
    }
  }, []);

  useEffect(() => {
    logger.debug('[RUNTIME] Mounted: DashboardModern');
  }, []);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  async function loadDashboardData() {
    try {
      // Check cache first - cache is valid if we have data and it's fresh
      const now = Date.now();
      const cacheValid = dashboardCache.timestamp > 0 && (now - dashboardCache.timestamp) < dashboardCache.maxAge;

      if (cacheValid) {
        logger.info('Using cached dashboard data');
        setResumes(dashboardCache.resumes || []);
        setProfile(dashboardCache.profile);
        setLoading(false);
        return;
      }

      logger.info('Fetching fresh dashboard data');
      const token = await getToken();
      const [resumesData, profileData] = await Promise.all([
        api.getResumes(token || undefined),
        api.getProfile(token || undefined)
      ]);

      setProfile(profileData);

      let resumesList: ResumeEntry[] = [];
      if (Array.isArray(resumesData)) {
        resumesList = resumesData;
      } else if (resumesData && typeof resumesData === 'object' && 'resumes' in resumesData) {
        resumesList = (resumesData as any).resumes || [];
      }

      setResumes(resumesList);

      // Update cache - always update, even if data is null/empty
      dashboardCache.resumes = resumesList;
      dashboardCache.profile = profileData;
      dashboardCache.timestamp = Date.now();
    } catch (err) {
      logger.error('Failed to load dashboard', err);
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
      logger.info('Job started', { jobId });

      // Poll for job completion
      let jobCompleted = false;
      let pollCount = 0;
      const maxPolls = 60; // Max 60 seconds

      while (!jobCompleted && pollCount < maxPolls) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

        try {
          const jobStatus = await api.getJobStatus(jobId, token || undefined);
          logger.debug('Job status', { jobId, status: jobStatus.status });

          if (jobStatus.status === 'COMPLETED') {
            jobCompleted = true;
          } else if (jobStatus.status === 'FAILED') {
            throw new Error(jobStatus.error || 'Resume generation failed');
          }
        } catch (pollErr) {
          logger.error('Error polling job status', pollErr);
        }

        pollCount++;
      }

      if (!jobCompleted) {
        throw new Error('Resume generation timed out. Please try again.');
      }

      // Job completed - now fetch the resumes
      logger.info('Job completed, fetching resumes');
      const resumesData = await api.getResumes(token || undefined);

      let resumesList: ResumeEntry[] = [];
      if (Array.isArray(resumesData)) {
        resumesList = resumesData;
        setResumes(resumesData);
        if (resumesData.length > 0) {
          setLastGenerated(resumesData[0]);
          logger.info('Found resumes', { count: resumesData.length });
        }
      } else if (resumesData && typeof resumesData === 'object' && 'resumes' in resumesData) {
        resumesList = (resumesData as any).resumes || [];
        setResumes(resumesList);
        if (resumesList.length > 0) {
          setLastGenerated(resumesList[0]);
          logger.info('Found resumes', { count: resumesList.length });
        }
      }

      // Update cache with new resume
      dashboardCache.resumes = resumesList;
      dashboardCache.timestamp = Date.now();

      setJobDescription('');
    } catch (err: any) {
      // Check if it's a 403 limit error
      if (err.status === 403 && err.message?.includes('limit')) {
        const token = await getToken();
        const usage = await api.get('/api/usage', token || undefined).catch(() => ({ used: 0, limit: 5 }));
        setUsageLimit(usage);
        setShowLimitModal(true);
        setError('');
      } else {
        setError(err.message || 'Failed to generate resume. Please try again.');
      }
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
      logger.error('Failed to download resume', err);
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


  const filteredResumes = getFilteredResumes();

  return (
    <div className="modern-dashboard">
      <UpgradeLimitModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        usedCount={usageLimit.used}
        limit={usageLimit.limit}
      />

      <div className="modern-dashboard-container">
        {/* Main Generator Card */}
        <div className="modern-generator-card">
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

            {/* Profile Completion Banner - shown above job description if profile incomplete or missing */}
            <ProfileCompletionBanner isComplete={profile?.isComplete ?? false} />

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleGenerate();
              }}
              className="w-full"
            >
              <PromptBox
                ref={textareaRef}
                value={jobDescription}
                onChange={(e) => {
                  setJobDescription(e.target.value);
                  setError('');
                }}
                placeholder="Paste the job description here to generate a tailored resume..."
                disabled={isGenerating}
              />
            </form>

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

        {/* History Section (refactored to UI kit) */}
        <div id="history-section" className="mt-10">
          <SectionHeader
            icon={<Icons.clock size={22} />}
            title="Generation History"
            count={filteredResumes.length}
            right={
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Input
                    placeholder="Search resumes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-64"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                    <Icons.search size={16} />
                  </div>
                </div>
                <Button variant={filter === 'all' ? 'solid' : 'outline'} size="sm" onClick={() => setFilter('all')}>All</Button>
                <Button variant={filter === 'recent' ? 'solid' : 'outline'} size="sm" onClick={() => setFilter('recent')}>Recent</Button>
                <Button variant={filter === 'week' ? 'solid' : 'outline'} size="sm" onClick={() => setFilter('week')}>Week</Button>
              </div>
            }
            className="mb-6"
          />

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="pt-5">
                    <div className="flex items-start gap-3 animate-pulse">
                      <div className="w-5 h-5 bg-gray-200 rounded"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                        <div className="flex gap-3 mt-2">
                          <div className="h-3 bg-gray-200 rounded w-20"></div>
                          <div className="h-3 bg-gray-200 rounded w-16"></div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredResumes.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredResumes.map((resume, idx) => (
                <Card key={idx}>
                  <CardContent className="pt-5">
                    <div className="flex items-start gap-3">
                      <div className="text-primary-600 mt-0.5"><Icons.fileText size={20} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-semibold truncate">{resume.company || 'Unknown Company'}</h3>
                            <p className="text-xs text-neutral-600 truncate">{resume.role || 'Position not specified'}</p>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-3 text-xs text-neutral-500">
                          <span className="inline-flex items-center gap-1">
                            <Icons.calendar size={14} />
                            {formatDate(resume.createdAt)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Icons.file size={14} />
                            {formatFileSize()}
                          </span>
                        </div>
                      </div>
                      <div className="self-start">
                        <Button
                          aria-label="Download resume"
                          variant="outline"
                          size="sm"
                          onClick={() => downloadResume(resume.fileName)}
                        >
                          <Icons.download size={16} />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-5">
                <div className="text-center py-8">
                  <div className="mx-auto mb-3 text-neutral-400"><Icons.inbox size={40} /></div>
                  <h3 className="text-base font-semibold">No resumes found</h3>
                  <p className="text-sm text-neutral-600">
                    {searchTerm ? `No results matching "${searchTerm}"` : 'Generate your first resume to get started'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
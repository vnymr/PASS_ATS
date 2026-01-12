import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { api, type ResumeEntry, type Profile } from '../api-clerk';
import Icons from '../components/ui/icons';
import logger from '../utils/logger';
import { PromptBox } from '../components/ui/chatgpt-prompt-input';
import { motion, AnimatePresence } from 'framer-motion';
import { SectionHeader } from '../ui/SectionHeader';
import Card, { CardContent } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Layout } from 'lucide-react';

export default function GenerateResume() {
  const navigate = useNavigate();
  const location = useLocation();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [resumeText, setResumeText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [generatedResume, setGeneratedResume] = useState('');
  const [jobId, setJobId] = useState('');
  const [resumes, setResumes] = useState<ResumeEntry[]>([]);
  const [loadingResumes, setLoadingResumes] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'recent' | 'week'>('all');

  // Load job description from navigation state if available
  useEffect(() => {
    const state = location.state as { jobDescription?: string; jobTitle?: string; company?: string } | null;
    if (state?.jobDescription) {
      setJobDescription(state.jobDescription);
      logger.info('Loaded job description from navigation', {
        title: state.jobTitle,
        company: state.company,
        length: state.jobDescription.length
      });
    }
  }, [location]);

  // Load user's resume text from profile - wait for Clerk to be loaded
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      loadProfile();
      loadResumes();
    }
  }, [isLoaded, isSignedIn]);

  const loadProfile = async () => {
    try {
      const token = await getToken();
      logger.info('Loading profile for generate page', { hasToken: !!token });
      const profile = await api.getProfile(token || undefined);
      logger.info('Profile response', {
        hasProfile: !!profile,
        resumeTextLength: profile?.resumeText?.length || 0,
        keys: profile ? Object.keys(profile) : []
      });
      if (profile?.resumeText) {
        setResumeText(profile.resumeText);
      }
    } catch (err) {
      logger.error('Failed to load profile', err);
    }
  };

  const loadResumes = async () => {
    try {
      setLoadingResumes(true);
      const token = await getToken();
      const data = await api.getResumes(token || undefined);
      let resumesList: ResumeEntry[] = [];
      if (Array.isArray(data)) {
        resumesList = data;
      } else if (data && typeof data === 'object' && 'resumes' in data) {
        resumesList = (data as any).resumes || [];
      }
      setResumes(resumesList);
    } catch (err) {
      logger.error('Failed to load resumes', err);
    } finally {
      setLoadingResumes(false);
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
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
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

  const handleGenerate = async (jobDescriptionOverride?: string) => {
    const jobDesc = jobDescriptionOverride || jobDescription;

    if (!resumeText) {
      setError('Please set up your resume text in your profile first');
      return;
    }
    if (!jobDesc) {
      setError('Please provide a job description');
      return;
    }

    setIsGenerating(true);
    setError('');
    setSuccess(false);
    setGeneratedResume('');

    try {
      const token = await getToken();

      // Start job processing
      const { jobId } = await api.processJob(jobDesc, 'claude', 'Standard', token || undefined);
      logger.info('Job started', { jobId });

      // Poll for job completion
      let jobCompleted = false;
      let pollCount = 0;
      const maxPolls = 180; // Max 3 minutes (resume gen takes ~45-60 seconds)

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

      // Job completed
      setJobId(jobId);
      setSuccess(true);
      setGeneratedResume('Your tailored resume has been generated successfully!');

      // Reload resumes to show the new one
      await loadResumes();

      // Show success message
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to generate resume');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const message = formData.get('message') as string || '';
    if (message.trim()) {
      const trimmedMessage = message.trim();
      setJobDescription(trimmedMessage);
      handleGenerate(trimmedMessage);
    }
  };

  return (
    <div className="flex-1 w-full bg-background min-h-screen text-text font-sans">
      {/* ChatGPT-style Input */}
      <div className="max-w-[780px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-16">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="mb-4 sm:mb-6"
        >
          <motion.h1
            style={{
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
              fontWeight: 500,
              fontSize: 'clamp(20px, 5vw, 24px)',
              color: 'var(--text-900)',
              letterSpacing: '-0.01em',
              marginBottom: '8px',
            }}
          >
            Generate your perfect resume
          </motion.h1>
        </motion.div>

        <form onSubmit={handleFormSubmit} className="w-full">
          <PromptBox
            name="message"
            placeholder="Paste the job description here..."
            disabled={isGenerating}
            className="w-full"
            leftButton={
              <Link
                to="/templates"
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium text-primary hover:text-primary-700 bg-primary/5 border border-primary/20 rounded-lg hover:bg-primary/10 transition-colors"
              >
                <Layout size={10} className="sm:w-3 sm:h-3" />
                <span className="hidden xs:inline">Template</span>
              </Link>
            }
          />
        </form>
      </div>

      {/* Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6 sm:pb-8">
        {/* Resume Profile Status */}
        <AnimatePresence>
          {!resumeText && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 flex items-start sm:items-center gap-2 rounded-xl border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.08)] px-3 sm:px-4 py-2.5 sm:py-3 text-[12px] sm:text-[13px] text-[#92400e]"
            >
              <Icons.alertCircle size={16} className="sm:w-[18px] sm:h-[18px] flex-shrink-0 mt-0.5 sm:mt-0" />
              <div className="flex items-start sm:items-center flex-wrap gap-1">
                <span>Please set up your resume text in your</span>
                <button
                  className="underline decoration-[var(--primary)] underline-offset-4 text-primary font-semibold"
                  onClick={() => navigate('/profile')}
                >
                  profile
                </button>
                <span>first.</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Messages */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 flex items-start sm:items-center gap-2 rounded-xl border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] px-3 sm:px-4 py-2.5 sm:py-3 text-[12px] sm:text-[13px] text-[#b91c1c]"
            >
              <Icons.alertCircle size={16} className="sm:w-[18px] sm:h-[18px] flex-shrink-0 mt-0.5 sm:mt-0" />
              <span className="break-words">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 flex items-start sm:items-center gap-2 rounded-xl border border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.08)] px-3 sm:px-4 py-2.5 sm:py-3 text-[12px] sm:text-[13px] text-[#166534]"
            >
              <Icons.checkCircle size={16} className="sm:w-[18px] sm:h-[18px] flex-shrink-0 mt-0.5 sm:mt-0" />
              <span className="break-words">Resume generated and downloaded successfully!</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generation Status */}
        <AnimatePresence>
          {isGenerating && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 mb-4 inline-flex items-center gap-2 sm:gap-2.5"
              style={{ backgroundColor: 'var(--background-50)' }}
            >
              <Icons.loader className="animate-spin w-4 h-4 sm:w-4 sm:h-4" style={{ color: 'var(--primary)' }} />
              <span className="text-xs sm:text-sm font-medium" style={{ color: 'var(--text-700)' }}>
                Generating your resume...
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generated Resume Display */}
        <AnimatePresence>
          {generatedResume && !isGenerating && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="rounded-[12px] p-4 sm:p-6 border border-[rgba(34,197,94,0.2)]"
              style={{ backgroundColor: 'var(--background-50)' }}
            >
              <div className="flex items-start gap-3 mb-4">
                <div
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'var(--secondary-500)' }}
                >
                  <Icons.checkCircle size={16} className="sm:w-5 sm:h-5" style={{ color: 'white' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3
                    className="font-medium"
                    style={{
                      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                      fontSize: 'clamp(14px, 3vw, 15px)',
                      color: 'var(--text-900)',
                      marginBottom: '2px',
                    }}
                  >
                    Resume Generated Successfully
                  </h3>
                  <p
                    style={{
                      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                      fontSize: 'clamp(12px, 2.5vw, 13px)',
                      color: 'var(--text-600)',
                      lineHeight: '1.4',
                    }}
                  >
                    Your tailored resume is ready for download.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={() => {
                    if (jobId) {
                      downloadResume(`resume_${jobId}.pdf`);
                    }
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl font-semibold h-10 sm:h-11 px-4 sm:px-6 transition-all duration-200 text-sm sm:text-base"
                  style={{
                    backgroundColor: 'var(--primary-600)',
                    color: 'white',
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                  }}
                >
                  <Icons.download size={16} className="sm:w-[18px] sm:h-[18px]" />
                  Download PDF
                </button>
                <button
                  onClick={() => navigate('/history')}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl font-semibold h-10 sm:h-11 px-4 sm:px-6 transition-all duration-200 border text-sm sm:text-base"
                  style={{
                    backgroundColor: 'white',
                    color: 'var(--text-700)',
                    borderColor: 'var(--border-color)',
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                  }}
                >
                  <Icons.fileText size={16} className="sm:w-[18px] sm:h-[18px]" />
                  View All Resumes
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Helper Text */}
        {!isGenerating && !generatedResume && jobDescription && resumeText && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center px-2"
          >
            <p
              className="text-xs sm:text-sm"
              style={{
                color: 'var(--text-600)',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
              }}
            >
              Ready to generate your tailored resume. Press Cmd/Ctrl + Enter or click below.
            </p>
            <button
              onClick={() => handleGenerate()}
              disabled={!resumeText || !jobDescription}
              className="mt-3 sm:mt-4 inline-flex items-center justify-center gap-2 rounded-xl font-semibold h-10 sm:h-11 px-4 sm:px-6 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
              style={{
                backgroundColor: 'var(--primary-600)',
                color: 'white',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
              }}
            >
              <Icons.zap size={16} className="sm:w-[18px] sm:h-[18px]" />
              Generate Tailored Resume
            </button>
          </motion.div>
        )}

        {/* History Section */}
        <div className="mt-6 sm:mt-10">
          <SectionHeader
            icon={<Icons.clock size={20} className="sm:w-[22px] sm:h-[22px]" />}
            title="Generation History"
            count={getFilteredResumes().length}
            right={
              <div className="relative w-full sm:w-64">
                <Input
                  placeholder="Search resumes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-full text-sm"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                  <Icons.search size={14} className="sm:w-4 sm:h-4" />
                </div>
              </div>
            }
            className="mb-4 sm:mb-6"
          />

          {loadingResumes ? (
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="pt-4 sm:pt-5">
                    <div className="flex items-start gap-3 animate-pulse">
                      <div className="w-4 h-4 sm:w-5 sm:h-5 bg-gray-200 rounded"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-3 sm:h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-2.5 sm:h-3 bg-gray-200 rounded w-1/2"></div>
                        <div className="flex gap-2 sm:gap-3 mt-2">
                          <div className="h-2.5 sm:h-3 bg-gray-200 rounded w-16 sm:w-20"></div>
                          <div className="h-2.5 sm:h-3 bg-gray-200 rounded w-12 sm:w-16"></div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : getFilteredResumes().length > 0 ? (
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {getFilteredResumes().map((resume, idx) => (
                <Card key={idx}>
                  <CardContent className="pt-4 sm:pt-5">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className="text-primary-600 mt-0.5 flex-shrink-0"><Icons.fileText size={18} className="sm:w-5 sm:h-5" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold truncate text-sm sm:text-base">{resume.company || 'Unknown Company'}</h3>
                            <p className="text-[11px] sm:text-xs text-neutral-600 truncate mt-0.5">{resume.role || 'Position not specified'}</p>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-neutral-500">
                          <span className="inline-flex items-center gap-1">
                            <Icons.calendar size={12} className="sm:w-3.5 sm:h-3.5" />
                            {formatDate(resume.createdAt)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Icons.file size={12} className="sm:w-3.5 sm:h-3.5" />
                            {formatFileSize()}
                          </span>
                        </div>
                      </div>
                      <div className="self-start flex-shrink-0">
                        <Button
                          aria-label="Download resume"
                          variant="outline"
                          size="sm"
                          onClick={() => downloadResume(resume.fileName)}
                          className="h-8 w-8 sm:h-9 sm:w-9 p-0"
                        >
                          <Icons.download size={14} className="sm:w-4 sm:h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-4 sm:pt-5">
                <div className="text-center py-6 sm:py-8 px-2">
                  <div className="mx-auto mb-3 text-neutral-400"><Icons.inbox size={32} className="sm:w-10 sm:h-10" /></div>
                  <h3 className="text-sm sm:text-base font-semibold">No resumes found</h3>
                  <p className="text-xs sm:text-sm text-neutral-600 mt-1">
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

